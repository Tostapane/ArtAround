/**
 * Rotte dei contenuti (item).
 *
 * L'elenco pubblico esclude gli item privati, che esistono solo per le visite
 * guidate del loro autore. In creazione un autore puo' pubblicare UN solo item per
 * coppia (opera, tono): i duplicati vengono rifiutati invece di sovrascrivere in
 * silenzio. In modifica cambiano solo testo e prezzo — opera, tono, durata,
 * licenza e visibilita' formano l'identita' o i diritti di chi l'ha gia' adottato.
 */
import { Router } from "express";
import { ItemModel } from "../models/item";
import { ArtworkModel } from "../models/artwork";

const router = Router();

/**
 * GET /api/items
 * Recupera TUTTI gli item (contenuti) con l'artwork (`about`) popolato.
 * Usato dal marketplace del visitatore per mostrare i singoli item in vendita
 * (il filtro per museo avviene lato client tramite `about.ofMuseum`).
 */
router.get("/", async (req, res) => {
  try {
    const items = await ItemModel.find({
      visibility: { $ne: "privato" },
    }).populate({
      path: "about",
      model: "Artwork",
      foreignField: "@id",
      localField: "about",
      justOne: true,
    });
    res.json(items);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Errore nel recupero degli item" });
  }
});

router.get("/author/:authorName", async (req, res) => {
  try {
    const { authorName } = req.params;
    const items = await ItemModel.find({ author: authorName }).populate({
      path: "about",
      model: "Artwork",
      foreignField: "@id",
      localField: "about",
      justOne: true,
    });
    res.json(items);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Errore nel recupero dei tuoi contenuti" });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = req.body;

    if (payload.tipo === "Item") {
      const artwork = await ArtworkModel.findOne({
        $or: [
          { "@id": payload.id_oper_universale },
          { qid: payload.id_oper_universale },
          { wikiDataUri: payload.id_oper_universale },
        ],
      });
      if (!artwork)
        return res.status(400).json({ error: "Artwork non trovato nel database." });

      const privatoFlag =
        payload.privato === true || payload.visibility === "privato";

      // --- MODIFICA di un item esistente (editId = il suo @id) ---
      if (payload.editId) {
        const esistente = await ItemModel.findOne({ "@id": payload.editId });
        if (!esistente)
          return res.status(404).json({ error: "Item da modificare non trovato." });
        if (esistente.author !== payload.autore)
          return res
            .status(403)
            .json({ error: "Puoi modificare solo i tuoi item." });
        const desc = payload.descrizioni?.[0] || {};
        esistente.text = desc.testo ?? esistente.text;
        esistente.price =
          esistente.visibility === "privato" ? 0 : Number(payload.prezzo) || 0;
        await esistente.save();
        return res
          .status(200)
          .send({ message: "Item aggiornato con successo" });
      }

      for (const desc of payload.descrizioni) {
        const esistente = await ItemModel.findOne({
          about: artwork["@id"],
          author: payload.autore,
          educationalLevel: desc.tono,
        });
        if (esistente) {
          return res.status(409).json({
            error: `Hai già pubblicato una descrizione di tono "${desc.tono}" per quest'opera.`,
          });
        }
      }

      const privato = payload.privato === true || payload.visibility === "privato";

      for (const desc of payload.descrizioni) {
        const itemId = `${artwork.qid}-${payload.autore}-${desc.tono}-${desc.lunghezza}`;
        await ItemModel.create({
          "@id": itemId,
          about: artwork["@id"],
          timeRequired: desc.lunghezza,
          educationalLevel: desc.tono,
          author: payload.autore,
          price: privato ? 0 : payload.prezzo,
          license: payload.licenza || "Tutti i diritti riservati",
          text: desc.testo,
          visibility: privato ? "privato" : "pubblico",
        });
      }
    }
    else if (payload["@type"] === "CreativeWork") {
      let artworkIdString =
        typeof payload.about === "object"
          ? payload.about["@id"]
          : payload.about;
      const artwork = await ArtworkModel.findOne({
        $or: [{ wikiDataUri: artworkIdString }, { "@id": artworkIdString }],
      });
      if (!artwork)
        return res.status(400).json({ error: "Artwork non trovato." });

      payload.about = artwork["@id"];
      await ItemModel.create(payload);
    }

    res.status(201).send({ message: "Contenuto pubblicato con successo" });
  } catch (error: any) {
    console.error("[BACKEND ERROR] Errore salvataggio item:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
