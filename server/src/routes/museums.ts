import { Router } from "express";
import { MuseumModel } from "../models/museum";

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
