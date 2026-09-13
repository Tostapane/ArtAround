/**
 * Rotte dei musei e dell'allestimento. Viste pubbliche, biglietteria, foglio QR e
 * strumenti del curatore condividono il museo ma applicano visibilita' e
 * autorizzazioni diverse sul server.
 */
/**
 * Rotte dei musei.
 */
import { Router } from "express";
import { requireSession, sessionUser } from "../session";
import QRCode from "qrcode";
import { MuseumModel } from "../models/museum";
import { ArtworkModel } from "../models/artwork";
import { ItemModel } from "../models/item";
import { VisitModel } from "../models/visit";
import { UserModel } from "../models/user";
import { educationalLevels } from "../../../shared/constants";
import { findMuseumConfig } from "../data/museumConfigs";
import { getMuseumGraph, sortByFlow } from "../services/svgGraph";
import { rimuoviImmagine } from "./items";
import { MapLocation, MuseumOverview } from "../../../shared/types";
import { purchasedBy } from "../access";
import { conto } from "../pricing";
const router = Router();

function museumUri(qid: string): string {
  return `http://www.wikidata.org/entity/${qid}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * GET /api/museums
 * Ritorna: tutti i musei con i conteggi delle opere e delle visite pubbliche.
 */
router.get("/", requireSession, async (req, res) => {
  try {
    const museums = await MuseumModel.find({}).lean();

    const opere = await ArtworkModel.aggregate([
      { $group: { _id: "$ofMuseum", n: { $sum: 1 } } },
    ]);
    const visite = await VisitModel.aggregate([
      {
        $match: {
          accessKey: { $in: [null, ""] },
          visibility: { $ne: "privato" },
        },
      },
      { $group: { _id: "$ofMuseum", n: { $sum: 1 } } },
    ]);
    const opereDi = new Map<string, number>();
    for (const r of opere) opereDi.set(r._id, r.n);
    const visiteDi = new Map<string, number>();
    for (const r of visite) visiteDi.set(r._id, r.n);

    for (const m of museums as any[]) {
      const uri = museumUri(m.qid);
      m.opere = opereDi.get(uri) || 0;
      m.visite = visiteDi.get(uri) || 0;
    }
    res.json(museums);
  } catch (err) {
    res.status(500).json({ error: "Errore nel caricamento dei musei" });
  }
});

/**
 * GET /api/museums/:qid/config
 * Ritorna: l'allestimento del curatore letto dal file, non il documento del database.
 */
router.get("/:qid/config", requireSession, async (req, res) => {
  try {
    const { qid } = req.params;
    const config = findMuseumConfig(qid);
    if (!config) {
      return res.status(404).json({ error: "Configurazione del museo non trovata" });
    }
    const mapLocations: Record<string, MapLocation> = {};
    for (const node of getMuseumGraph(config.mapPath).nodes) {
      if (node.kind !== "artwork" || !node.elementId) continue;
      mapLocations[node.elementId] = {
        room: node.room,
        floor: node.floor,
        tone: node.roomTone,
      };
    }
    return res.json({
      ...config,
      "@id": `http://www.wikidata.org/entity/${qid}`,
      mapLocations,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nel caricamento della configurazione del museo" });
  }
});

/**
 * GET /api/museums/:qid/artworks
 * Ritorna: le opere del museo, nell'ordine di percorrenza della sua pianta.
 */
router.get("/:qid/artworks", requireSession, async (req, res) => {
  try {
    const { qid } = req.params;
    const museumId = `http://www.wikidata.org/entity/${qid}`;
    const artworks = await ArtworkModel.find({ ofMuseum: museumId });
    const doc = await MuseumModel.findOne({ qid });
    res.json(sortByFlow(artworks, doc ? doc.mapPath : ""));
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel caricamento delle opere specifiche del museo" });
  }
});

/**
 * GET /api/museums/:qid/topics
 * Ritorna: [{name, kind}], cioe' stili e autori gia' nominati dal catalogo.
 */
router.get("/:qid/topics", requireSession, async (req, res) => {
  try {
    const { qid } = req.params;
    const artworks = await ArtworkModel.find({
      ofMuseum: `http://www.wikidata.org/entity/${qid}`,
    })
      .select("author.name style.name")
      .lean();

    const visti = new Set<string>();
    const topics: { name: string; kind: string }[] = [];
    for (const a of artworks) {
      const coppie = [
        { name: a.style?.name, kind: "stile" },
        { name: a.author?.name, kind: "artista" },
      ];
      for (const c of coppie) {
        if (!c.name || c.name === "Unknown" || c.name.startsWith("http")) continue;
        const chiave = `${c.kind}:${c.name}`;
        if (visti.has(chiave)) continue;
        visti.add(chiave);
        topics.push({ name: c.name, kind: c.kind });
      }
    }

    topics.sort((a, b) => a.name.localeCompare(b.name));
    res.json(topics);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel caricamento dei soggetti del museo" });
  }
});

