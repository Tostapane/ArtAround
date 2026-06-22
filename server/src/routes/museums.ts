import { Router } from "express";
import QRCode from "qrcode";
import { MuseumModel } from "../models/museum";
import { ArtworkModel } from "../models/artwork";
import { VisitModel } from "../models/visit";
const router = Router();

// minima escape per inserire testo dal DB nell'HTML stampabile dei QR
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * GET /api/museums: Recupera tutti i musei presenti nel database
 */

router.get("/", async (req, res) => {
  try {
    const museums = await MuseumModel.find({});
    res.json(museums);
  } catch (err) {
    res.status(500).json({ error: "Errore nel caricamento dei musei" });
  }
});

/**
 * GET /api/museums/:id
 * ritorna il museo con l'"@id" specificato
 */
router.get("/:qid", async (req, res) => {
  try {
    const { qid } = req.params;
    const museum = await MuseumModel.findOne({ qid });
    if (!museum) return res.status(404).json({ error: "Museo non trovato" });
    res.json(museum);
  } catch (err: any) {
    res.status(500).json({ err: err.message || "Errore nel caricamento del museo richiesto" });
  }
});

/**
 * GET /api/museums/:id/artworks
 * ritorna tutte le opere che sono presenti in quel museo
 */

router.get("/:qid/artworks", async (req, res) => {
  try {
    const { qid } = req.params;
    const museumId = `http://www.wikidata.org/entity/${qid}`;
    const artworks = await ArtworkModel.find({ ofMuseum: museumId });
    res.json(artworks);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel caricamento delle opere specifiche del museo" });
  }
});

/**
 * GET /api/museums/:qid/visits
 * ritorna tutte le visite associate a quel museo
 */
router.get("/:qid/visits", async (req, res) => {
  try {
    const { qid } = req.params;
    const museumId = `http://www.wikidata.org/entity/${qid}`;
    const visits = await VisitModel.find({ ofMuseum: museumId });
    res.json(visits);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel caricamento delle visite del museo" });
  }
});

/**
 * GET /api/museums/:qid/qrcodes
 * Pagina HTML stampabile con un QR per ogni opera del museo. Il payload del QR
 * e' il qid nudo dell'opera (es. "Q12345"): lo scanner in-app del navigator lo
 * decodifica e imposta la posizione corrente. Il curatore stampa questo foglio,
 * ritaglia i QR e li affianca alle opere ("foglio di carta" della specifica 18-33).
 * Completamente generico: un nuovo museo ottiene il suo foglio senza codice ad-hoc.
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
             <span>${escapeHtml(art.qid)}</span>
           </figcaption>
         </figure>`,
      );
    }

    const html = `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <title>QR opere — ${escapeHtml(museum.name)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; }
    h1 { font-size: 18px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .cell { border: 1px solid #ccc; border-radius: 8px; padding: 12px; text-align: center; break-inside: avoid; }
    .qr svg { width: 100%; height: auto; }
    figcaption strong { display: block; font-size: 13px; margin-top: 8px; }
    figcaption span { display: block; font-size: 11px; color: #666; }
    @media print { .grid { grid-template-columns: repeat(3, 1fr); } }
  </style>
</head>
<body>
  <h1>QR delle opere — ${escapeHtml(museum.name)} (${escapeHtml(museum.qid)})</h1>
  <div class="grid">${cells.join("")}</div>
</body>
</html>`;

    res.type("html").send(html);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nella generazione dei QR" });
  }
});

export default router;
