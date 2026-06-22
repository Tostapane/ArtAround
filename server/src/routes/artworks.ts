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

/**
 * GET /api/artworks/:qid/preview?level=<educationalLevel>&duration=<sec>
 * Ritorna un Match { artwork, item } per una singola opera, anche se NON fa
 * parte della visita corrente (usato dallo scanner QR del navigator). Sceglie
 * l'item che combacia con livello E durata della visita; in mancanza ripiega
 * sul solo livello, poi su uno qualsiasi. Se l'opera non ha alcun item lo genera
 * con l'LLM nel livello e nella durata richiesti (e lo persiste, cosi' da essere
 * riusato) — soddisfa il requisito 18-33 "creare item per oggetti non descritti".
 */
router.get("/:qid/preview", async (req, res) => {
  try {
    const { qid } = req.params;
    const { level, duration } = req.query;

    const artwork = await ArtworkModel.findOne({ qid });
    if (!artwork) {
      return res.status(404).json({ error: "Artwork non trovato" });
    }

    const baseFilter = { about: artwork["@id"] };

    // 1) livello + durata, 2) solo livello, 3) uno qualsiasi
    let item = null;
    if (level && duration) {
      item = await ItemModel.findOne({
        ...baseFilter,
        educationalLevel: level,
        timeRequired: `${duration}s`,
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

    // nessun item: generalo con l'LLM (livello + durata richiesti) e persistilo
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

    // @id distinto per combinazione livello+durata: ogni variante persiste a parte
    const generatedId = `${qid}-AI-${usedLevel}-${usedDuration}`;
    const generated = await ItemModel.findOneAndUpdate(
      { "@id": generatedId },
      {
        "@id": generatedId,
        about: artwork["@id"],
        text,
        timeRequired: `${usedDuration}s`,
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