/**
 * GET /api/museums/:qid/visits
 * Ritorna: le visite percorribili da chi chiama; esclude guidate, private altrui e acquisti mancanti.
 */
router.get("/:qid/visits", requireSession, async (req, res) => {
  try {
    const { qid } = req.params;
    const museumId = `http://www.wikidata.org/entity/${qid}`;
    const username = sessionUser(req).username;
    const visits = await VisitModel.find({
      ofMuseum: museumId,
      $or: [{ visibility: { $ne: "privato" } }, { author: username }],
    });

    const owned = await purchasedBy(username);

    const visible = visits.filter((v: any) => {
      if (v.accessKey) return false;
      const isFree = !v.price || Number(v.price) === 0;
      if (isFree) return true;
      if (!username) return false;
      return owned.has(v["@id"]) || v.author === username;
    });

    const ids = new Set<string>();
    for (const v of visible) {
      for (const id of v.itemListElement || []) ids.add(id);
    }
    const tappe = await ItemModel.find({ "@id": { $in: Array.from(ids) } }).lean();
    const byId = new Map<string, any>();
    for (const t of tappe) byId.set(t["@id"], t);

    res.json(
      visible.map((v: any) => {
        const c = conto(v, username, owned, byId);
        return {
          ...v.toObject(),
          mancanti: c.mancanti,
          costoMancanti: c.costoMancanti,
          totale: c.totale,
        };
      }),
    );
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel caricamento delle visite del museo" });
  }
});

/**
 * GET /api/museums/:qid/qrcodes
 * Ritorna: il foglio stampabile, una pagina HTML.
 */
router.get("/:qid/qrcodes", async (req, res) => {
  try {
    const { qid } = req.params;
    const museum = await MuseumModel.findOne({ qid });
    if (!museum) return res.status(404).json({ error: "Museo non trovato" });

    const museumId = `http://www.wikidata.org/entity/${qid}`;
    const artworks = await ArtworkModel.find({ ofMuseum: museumId });

    const cells: string[] = [];
    for (const art of artworks) {
      const svg = await QRCode.toString(art.qid, { type: "svg", margin: 1 });
      cells.push(
        `<figure class="cell">
           <div class="qr">${svg}</div>
           <figcaption>
             <strong>${escapeHtml(art.name)}</strong>
             <span class="codice">${escapeHtml(art.qid)}</span>
             <span class="istruzione">Inquadra il QR, oppure scrivi il codice nell'app</span>
           </figcaption>
         </figure>`,
      );
    }

    const html = `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <title>QR delle opere di ${escapeHtml(museum.name)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
           margin: 24px; color: #111; background: #fff; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .nota { font-size: 13px; color: #444; margin: 0 0 20px; max-width: 60ch; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .cell { border: 1px solid #333; border-radius: 6px; padding: 12px;
            text-align: center; break-inside: avoid; }
    .qr svg { width: 100%; height: auto; }
    figcaption strong { display: block; font-size: 13px; margin-top: 10px;
                        line-height: 1.25; }
    .codice { display: block; margin-top: 8px; padding: 4px 0;
              font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
              font-size: 22px; font-weight: 700; letter-spacing: 0.06em;
              color: #000; border-top: 1px solid #333; }
    .istruzione { display: block; font-size: 10px; color: #444; margin-top: 2px; }
    @media print {
      body { margin: 10mm; }
      .nota { display: none; }
    }
  </style>
</head>
<body>
  <h1>Opere di ${escapeHtml(museum.name)}</h1>
  <p class="nota">
    Ritaglia e affianca ogni riquadro alla sua opera. Il visitatore può inquadrare il QR
    oppure, se non può usare la fotocamera, digitare il codice stampato sotto.
  </p>
  <div class="grid">${cells.join("")}</div>
</body>
</html>`;

    res.type("html").send(html);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nella generazione dei QR" });
  }
});

// --- Letture del curatore ---------------------------------------------------

/**
 * GET /api/museums/:qid/overview
 * Ritorna: { conteggi, copertura, account } del museo indicato. Solo il curatore.
 */
