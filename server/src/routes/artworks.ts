/**
 * Rotte delle opere. Il catalogo legge per museo; il curatore aggiunge da Wikidata o
 * elimina con una cascata dichiarata prima dall'endpoint impact.
 */
import { Router } from "express";
import { sessionUser } from "../session";
import { ArtworkModel } from "../models/artwork";
import { MuseumModel } from "../models/museum";
import { VisitModel } from "../models/visit";
import { UserModel } from "../models/user";
import { sortByFlow } from "../services/svgGraph";
import { ItemModel } from "../models/item";
import { createDescription } from "../services/llm";
import { purchasedBy, isReadable, withoutText, readableItems } from "../access";
import { findMuseumConfig } from "../data/museumConfigs";
import { appartieneAlMuseo } from "../services/wikidata";
import { locationsFromMap, populateArtwork } from "../manager";
import { rimuoviTappeDalleVisite } from "../catalogue";
import { rimuoviImmagine } from "./items";
import { ArtworkImpactReport } from "../../../shared/types";

const router = Router();

/**
 * GET /api/artworks[?museum=Qxxx]
 * Ritorna: le opere del museo indicato, o tutte se il parametro manca.
 */
router.get("/", async (req, res) => {
  try {
    const museum = String(req.query.museum || "");
    const filter = museum
      ? { ofMuseum: `http://www.wikidata.org/entity/${museum}` }
      : {};
    const artworks = await ArtworkModel.find(filter).lean();
    if (!museum) return res.json(artworks);
    const doc = await MuseumModel.findOne({ qid: museum });
    res.json(sortByFlow(artworks, doc ? doc.mapPath : ""));
  } catch (error: any) {
    res.status(500).json({ error: "Errore nel caricamento delle opere" });
  }
});

/**
 * GET /api/artworks/:qid/items[?user=nome]
 * Ritorna: le descrizioni pubbliche dell'opera; il testo e' leggibile solo se gratuito, proprio o
 * posseduto.
 */
router.get("/:qid/items", async (req, res) => {
  try {
    const { qid } = req.params;
    const artwork = await ArtworkModel.findOne({ qid });
    if (!artwork) return res.status(404).json({ error: "Artwork non trovato" });

    const items = await ItemModel.find({
      about: artwork["@id"],
      visibility: { $ne: "privato" },
    }).lean();
    const user = sessionUser(req).username;
    const owned = await purchasedBy(user);
    res.json(readableItems(items, user, owned));
  } catch (error: any) {
    res.status(500).json({ error: "Errore nel recupero delle descrizioni dell'opera" });
  }
});

/**
 * GET /api/artworks/:qid/preview[?level=&duration=]
 * Ritorna: { artwork, item } per QR e codice, scegliendo per tono e durata. Se manca una descrizione
 * la genera e salva; 502 se il modello non risponde.
 */
