/**
 * Rotte dei musei.
 *
 * `/overview` e `/items` sono le due letture del CURATORE: la prima da' conteggi e
 * copertura del catalogo, la seconda tutti gli item del museo — privati compresi,
 * ed e' la differenza con `GET /api/items`, che li nasconde.
 *
 * `/config` legge il museo dal FILE DI CONFIGURAZIONE del curatore invece che dal
 * database: e' quello il file che si modifica per adattare il navigator.
 * `/visits` filtra per chi guarda: le visite guidate non compaiono mai (ci si
 * entra con la parola chiave) e quelle a pagamento solo a chi le possiede.
 * `/qrcodes` produce il foglio stampabile da ritagliare e affiancare alle opere.
 * L'elenco porta i CONTEGGI di opere e visite: da quando il client scarica il
 * catalogo di un museo alla volta, non puo' piu' contare quelli che non ha.
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
import { sortByFlow } from "../services/svgGraph";
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
 * GET /api/museums: Recupera tutti i musei presenti nel database
 */

router.get("/", requireSession, async (req, res) => {
  try {
    const museums = await MuseumModel.find({}).lean();
    for (const m of museums as any[]) {
      const uri = museumUri(m.qid);
      m.opere = await ArtworkModel.countDocuments({ ofMuseum: uri });
      m.visite = await VisitModel.countDocuments({
        ofMuseum: uri,
        accessKey: { $in: [null, ""] },
      });
    }
    res.json(museums);
  } catch (err) {
    res.status(500).json({ error: "Errore nel caricamento dei musei" });
  }
});

router.get("/:qid/config", requireSession, async (req, res) => {
  try {
    const { qid } = req.params;
    const config = findMuseumConfig(qid);
    if (!config) {
      return res.status(404).json({ error: "Configurazione del museo non trovata" });
    }
    return res.json({
      ...config,
      "@id": `http://www.wikidata.org/entity/${qid}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nel caricamento della configurazione del museo" });
  }
});

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
 * Ritorna: [{name, kind}] — i soggetti che il catalogo del museo GIA' nomina,
 * cioe' gli stili e gli autori delle sue opere.
 *
 * Non c'e' niente di memorizzato: uno stile esiste finche' un'opera lo dichiara.
 * Suggeriscono un nome a chi scrive un contenuto che non parla di un'opera —
 * scritto uguale, quel contenuto e la pastiglia dello stile si ritrovano.
 */
router.get("/:qid/topics", requireSession, async (req, res) => {
  try {
    const { qid } = req.params;
    const artworks = await ArtworkModel.find({
      ofMuseum: `http://www.wikidata.org/entity/${qid}`,
    }).select("author.name style.name");

    const visti = new Set<string>();
    const topics: { name: string; kind: string }[] = [];
    for (const a of artworks) {
      const coppie = [
        { name: a.style?.name, kind: "stile" },
        { name: a.author?.name, kind: "artista" },
      ];
      for (const c of coppie) {
        // "Unknown" e gli indirizzi di nodo anonimo (`.well-known/genid/…`)
        // sono buchi di Wikidata, non nomi.
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

router.get("/:qid/visits", requireSession, async (req, res) => {
  try {
    const { qid } = req.params;
    const museumId = `http://www.wikidata.org/entity/${qid}`;
    const visits = await VisitModel.find({ ofMuseum: museumId });

    const username = sessionUser(req).username;
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

/**
 * GET /api/museums/:qid/qrcodes
 * Ritorna: il foglio stampabile, una pagina HTML.
 *
 * E' l'unica rotta del file senza `requireSession`, e non per dimenticanza: si
 * apre come pagina, quindi a chiederla e' il browser e non il nostro codice, e a
 * una navigazione non si puo' attaccare un'intestazione. Non ci si perde niente
 * — sono indirizzi di opere, e il foglio nasce per essere appeso al muro.
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

// --- Letture del curatore ---------------------------------------------------

/**
 * GET /api/museums/:qid/overview
 * Ritorna: { conteggi, copertura, account } del museo indicato.
 */
router.get("/:qid/overview", requireSession, async (req, res) => {
  try {
    const { qid } = req.params;
    const artworks = await ArtworkModel.find({ ofMuseum: museumUri(qid) });
    const items = await ItemModel.find({ ofMuseum: museumUri(qid) });
    const visits = await VisitModel.find({ ofMuseum: museumUri(qid) });

    const descritte = new Set<string>();
    const opereConTono = new Map<string, Set<string>>();
    for (const tono of educationalLevels) opereConTono.set(tono, new Set());

    let privati = 0;
    for (const it of items) {
      if (it.visibility === "privato") privati++;
      // La copertura misura le OPERE descritte: un contenuto su uno stile
      // direbbe che un'opera in piu' e' stata descritta.
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

    res.json({
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
    });
  } catch (err: any) {
    console.error("[BACKEND ERROR] overview museo:", err);
    res.status(500).json({ error: err.message || "Errore nel quadro d'insieme" });
  }
});

/**
 * GET /api/museums/:qid/items
 * Ritorna: TUTTI gli item del museo, privati compresi, con l'opera popolata.
 * E' la differenza con `GET /api/items`, che i privati li nasconde.
 */
router.get("/:qid/items", requireSession, async (req, res) => {
  try {
    const items = await ItemModel.find({
      ofMuseum: museumUri(req.params.qid),
    }).populate({
      path: "about",
      model: "Artwork",
      foreignField: "@id",
      localField: "about",
      justOne: true,
    });
    res.json(items);
  } catch (err: any) {
    console.error("[BACKEND ERROR] catalogo museo:", err);
    res.status(500).json({ error: err.message || "Errore nel catalogo" });
  }
});

export default router;
