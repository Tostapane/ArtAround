import { Router } from "express";
import { ArtworkModel } from "../models/artwork";
import { ItemModel } from "../models/item";

const router = Router();

/**
 * GET /api/artworks: Recupera tutte le opere d'arte dal database.
 */
router.get("/", async (req, res) => {
  try {
    const artworks = await ArtworkModel.find({});
    res.json(artworks);
  } catch (error: any) {
    res.status(500).json({ error: "Errore nel caricamento delle opere" });
  }
});

/**
 * GET /api/artworks/:qid/items: Recupera gli Item associati a un artwork (per QID).
 * Filtri opzionali: ?level=<educationalLevel>&duration=<timeRequired>
 * Ritorna un Item[] canonico (niente formati ad-hoc / bilingue).
 */
router.get("/:qid/items", async (req, res) => {
  try {
    const { qid } = req.params;
    const { level, duration } = req.query;

    const artwork = await ArtworkModel.findOne({ qid });
    if (!artwork) {
      return res.status(404).json({ error: "Artwork non trovato" });
    }

    const filter: Record<string, unknown> = { about: artwork["@id"] };
    if (level) filter.educationalLevel = level;
    if (duration) filter.timeRequired = String(duration);

    const items = await ItemModel.find(filter);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: "Errore nel recupero degli item" });
  }
});

export default router;
