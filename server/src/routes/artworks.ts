/**
 * Rotte delle opere.
 *
 * `/preview` e' quella interessante: restituisce un'opera anche se NON fa parte
 * della visita in corso (serve al QR e al codice digitato). Sceglie l'item per
 * livello e durata, ripiega sul solo livello, poi su uno qualsiasi; se l'opera non
 * ha descrizioni ne genera una con l'LLM e la salva, cosi' la volta dopo c'e'.
 *
 * `/:qid/items` e' l'altra meta' di `GET /items/metadata`: quella porta tutto il
 * catalogo senza i testi, questa i testi di UNA sola opera, quando qualcuno la
 * apre davvero. I testi sono il 74% del peso del catalogo e quasi nessuno li
 * legge tutti.
 */
import { Router } from "express";
import { ArtworkModel } from "../models/artwork";
import { ItemModel } from "../models/item";
import { createDescription } from "../services/llm";
import { purchasedBy, isReadable, withoutText, readableItems } from "../access";

const router = Router();

/**
 * GET /api/artworks[?museum=Qxxx]
 * Ritorna: le opere del museo indicato, o tutte se il parametro manca.
 */
router.get("/", async (req, res) => {
  try {
    const museum = String(req.query.museum || "");
    const filter = museum
      ? { ofMuseum: `http://www.wikidata.org/entity/${museum}` }
      : {};
    const artworks = await ArtworkModel.find(filter);
    res.json(artworks);
  } catch (error: any) {
    res.status(500).json({ error: "Errore nel caricamento delle opere" });
  }
});

/**
 * GET /api/artworks/:qid/items[?user=nome]
 * Ritorna: le descrizioni PUBBLICHE di quell'opera, col testo (protetto dalla
 * regola di `access.ts`: si legge se e' gratuito, se l'hai scritto o comprato).
 * E' la meta' "pesante" del catalogo, chiesta un'opera alla volta.
 */
router.get("/:qid/items", async (req, res) => {
  try {
    const { qid } = req.params;
    const artwork = await ArtworkModel.findOne({ qid });
    if (!artwork) return res.status(404).json({ error: "Artwork non trovato" });

    const items = await ItemModel.find({
      about: artwork["@id"],
      visibility: { $ne: "privato" },
    });
    const user = String(req.query.user || "");
    const owned = await purchasedBy(user);
    res.json(readableItems(items, user, owned));
  } catch (error: any) {
    res.status(500).json({ error: "Errore nel recupero delle descrizioni dell'opera" });
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
      const user = String(req.query.user || "");
      const owned = await purchasedBy(user);
      if (!isReadable(item, user, owned)) {
        return res.json({ artwork, item: withoutText(item) });
      }
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
