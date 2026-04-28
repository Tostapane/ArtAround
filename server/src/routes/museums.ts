import { Router } from "express";
import { MuseumModel } from "../models/museum";
import { ArtworkModel } from "../models/artwork";
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
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[BACKEND] Chiamata GET /api/museums/${id}`);
    const museum = await MuseumModel.findOne({ qid: id });
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

router.get("/:id/artworks", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[BACKEND] Chiamata GET /api/museums/${id}`);
    const museumId = `http://www.wikidata.org/entity${id}`;
    console.log(museumId);
    const artworks = await ArtworkModel.find({ ofMuseum: museumId });
    console.log(artworks);
    res.json(artworks);
  } catch (err: any) {
    res.status(500).json({
      error: "Errore nel caricamento delle opere specifiche del museo",
    });
  }
});

export default router;
