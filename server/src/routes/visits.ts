import { Router } from "express";
import { VisitModel } from "../models/visit";
import { ItemModel } from "../models/item";

const router = Router();

/**
 * GET /api/visits
 * Recupera la lista di tutte le visite disponibili nel marketplace (quella ufficiali).
 */
router.get("/", async (req, res) => {
  try {
    console.log(`[BACKEND] Chiamata GET /api/visits`);

    const visits = await VisitModel.find({});
    res.json(visits);
  } catch (error: any) {
    console.error(error);
    res
      .status(500)
      .json({ error: error.message || "Errore nel caricamento delle visite" });
  }
});

/**
 * GET /api/visits/:id
 * ritorna la visita con l'"@id" specificato
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[BACKEND] Chiamata GET /api/visits/${id}`);
    const visit = await VisitModel.findOne({ "@id": id });
    if (!visit) return res.status(404).json({ error: "Visita non trovata" });
    res.json(visit);
  } catch (err: any) {
    res.status(500).json({
      err: err.message || "Errore nel caricamento della visita richiesta",
    });
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
    res.status(500).json({
      error: err.message || "Errore nel caricamento degli item della visita",
    });
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
    console.log(
      "[BACKEND] Ricevuto payload POST /api/visits:",
      JSON.stringify(payload, null, 2),
    );

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
    console.error(
      "[BACKEND ERROR] Errore durante il salvataggio della visita:",
      error,
    );
    res
      .status(500)
      .json({ error: error.message || "Errore interno del server" });
  }
});

export default router;
