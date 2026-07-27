/**
 * Rotte dei musei.
 *
 * `/config` legge il museo dal FILE DI CONFIGURAZIONE del curatore invece che dal
 * database: e' quello il file che si modifica per adattare il navigator.
 * `/visits` filtra per chi guarda: le visite guidate non compaiono mai (ci si
 * entra con la parola chiave) e quelle a pagamento solo a chi le possiede.
 * `/qrcodes` produce il foglio stampabile da ritagliare e affiancare alle opere.
 */
import { Router } from "express";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { MuseumModel } from "../models/museum";
import { ArtworkModel } from "../models/artwork";
import { VisitModel } from "../models/visit";
import { UserModel } from "../models/user";
const router = Router();

const CONFIG_DIR = path.join(__dirname, "..", "data", "museums");

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

router.get("/:qid/config", async (req, res) => {
  try {
    const { qid } = req.params;
    const files = fs.readdirSync(CONFIG_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const raw = fs.readFileSync(path.join(CONFIG_DIR, file), "utf-8");
      const config = JSON.parse(raw);
      if (config.qid === qid) {
        config["@id"] = `http://www.wikidata.org/entity/${qid}`;
        return res.json(config);
      }
    }
    return res.status(404).json({ error: "Configurazione del museo non trovata" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nel caricamento della configurazione del museo" });
  }
});

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

router.get("/:qid/visits", async (req, res) => {
  try {
    const { qid } = req.params;
    const museumId = `http://www.wikidata.org/entity/${qid}`;
    const visits = await VisitModel.find({ ofMuseum: museumId });

    const username = String(req.query.user || "");
    let owned = new Set<string>();
    if (username) {
      const accounts = await UserModel.find({ username });
      for (const u of accounts) {
        for (const id of u.collezione || []) owned.add(id);
      }
    }

    const visible = visits.filter((v: any) => {
      if (v.accessKey) return false;
      const isFree = !v.price || Number(v.price) === 0;
      if (isFree) return true;
      if (!username) return false;
      return owned.has(v["@id"]) || v.author === username;
    });

    res.json(visible);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel caricamento delle visite del museo" });
  }
});

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
  <title>QR delle opere — ${escapeHtml(museum.name)}</title>
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
    oppure — se non può usare la fotocamera — digitare il codice stampato sotto.
  </p>
  <div class="grid">${cells.join("")}</div>
</body>
</html>`;

    res.type("html").send(html);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nella generazione dei QR" });
  }
});

export default router;
