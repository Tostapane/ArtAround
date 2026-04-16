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
 * GET /api/artworks/:qid/items: Recupera tutti i contenuti associati a un QID.
 */
router.get("/:qid/items", async (req, res) => {
  try {
    const { qid } = req.params;
    const artwork = await ArtworkModel.findOne({ qid });

    if (!artwork) {
      return res.status(404).json({ error: "Artwork non trovato" });
    }

    const items = await ItemModel.find({ about: artwork["@id"] });
    
    const groupedByAuthor = new Map();
    items.forEach((item: any) => {
      if (!groupedByAuthor.has(item.author)) {
        groupedByAuthor.set(item.author, {
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          "@id": item["@id"],
          autore: item.author,
          author: item.author,
          prezzo: item.price || 0,
          price: item.price || 0,
          descrizioni: [],
        });
      }
      groupedByAuthor.get(item.author).descrizioni.push({
        educationalLevel: item.educationalLevel,
        timeRequired: item.timeRequired,
        text: item.text || "",
      });
    });

    res.json(Array.from(groupedByAuthor.values()));
  } catch (error: any) {
    res.status(500).json({ error: "Errore nel recupero degli item" });
  }
});

export default router;
