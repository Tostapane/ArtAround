/**
 * Rotte delle opere.
 *
 * `/preview` e' quella interessante: restituisce un'opera anche se NON fa parte
 * della visita in corso (serve al QR e al codice digitato). Sceglie l'item per
 * livello e durata, ripiega sul solo livello, poi su uno qualsiasi; se l'opera non
 * ha descrizioni ne genera una con l'LLM e la salva, cosi' la volta dopo c'e'.
 */
import { Router } from "express";
import { ArtworkModel } from "../models/artwork";
import { ItemModel } from "../models/item";
import { createDescription } from "../services/llm";

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

router.get("/:qid/preview", async (req, res) => {
  try {
    const { qid } = req.params;
    const { level, duration } = req.query;

    const artwork = await ArtworkModel.findOne({ qid });
    if (!artwork) {
      return res.status(404).json({ error: "Artwork non trovato" });
    }

    const baseFilter = { about: artwork["@id"] };

    let item = null;
    if (level && duration) {
      item = await ItemModel.findOne({
        ...baseFilter,
        educationalLevel: level,
        timeRequired: String(duration),
      });
    }
    if (!item && level) {
      item = await ItemModel.findOne({ ...baseFilter, educationalLevel: level });
    }
    if (!item) {
      item = await ItemModel.findOne(baseFilter);
    }

    if (item) {
      return res.json({ artwork, item });
    }

    let usedLevel = "Intermedio";
    if (level) usedLevel = String(level);
    let usedDuration = 30;
    if (duration) usedDuration = Number(duration);

    const text = await createDescription(
      artwork.name,
      artwork.author.name,
      usedLevel,
      usedDuration,
    );
    if (!text) {
      return res.status(502).json({ error: "Impossibile generare la descrizione dell'opera" });
    }

    const generatedId = `${qid}-AI-${usedLevel}-${usedDuration}`;
    const generated = await ItemModel.findOneAndUpdate(
      { "@id": generatedId },
      {
        "@id": generatedId,
        about: artwork["@id"],
        text,
        timeRequired: String(usedDuration),
        educationalLevel: usedLevel,
        author: "AI",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.json({ artwork, item: generated });
  } catch (error: any) {
    res.status(500).json({ error: "Errore nel recupero dell'anteprima opera" });
  }
});

export default router;
