import { Router } from "express";
import { VisitModel } from "../models/visit";
import { ItemModel } from "../models/item";
import { ArtworkModel } from "../models/artwork";
import { planVisit } from "../services/llm";
import { resolveOrGenerateItem } from "../dbActions";

const router = Router();

// tetto al numero di opere di una visita su misura: limita il costo di
// generazione (ogni opera con twist e' una chiamata all'LLM).
const MAX_CUSTOM_ARTWORKS = 30;

/**
 * GET /api/visits
 * Recupera la lista di tutte le visite disponibili nel marketplace (quella ufficiali).
 */
router.get("/", async (req, res) => {
  try {
    const visits = await VisitModel.find({});
    res.json(visits);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Errore nel caricamento delle visite" });
  }
});

/**
 * GET /api/visits/:id/items
 * Ritorna gli item della visita con il rispettivo artwork (`about`) gia' popolato,
 * preservando l'ordine definito in itemListElement.
 * Evita il join lato client nel navigator.
 */
router.get("/:id/items", async (req, res) => {
  try {
    const { id } = req.params;
    const visit = await VisitModel.findOne({ "@id": id });
    if (!visit) return res.status(404).json({ error: "Visita non trovata" });

    const ids = visit.itemListElement || [];
    const items = await ItemModel.find({ "@id": { $in: ids } }).populate({
      path: "about",
      model: "Artwork",
      foreignField: "@id",
      localField: "about",
      justOne: true,
    });

    // ripristina l'ordine di itemListElement (find con $in non lo garantisce)
    const byId = new Map(items.map((it: any) => [it["@id"], it]));
    const ordered = ids.map((itemId) => byId.get(itemId)).filter(Boolean);
    res.json(ordered);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nel caricamento degli item della visita" });
  }
});

/**
 * POST /api/visits/custom
 * Crea una visita SU MISURA dai vincoli espressi dall'utente in linguaggio
 * naturale (18-33: "creazione di visite sulla base di vincoli dell'utente").
 * Body: { museumQid, request }.
 * Pipeline: catalogo del museo -> planVisit (sceglie opere/tono/durata/twist) ->
 * resolveOrGenerateItem per opera (riuso o generazione) -> visita assemblata.
 * NON persiste nulla: la visita su misura vive nel client. Risponde con
 * { visit, content } dove content e' [{ artwork, item }] gia' pronto per il
 * navigator (niente join lato client). I contenuti restano in italiano: il
 * navigator li traduce live nella lingua scelta, come per le altre visite.
 */
router.post("/custom", async (req, res) => {
  try {
    const { museumQid, request } = req.body;
    if (!museumQid || typeof request !== "string" || request.trim() === "") {
      return res.status(400).json({ error: "Parametri mancanti: museumQid e request" });
    }

    const museumId = `http://www.wikidata.org/entity/${museumQid}`;
    const artworks = await ArtworkModel.find({ ofMuseum: museumId });
    if (artworks.length === 0) {
      return res.status(404).json({ error: "Nessuna opera disponibile per questo museo" });
    }

    const catalog = artworks.map((a) => ({
      qid: a.qid,
      name: a.name,
      author: a.author.name,
      style: a.style.name,
    }));

    const plan = await planVisit(catalog, request);
    if (!plan || !Array.isArray(plan.artworks)) {
      return res.status(502).json({ error: "Impossibile generare la visita su misura" });
    }

    const byQid = new Map(artworks.map((a) => [a.qid, a]));
    const content: { artwork: unknown; item: unknown }[] = [];
    let totalSec = 0;

    // tono e durata sono gia' garantiti dagli enum dello schema di planVisit
    for (const planned of plan.artworks.slice(0, MAX_CUSTOM_ARTWORKS)) {
      const artwork = byQid.get(planned.qid);
      if (!artwork) continue;
      const durationSec = Number(planned.durationSec);
      const item = await resolveOrGenerateItem(
        artwork,
        planned.tone,
        durationSec,
        planned.twist,
      );
      if (item) {
        content.push({ artwork, item });
        totalSec += durationSec;
      }
    }

    if (content.length === 0) {
      return res.status(502).json({ error: "Impossibile generare la visita su misura" });
    }

    let name = "Visita su misura";
    if (typeof plan.name === "string" && plan.name.trim() !== "") {
      name = plan.name.trim();
    }
    const durationMin = Math.max(1, Math.round(totalSec / 60));

    const visit = {
      "@id": `custom-${museumQid}-${Date.now()}`,
      name,
      level: "Su misura",
      duration: durationMin,
      ofMuseum: museumId,
      itemListElement: content.map((c) => (c.item as any)["@id"]),
      logistics: [],
      author: "AI",
    };

    res.status(201).json({ visit, content });
  } catch (error: any) {
    console.error("[BACKEND ERROR] visita su misura:", error);
    res.status(500).json({ error: error.message || "Errore interno del server" });
  }
});

/**
 * POST /api/visits
 * Salva o aggiorna una visita (tour).
 * DA AGGIUSTARE
 */
router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    await VisitModel.findOneAndUpdate(
      { "@id": payload.id || payload["@id"] },
      {
        "@id": payload.id || payload["@id"],
        name: payload.titolo || payload.name,
        price: payload.prezzo || payload.price,
        author: payload.autore || payload.author,
        itemListElement:
          payload.percorso
            ?.filter((t: any) => t.tipo === "item")
            .map((t: any) => t.id_item) ||
          payload.itemListElement ||
          [],
        logistics:
          payload.percorso
            ?.filter((t: any) => t.tipo === "logistica")
            .map((t: any) => t.indicazione) ||
          payload.logistics ||
          [],
      },
      { upsert: true },
    );

    res.status(201).send({ message: "Visita pubblicata con successo" });
  } catch (error: any) {
    console.error("[BACKEND ERROR] Errore durante il salvataggio della visita:", error);
    res.status(500).json({ error: error.message || "Errore interno del server" });
  }
});

export default router;
