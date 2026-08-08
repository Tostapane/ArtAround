/**
 * Rotte delle opere.
 *
 * `/preview` e' quella interessante: restituisce un'opera anche se NON fa parte
 * della visita in corso (serve al QR e al codice digitato). Sceglie l'item per
 * livello e durata, ripiega sul solo livello, poi su uno qualsiasi; se l'opera non
 * ha descrizioni ne genera una con l'LLM e la salva, cosi' la volta dopo c'e'.
 *
 * `/:qid/items` e' l'altra meta' di `GET /items/metadata`: quella porta tutto il
 * catalogo senza i testi, questa i testi di una sola opera, quando qualcuno la
 * apre davvero. I testi sono la parte piu' pesante del catalogo e quasi nessuno
 * li legge tutti, quindi si mandano su richiesta.
 *
 * Le ultime tre rotte sono del curatore e cambiano il catalogo: aggiungono
 * un'opera al museo e la tolgono. Due avvertenze su come toglierla.
 *
 * NON usare `dbActions.deleteArtwork`: cancella il documento dell'opera e basta,
 * lasciando in giro le descrizioni che la raccontano e le visite che le citano.
 * Una tappa che non si risolve non da' errore, semplicemente non compare, quindi
 * il danno resta invisibile fino a quando qualcuno apre quella visita. La
 * cascata sta qui sotto ed e' la stessa di `DELETE /items/:id`, allargata
 * all'opera: le sue descrizioni spariscono, le visite che le citano si
 * ACCORCIANO invece di sparire (`dbActions.rimuoviTappeDalleVisite`), e le righe
 * nelle collezioni di chi le aveva prese se ne vanno con quel che e' sparito
 * davvero. Una visita se ne va solo se resta senza tappe.
 *
 * Chi aggiunge un'opera scrive solo il suo qid: il resto lo dice Wikidata, e
 * DOVE sta lo dice la mappa. Un qid che sulla pianta non ha un nodo entra lo
 * stesso, senza posizione: si legge nel catalogo ma non compare sulla piantina
 * (vedi `locationsFromMap` in `manager.ts`). Aggiungerla non crea descrizioni,
 * che costano una chiamata al modello l'una: le scrive il seed, che salta le
 * opere gia' presenti, oppure un autore.
 *
 * `soloCuratore` e' la guardia delle tre rotte che cambiano il catalogo.
 * `impattoOpera` conta che cosa se ne andrebbe — le descrizioni, le visite che
 * la citano e, fra queste, quelle che resterebbero SENZA tappe — e non scrive
 * niente: lo chiamano sia il preventivo sia l'eliminazione, cosi' i due contano
 * la stessa cosa. Quale delle due strade prendere lo decide il CURATORE, perche'
 * e' una scelta di curatela e non una conseguenza tecnica.
 *
 * Nell'eliminazione se ne vanno anche le immagini caricate a mano, che
 * appartengono alla descrizione e a nient'altro. Quella dell'opera resta: e' la
 * copia locale di Wikidata, e riscaricarla costa una richiesta per opera (vedi
 * `DELETE /museums/:qid/contents`).
 *
 * In `POST /` lo stesso qid non puo' stare in due musei: l'`@id` di una
 * descrizione e' `qid-autore-tono-durata`, e il museo li' dentro non compare.
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
import { rimuoviTappeDalleVisite } from "../dbActions";
import { rimuoviImmagine } from "./items";

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
 * Ritorna: le descrizioni PUBBLICHE di quell'opera, col testo (protetto dalla
 * regola di `access.ts`: si legge se e' gratuito, se l'hai scritto o comprato).
 * E' la meta' "pesante" del catalogo, chiesta un'opera alla volta.
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
 * Ritorna: { artwork, item } per un'opera QUALUNQUE, anche fuori dalla visita in
 * corso (serve al QR e al codice digitato). Sceglie la descrizione per tono e
 * durata, ripiega sul solo tono, poi su una qualsiasi; se l'opera non ne ha
 * nessuna ne genera una col modello e la salva, cosi' la volta dopo c'e'. 502 se
 * il modello non risponde.
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
 * Ritorna: { descrizioni, visite[], adozioni }, cioe' cosa sparirebbe togliendo
 * l'opera. Serve a dichiararlo prima di chiedere conferma. Non scrive nulla.
 */
router.get("/:qid/impact", async (req, res) => {
  try {
    if (!soloCuratore(req, res)) return;
    const { qid } = req.params;
    const artwork = await ArtworkModel.findOne({ qid });
    if (!artwork) return res.status(404).json({ error: "Opera non trovata" });

    const impatto = await impattoOpera(artwork["@id"]);
    res.json({
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
    });
  } catch (error: any) {
    console.error("[BACKEND ERROR] impatto eliminazione opera:", error);
    res.status(500).json({ error: "Errore nel calcolo dell'impatto" });
  }
});

/**
 * DELETE /api/artworks/:qid[?visite=accorcia|elimina]
 * Ritorna: { descrizioni, visiteAccorciate[], visiteEliminate[], adozioni }.
 * Toglie l'opera dal museo con le descrizioni che la raccontano. `visite` dice
 * che fare di quelle che la citano: "accorcia" (predefinito) toglie la tappa e
 * lascia in piedi il resto del percorso, "elimina" le butta via intere. Una
 * visita che resterebbe senza tappe sparisce in entrambi i casi.
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
        : await rimuoviTappeDalleVisite(impatto.itemIds, [artwork.name]);
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
 * Ritorna: l'opera creata. Il qid e' di Wikidata; nome, autore, stile e immagine
 * arrivano da li', la posizione dalla mappa del museo.
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
        (nelMuseo ? "" : " — Wikidata non la dà in questa collezione"),
    );
    res.status(201).json({ artwork, sullaMappa: posizione !== "", nelMuseo });
  } catch (error: any) {
    console.error("[BACKEND ERROR] aggiunta opera:", error);
    res.status(500).json({ error: "Errore durante l'aggiunta dell'opera" });
  }
});

export default router;
