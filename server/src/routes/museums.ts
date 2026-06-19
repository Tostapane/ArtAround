import { Router } from "express";
import { MuseumModel } from "../models/museum";
import { ArtworkModel } from "../models/artwork";
import { VisitModel } from "../models/visit";
const router = Router();

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
    console.log(`[BACKEND] Chiamata GET /api/museums/${qid}`);
    const museum = await MuseumModel.findOne({ qid });
    if (!museum) return res.status(404).json({ error: "Museo non trovato" });
    res.json(museum);
  } catch (err: any) {
    res.status(500).json({
      err: err.message || "Errore nel caricamento del museo richiesto",
    });
  }
});

/**
 * GET /api/museums/:id/artworks
 * ritorna tutte le opere che sono presenti in quel museo
 */

router.get("/:qid/artworks", async (req, res) => {
  try {
    const { qid } = req.params;
    console.log(`[BACKEND] Chiamata GET /api/museums/${qid}/artworks`);
    const museumId = `http://www.wikidata.org/entity/${qid}`;
    const artworks = await ArtworkModel.find({ ofMuseum: museumId });
    res.json(artworks);
  } catch (err: any) {
    res.status(500).json({
      error: "Errore nel caricamento delle opere specifiche del museo",
    });
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
    res.status(500).json({
      error: "Errore nel caricamento delle visite del museo",
    });
  }
});

export default router;