router.get("/:qid/preview", async (req, res) => {
  try {
    const { qid } = req.params;
    const { level, duration } = req.query;

    const artwork = await ArtworkModel.findOne({ qid });
    if (!artwork) {
      return res.status(404).json({ error: "Artwork non trovato" });
    }

    const baseFilter = { about: artwork["@id"] };

    let item = null;
    if (level && duration) {
      item = await ItemModel.findOne({
        ...baseFilter,
        educationalLevel: level,
        timeRequired: String(duration),
      });
    }
    if (!item && level) {
      item = await ItemModel.findOne({ ...baseFilter, educationalLevel: level });
    }
    if (!item) {
      item = await ItemModel.findOne(baseFilter);
    }

    if (item) {
      const user = sessionUser(req).username;
      const owned = await purchasedBy(user);
      if (!isReadable(item, user, owned)) {
        return res.json({ artwork, item: withoutText(item) });
      }
      return res.json({ artwork, item });
    }

    let usedLevel = "Intermedio";
    if (level) usedLevel = String(level);
    let usedDuration = 30;
    if (duration) usedDuration = Number(duration);

    const text = await createDescription(
      artwork.name,
      artwork.author.name,
      usedLevel,
      usedDuration,
    );
    if (!text) {
      return res.status(502).json({ error: "Impossibile generare la descrizione dell'opera" });
    }

    const generatedId = `${qid}-AI-${usedLevel}-${usedDuration}`;
    const generated = await ItemModel.findOneAndUpdate(
      { "@id": generatedId },
      {
        "@id": generatedId,
        kind: "opera",
        about: artwork["@id"],
        ofMuseum: artwork.ofMuseum,
        text,
        timeRequired: String(usedDuration),
        educationalLevel: usedLevel,
        author: "AI",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.json({ artwork, item: generated });
  } catch (error: any) {
    res.status(500).json({ error: "Errore nel recupero dell'anteprima opera" });
  }
});

// --- Il catalogo del curatore: aggiungere e togliere un'opera ---------------

function soloCuratore(req: any, res: any): boolean {
  if (sessionUser(req).role === "curatore") return true;
  res.status(403).json({ error: "Solo il curatore può modificare il catalogo." });
  return false;
}

async function eliminaVisiteCitanti(impatto: {
  visitIds: string[];
  visits: any[];
}) {
  if (impatto.visitIds.length > 0)
    await VisitModel.deleteMany({ "@id": { $in: impatto.visitIds } });
  return {
    accorciate: [] as { id: string; name: string }[],
    svuotate: impatto.visits.map((v: any) => ({ id: v["@id"], name: v.name })),
  };
}

async function impattoOpera(artworkId: string) {
  const items = await ItemModel.find({ about: artworkId }).select("@id imagePath");
  const itemIds = items.map((i: any) => i["@id"]);
  const daTogliere = new Set(itemIds);
  const visits = await VisitModel.find({ itemListElement: { $in: itemIds } }).select(
    "@id name author accessKey itemListElement",
  );
  const visitIds = visits.map((v: any) => v["@id"]);
  const svuotate = visits.filter((v: any) =>
    (v.itemListElement || []).every((id: string) => daTogliere.has(id)),
  );
  const adozioni = await UserModel.countDocuments({
    collezione: { $in: [...itemIds, ...visitIds] },
  });
  return { items, itemIds, visits, visitIds, svuotate, adozioni };
}

/**
 * GET /api/artworks/:qid/impact
 * Ritorna: { descrizioni, visite[], adozioni }, senza scrivere, per anticipare la cascata.
 */
router.get("/:qid/impact", async (req, res) => {
  try {
    if (!soloCuratore(req, res)) return;
    const { qid } = req.params;
    const artwork = await ArtworkModel.findOne({ qid });
    if (!artwork) return res.status(404).json({ error: "Opera non trovata" });

    const impatto = await impattoOpera(artwork["@id"]);
    const rapporto: ArtworkImpactReport = {
      qid,
      nome: artwork.name,
      descrizioni: impatto.itemIds.length,
      visite: impatto.visits.map((v: any) => ({
        id: v["@id"],
        name: v.name,
        author: v.author || null,
        guidata: Boolean(v.accessKey),
      })),
      svuotate: impatto.svuotate.map((v: any) => ({ id: v["@id"], name: v.name })),
      adozioni: impatto.adozioni,
    };
    res.json(rapporto);
  } catch (error: any) {
    console.error("[BACKEND ERROR] impatto eliminazione opera:", error);
    res.status(500).json({ error: "Errore nel calcolo dell'impatto" });
  }
});

/**
 * DELETE /api/artworks/:qid[?visite=accorcia|elimina]
 * Elimina opera e descrizioni; accorcia le visite citanti o, su richiesta, le elimina. Ritorna la
 * cascata applicata; una visita rimasta vuota sparisce sempre.
 */
router.delete("/:qid", async (req, res) => {
  try {
    if (!soloCuratore(req, res)) return;
    const { qid } = req.params;
    const artwork = await ArtworkModel.findOne({ qid });
    if (!artwork) return res.status(404).json({ error: "Opera non trovata" });

    const impatto = await impattoOpera(artwork["@id"]);

    const esito =
      String(req.query.visite || "") === "elimina"
        ? await eliminaVisiteCitanti(impatto)
        : await rimuoviTappeDalleVisite(impatto.itemIds);
    if (impatto.itemIds.length > 0)
      await ItemModel.deleteMany({ "@id": { $in: impatto.itemIds } });
    await ArtworkModel.deleteOne({ qid });
    const spariti = esito.svuotate.map((v) => v.id);
    await UserModel.updateMany(
      {},
      { $pull: { collezione: { $in: [...impatto.itemIds, ...spariti] } } },
    );
    for (const it of impatto.items as any[]) rimuoviImmagine(it.imagePath);

    console.log(
      `[curatore ${sessionUser(req).username}] rimossa l'opera ${artwork.name} (${qid}): ` +
        `${impatto.itemIds.length} descrizioni, ${esito.accorciate.length} visite accorciate, ` +
        `${esito.svuotate.length} rimaste senza tappe.`,
    );
    res.json({
      message: "Opera rimossa dal catalogo",
      nome: artwork.name,
      descrizioni: impatto.itemIds.length,
      visiteAccorciate: esito.accorciate,
      visiteEliminate: esito.svuotate,
      adozioni: impatto.adozioni,
    });
  } catch (error: any) {
    console.error("[BACKEND ERROR] eliminazione opera:", error);
    res.status(500).json({ error: "Errore durante la rimozione dell'opera" });
  }
});

/**
 * POST /api/artworks  { qid, museo }
 * Ritorna: l'opera creata con metadati Wikidata e posizione ricavata dalla mappa.
 */
router.post("/", async (req, res) => {
  try {
    if (!soloCuratore(req, res)) return;
    const qid = String(req.body.qid || "").trim().toUpperCase();
    const museo = String(req.body.museo || "").trim();
    if (!/^Q\d+$/.test(qid))
      return res.status(400).json({ error: "Il codice dev'essere un qid di Wikidata, come Q12418." });

    const config = findMuseumConfig(museo);
    if (!config) return res.status(404).json({ error: "Museo non configurato" });

    const gia = await ArtworkModel.findOne({ qid });
    if (gia)
      return res.status(409).json({
        error: `"${gia.name}" è già nel catalogo di questo o di un altro museo.`,
      });

    const posizione = locationsFromMap(config.mapPath).get(qid) || "";
    const creata = await populateArtwork(
      qid,
      `http://www.wikidata.org/entity/${museo}`,
      posizione,
    );
    if (!creata)
      return res.status(422).json({
        error: "Su Wikidata quest'opera non ha un'immagine (P18), quindi non si può esporre.",
      });

    const artwork = await ArtworkModel.findOne({ qid });
    const nelMuseo = await appartieneAlMuseo(qid, museo);
    console.log(
      `[curatore ${sessionUser(req).username}] aggiunta l'opera ${qid} a ${config.name}` +
        (posizione ? ` (nodo ${posizione})` : " (senza nodo sulla mappa)") +
        (nelMuseo ? "" : ": Wikidata non la dà in questa collezione"),
    );
    res.status(201).json({ artwork, sullaMappa: posizione !== "", nelMuseo });
  } catch (error: any) {
    console.error("[BACKEND ERROR] aggiunta opera:", error);
    res.status(500).json({ error: "Errore durante l'aggiunta dell'opera" });
  }
});

export default router;
