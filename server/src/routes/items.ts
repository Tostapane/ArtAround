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
    // Gli item privati (usati solo nelle visite guidate del loro autore) NON
    // compaiono nel marketplace dei visitatori.
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

/**
 * GET /api/items/author/:authorName
 * Recupera tutti i contenuti creati da un autore specifico.
 */
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

/**
 * POST /api/items
 * Crea o aggiorna un contenuto (CreativeWork / Item).
 */
router.post("/", async (req, res) => {
  try {
    const payload = req.body;

    // Supporto formato Marketplace (tipo: "Item")
    if (payload.tipo === "Item") {
      // L'identificatore universale inviato dal marketplace è l'@id dell'opera
      // (URI di Wikidata). Accettiamo anche qid/wikiDataUri per robustezza.
      const artwork = await ArtworkModel.findOne({
        $or: [
          { "@id": payload.id_oper_universale },
          { qid: payload.id_oper_universale },
          { wikiDataUri: payload.id_oper_universale },
        ],
      });
      if (!artwork)
        return res.status(400).json({ error: "Artwork non trovato nel database." });

      // Un autore puo' pubblicare UN solo item per coppia opera+tono:
      // i duplicati vengono rifiutati (niente sovrascrittura silenziosa).
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

      // Item privato: non pubblico e senza prezzo (forzato a 0), così non può
      // essere "venduto" e poi regalato tramite la password di una visita guidata.
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
    // Supporto formato Schema.org (CreativeWork)
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
