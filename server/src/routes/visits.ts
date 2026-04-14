import { Router } from "express";
import { VisitModel } from "../models/visit";

const router = Router();

/**
 * GET /api/visits
 * Recupera la lista di tutte le visite disponibili nel marketplace.
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
    res
      .status(500)
      .json({
        err: err.message || "Errore nel caricamento della visita richiesta",
      });
  }
});
/**
 * POST /api/visits
 * Salva o aggiorna una visita (tour).
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
            ?.filter((t: any) => t.tipo === "logistics")
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
