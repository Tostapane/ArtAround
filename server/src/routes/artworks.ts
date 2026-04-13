import { Router } from "express";
import { ArtworkModel } from "../models/artwork";
import { ItemModel } from "../models/item";

const router = Router();

/**
 * GET /api/artworks: Recupera tutte le opere d'arte dal database.
 * Usato dalla mappa e dalla galleria principale del marketplace.
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

/**
 * GET /api/artworks/:id/items: Recupera tutti i contenuti (descrizioni/audioguide)
 * associati a una specifica opera.
 */
router.get("/:id/items", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[BACKEND] Recupero item per l'opera: ${id}`);

    // Cerco l'artwork per ID (MongoDB) o per wikiDataUri
    const artwork = await ArtworkModel.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { wikiDataUri: id }],
    });

    if (!artwork) {
      return res.status(404).json({ error: "Artwork non trovato" });
    }

    // Trovo tutti gli item associati a questo artwork
    const items = await ItemModel.find({ about: artwork._id });
    
    // Raggruppo gli item per autore
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
        tono: item.educationalLevel,
        educationalLevel: item.educationalLevel,
        lunghezza: item.timeRequired,
        timeRequired: item.timeRequired,
        testo: item.text || "",
        text: item.text || "",
      });
    });

    res.json(Array.from(groupedByAuthor.values()));
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Errore nel recupero degli item" });
  }
});

export default router;
