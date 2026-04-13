import { Router } from "express";
import { VisitModel } from "../models/visit";

const router = Router();

/**
 * GET /api/visits
 * Recupera la lista di tutte le visite (tour) disponibili nel marketplace.
 */
router.get("/", async (req, res) => {
  try {
    console.log(`[BACKEND] Chiamata GET /api/visits`);

    const visits = await VisitModel.find({}); 

    const transformedVisits = visits.map((v) => {
      const items: any[] = v.itemListElement.map((id) => ({
        tipo: "item",
        id_item: id,
      }));
      const logistics: any[] = v.logistics.map((l) => ({
        tipo: "logistica",
        indicazione: l,
      }));

      return {
        // Campi JSON-LD (Schema.org)
        "@context": v["@context"] || "https://schema.org",
        "@type": v["@type"] || "ItemList",
        "@id": v["@id"] || v._id.toString(),
        
        // Campi per il Marketplace (Comodità)
        id: v["@id"] || v._id.toString(),
        titolo: v.name,
        name: v.name,
        autore: v.author || "Sistema",
        author: v.author,
        prezzo: v.price || 0,
        price: v.price || 0,
        tipo: "Visita",
        percorso: [...items, ...logistics],
        itemListElement: v.itemListElement,
        logistics: v.logistics
      };
    });

    res.json(transformedVisits);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Errore nel caricamento delle visite" });
  }
});

/**
 * POST /api/visits
 * Salva o aggiorna una visita (tour).
 */
router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    console.log("[BACKEND] Ricevuto payload POST /api/visits:", JSON.stringify(payload, null, 2));

    await VisitModel.findOneAndUpdate(
      { "@id": payload.id || payload["@id"] },
      {
        "@id": payload.id || payload["@id"],
        name: payload.titolo || payload.name,
        price: payload.prezzo || payload.price,
        author: payload.autore || payload.author,
        itemListElement: payload.percorso?.filter((t: any) => t.tipo === "item").map((t: any) => t.id_item) || payload.itemListElement || [],
        logistics: payload.percorso?.filter((t: any) => t.tipo === "logistics").map((t: any) => t.indicazione) || payload.logistics || [],
      },
      { upsert: true }
    );

    res.status(201).send({ message: "Visita pubblicata con successo" });
  } catch (error: any) {
    console.error("[BACKEND ERROR] Errore durante il salvataggio della visita:", error);
    res.status(500).json({ error: error.message || "Errore interno del server" });
  }
});

export default router;
