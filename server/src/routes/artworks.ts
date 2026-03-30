import { Router } from "express";
import { ArtworkModel } from "../models/artwork";

const router = Router();

/**
 * GET: Recupera tutte le opere d'arte dal database.
 */
router.get("/", async (req, res) => {
  try {
    console.log(`[BACKEND] Chiamata GET /api/artworks`);
    const artworks = await ArtworkModel.find({});
    res.json(artworks);
  } catch (error: any) {
    console.error(error);
    res
      .status(500)
      .json({ error: error.message || "Errore nel caricamento delle opere" });
  }
});

export default router;
