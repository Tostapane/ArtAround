import { Router } from "express";
import { ItemModel } from "../models/item";
import { ArtworkModel } from "../models/artwork";

const router = Router();

/**
 * GET /api/items/author/:authorName
 * Recupera tutti i contenuti creati da un autore specifico.
 */
router.get("/author/:authorName", async (req, res) => {
  try {
    const { authorName } = req.params;
    const items = await ItemModel.find({ author: authorName }).populate("about");
    res.json(items);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Errore nel recupero dei tuoi contenuti" });
  }
});

/**
 * POST /api/items
 * Crea o aggiorna un contenuto (CreativeWork / Item).
 */
router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    console.log("[BACKEND] Ricevuto payload POST /api/items:", JSON.stringify(payload, null, 2));

    // Supporto formato Marketplace (tipo: "Item")
    if (payload.tipo === "Item") {
      const artwork = await ArtworkModel.findOne({ wikiDataUri: payload.id_oper_universale });
      if (!artwork) return res.status(400).json({ error: "Artwork non trovato nel database." });

      // Elimino versioni precedenti dello stesso autore per quell'opera per aggiornamento
      await ItemModel.deleteMany({ about: artwork._id, author: payload.autore });

      for (const desc of payload.descrizioni) {
        const itemId = `${artwork.wikiDataUri}-${payload.autore}-${desc.tono}-${desc.lunghezza}`;
        await ItemModel.create({
          "@id": itemId,
          about: artwork._id,
          timeRequired: desc.lunghezza,
          educationalLevel: desc.tono,
          author: payload.autore,
          price: payload.prezzo,
          text: desc.testo,
        });
      }
    } 
    // Supporto formato Schema.org (CreativeWork)
    else if (payload["@type"] === "CreativeWork") {
      let artworkIdString = typeof payload.about === "object" ? payload.about["@id"] : payload.about;
      const artwork = await ArtworkModel.findOne({ $or: [{ wikiDataUri: artworkIdString }, { "@id": artworkIdString }] });
      if (!artwork) return res.status(400).json({ error: "Artwork non trovato." });

      payload.about = artwork._id;
      await ItemModel.create(payload);
    }

    res.status(201).send({ message: "Contenuto pubblicato con successo" });
  } catch (error: any) {
    console.error("[BACKEND ERROR] Errore salvataggio item:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/items/batch
 * Recupero massivo di item per ID.
 */
router.post("/batch", async (req, res) => {
  try {
    const idsArray = req.body.ids;
    const items = await ItemModel.find({ "@id": { $in: idsArray } });
    res.json(items);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Errore nel caricamento batch" });
  }
});

export default router;