router.get("/:qid/overview", requireSession, async (req, res) => {
  try {
    if (sessionUser(req).role !== "curatore")
      return res
        .status(403)
        .json({ error: "Solo il curatore può vedere il quadro d'insieme." });
    const { qid } = req.params;
    const artworks = await ArtworkModel.find({ ofMuseum: museumUri(qid) }).lean();
    const items = await ItemModel.find({ ofMuseum: museumUri(qid) }).lean();
    const visits = await VisitModel.find({ ofMuseum: museumUri(qid) }).lean();

    const descritte = new Set<string>();
    const opereConTono = new Map<string, Set<string>>();
    for (const tono of educationalLevels) opereConTono.set(tono, new Set());

    let privati = 0;
    for (const it of items) {
      if (it.visibility === "privato") privati++;
      if (!it.about) continue;
      descritte.add(it.about);
      const perTono = opereConTono.get(it.educationalLevel);
      if (perTono) perTono.add(it.about);
    }

    const senzaDescrizione = [];
    for (const a of artworks) {
      if (!descritte.has(a["@id"]))
        senzaDescrizione.push({ qid: a.qid, name: a.name });
    }

    const perTono = educationalLevels.map((tono) => ({
      tono,
      opere: opereConTono.get(tono)!.size,
    }));

    let guidate = 0;
    for (const v of visits) {
      if (v.accessKey) guidate++;
    }

    const autori = await UserModel.countDocuments({ role: "autore" });
    const visitatori = await UserModel.countDocuments({ role: "visitatore" });
    const curatori = await UserModel.countDocuments({ role: "curatore" });

    const quadro: MuseumOverview = {
      conteggi: {
        opere: artworks.length,
        item: items.length,
        itemPrivati: privati,
        visite: visits.length,
        visiteGuidate: guidate,
      },
      copertura: {
        opereTotali: artworks.length,
        senzaDescrizione,
        perTono,
      },
      account: { autori, visitatori, curatori },
    };
    res.json(quadro);
  } catch (err: any) {
    console.error("[BACKEND ERROR] overview museo:", err);
    res.status(500).json({ error: err.message || "Errore nel quadro d'insieme" });
  }
});

/**
 * GET /api/museums/:qid/items
 * Ritorna: tutti gli item, privati compresi, senza testo e con opera popolata. Solo il curatore.
 */
router.get("/:qid/items", requireSession, async (req, res) => {
  try {
    if (sessionUser(req).role !== "curatore")
      return res
        .status(403)
        .json({ error: "Solo il curatore può vedere il catalogo del museo." });

    const items = await ItemModel.find({
      ofMuseum: museumUri(req.params.qid),
    })
      .select("-text")
      .populate({
        path: "about",
        model: "Artwork",
        foreignField: "@id",
        localField: "about",
        justOne: true,
      })
      .lean();
    res.json(items);
  } catch (err: any) {
    console.error("[BACKEND ERROR] catalogo museo:", err);
    res.status(500).json({ error: err.message || "Errore nel catalogo" });
  }
});

/**
 * DELETE /api/museums/:qid/contents
 * Svuota il catalogo indicato senza eliminare museo o immagini delle opere. Solo il curatore;
 * ritorna i conteggi della cascata.
 */
router.delete("/:qid/contents", requireSession, async (req, res) => {
  try {
    const chi = sessionUser(req);
    if (chi.role !== "curatore")
      return res
        .status(403)
        .json({ error: "Solo il curatore può svuotare il catalogo di un museo." });

    const { qid } = req.params;
    const config = findMuseumConfig(qid);
    if (!config)
      return res.status(404).json({ error: "Museo non configurato" });

    const uri = museumUri(qid);
    const items = await ItemModel.find({ ofMuseum: uri }).select("@id imagePath");
    const visits = await VisitModel.find({ ofMuseum: uri }).select("@id");
    const itemIds = items.map((i: any) => i["@id"]);
    const visitIds = visits.map((v: any) => v["@id"]);

    await ItemModel.deleteMany({ ofMuseum: uri });
    await VisitModel.deleteMany({ ofMuseum: uri });
    const opere = await ArtworkModel.deleteMany({ ofMuseum: uri });
    await UserModel.updateMany(
      {},
      { $pull: { collezione: { $in: [...itemIds, ...visitIds] } } },
    );
    for (const it of items as any[]) rimuoviImmagine(it.imagePath);

    console.log(
      `[curatore ${chi.username}] svuotato ${config.name} (${qid}): ` +
        `${opere.deletedCount} opere, ${itemIds.length} item, ${visitIds.length} visite.`,
    );
    res.json({
      message: "Catalogo del museo svuotato",
      museo: config.name,
      opere: opere.deletedCount,
      item: itemIds.length,
      visite: visitIds.length,
    });
  } catch (err: any) {
    console.error("[BACKEND ERROR] svuotamento museo:", err);
    res.status(500).json({ error: err.message || "Errore nello svuotamento" });
  }
});

export default router;
