import { Router } from "express";
import { ItemModel } from "../models/item";
import { VisitModel } from "../models/visit";
import { ArtworkModel } from "../models/artwork";

const router = Router();

/**
 * API GET: Recupera la lista delle opere.
 * Converte i modelli interni (Item, Visit) nel formato 'Contenuto' (Opera | Visita) atteso dal frontend.
 */
router.get("/", async (req, res) => {
  try {
    console.log(`[BACKEND] Chiamata GET /api/opere`);

    // 1. Trova tutti gli artwork
    const artworks = await ArtworkModel.find({}).select('_id name wikiDataUri image');
    const artworkIds = artworks.map(a => a._id);

    // 2. Trova tutti gli item che si riferiscono a quegli artwork
    const items = await ItemModel.find({ about: { $in: artworkIds } }).populate("about");
    const visits = await VisitModel.find({}); 

    // Trasformazione ITEMS in 'Opera' del Marketplace
    const groupedItems = new Map();
    items.forEach((item) => {
      const artwork = item.about as any;
      const artworkId = artwork?.wikiDataUri || artwork?._id?.toString() || "unknown";
      const key = `${artworkId}-${item.author}`;

      if (!groupedItems.has(key)) {
        groupedItems.set(key, {
          id: key,
          titolo: artwork?.name || "Senza titolo",
          autore: item.author,
          prezzo: item.price || 0,
          tipo: "Item",
          immagine: artwork?.image || "",
          id_oper_universale: artwork?.wikiDataUri || "",
          descrizioni: [],
        });
      }
      const opera = groupedItems.get(key);
      opera.descrizioni.push({
        tono: item.educationalLevel,
        lunghezza: item.timeRequired,
        testo: item.text || "",
      });
    });

    // Trasformazione VISITS
    const transformedVisits = visits.map((v) => {
      const items: any[] = v.itemListElement.map((id) => ({
        tipo: "item",
        id_item: id,
      }));
      const logistics: any[] = v.logistics.map((l) => ({
        tipo: "logistica",
        indicazione: l,
      }));

      return {
        id: v["@id"] || v._id.toString(),
        titolo: v.name,
        autore: v.author || "Sistema",
        prezzo: v.price || 0,
        tipo: "Visita",
        percorso: [...items, ...logistics],
      };
    });

    res.json([...Array.from(groupedItems.values()), ...transformedVisits]);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Errore nel caricamento delle opere" });
  }
});

/**
 * API POST: Registra un nuovo contenuto.
 */
router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    console.log("[BACKEND] Ricevuto payload POST /api/opere:", JSON.stringify(payload, null, 2));

    // Formato Marketplace
    if (payload.tipo === "Item" || payload.tipo === "Visita") {
      if (payload.tipo === "Item") {
        if (!payload.id_oper_universale) {
          return res.status(400).json({ error: "id_oper_universale is required" });
        }
        
        const artwork = await ArtworkModel.findOne({ wikiDataUri: payload.id_oper_universale });
        if (!artwork) {
          return res.status(400).json({ error: "Artwork not found in database." });
        }

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
      } else {
        await VisitModel.findOneAndUpdate(
          { "@id": payload.id },
          {
            "@id": payload.id,
            name: payload.titolo,
            price: payload.prezzo,
            author: payload.autore,
            itemListElement: payload.percorso?.filter((t: any) => t.tipo === "item").map((t: any) => t.id_item) || [],
            logistics: payload.percorso?.filter((t: any) => t.tipo === "logistics").map((t: any) => t.indicazione) || [],
          },
          { upsert: true }
        );
      }
    } else {
      // Formato Schema.org
      if (payload["@type"] === "ItemList") {
        await VisitModel.create(payload);
      } else { 
        // CreativeWork (Item)
        let artworkIdString = "";
        if (payload.about && typeof payload.about === "object" && payload.about["@id"]) {
          artworkIdString = payload.about["@id"];
        } else if (typeof payload.about === "string") {
          artworkIdString = payload.about;
        }

        if (!artworkIdString) {
          return res.status(400).json({ error: "Property 'about' is required and must contain an @id." });
        }

        const artwork = await ArtworkModel.findOne({ "@id": artworkIdString });
        if (!artwork) {
          return res.status(400).json({ error: `Artwork with @id '${artworkIdString}' not found in database.` });
        }

        // Sostituisco il riferimento stringa con l'ObjectId di MongoDB
        payload.about = artwork._id;
        
        // Salvataggio
        await ItemModel.create(payload);
      }
    }

    console.log(`[BACKEND] Nuovo contenuto salvato correttamente`);
    res.status(201).send({ message: "Pubblicazione avvenuna con successo" });
  } catch (error: any) {
    console.error("[BACKEND ERROR] Errore durante il salvataggio:", error);
    res.status(500).json({ error: error.message || "Errore interno del server" });
  }
});

export default router;
