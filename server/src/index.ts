import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { ItemModel } from "./models/item";
import { VisitModel } from "./models/visit";
import { ArtworkModel } from "./models/artwork";

dotenv.config();

const app = express();
const PORT = 8000;

app.use(express.json());

// Servire i file statici del marketplace
// Root: serve la cartella public del marketplace
app.use(express.static(path.join(__dirname, "../../marketplace/public")));
// /dist: serve la cartella dist del marketplace (dove si trovano gli script compilati)
app.use(
  "/dist",
  express.static(path.join(__dirname, "../../marketplace/dist")),
);

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";

const connectWithRetry = () => {
  console.log("Attempting to connect to MongoDB...");
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("Successful MongoDB connection"))
    .catch((err) => {
      console.error("MongoDB connection error, retrying in 5 seconds...", err);
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

/**
 * API GET: Recupera la lista delle opere.
 * Converte i modelli interni (Item, Visit) nel formato 'Contenuto' (Opera | Visita) atteso dal frontend.
 */
app.get("/api/opere", async (req, res) => {
  try {
    const items = await ItemModel.find({}).populate("about");
    const visits = await VisitModel.find({});

    // Trasformazione ITEMS in 'Opera' del Marketplace
    // Raggruppiamo i singoli Item (CreativeWork) per Opera (Artwork) + Autore
    const groupedItems = new Map();
    items.forEach((item) => {
      const artwork = item.about as any;
      // Chiave univoca basata su Artwork (WikiData ID o internal ID) e Autore
      const artworkId =
        artwork?.wikiDataUri || artwork?._id?.toString() || "unknown";
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Errore nel caricamento delle opere" });
  }
});

/**
 * API POST: Registra un nuovo contenuto.
 * Gestisce sia il formato Schema.org che quello 'Marketplace'.
 */
app.post("/api/opere", async (req, res) => {
  try {
    const payload = req.body;

    // Riconoscimento formato Marketplace (campo 'tipo' invece di '@type')
    if (payload.tipo === "Item" || payload.tipo === "Visita") {
      if (payload.tipo === "Item") {
        // 1. Assicurarsi che l'Artwork esista nel database
        let artwork;
        if (payload.id_oper_universale) {
          artwork = await ArtworkModel.findOneAndUpdate(
            { wikiDataUri: payload.id_oper_universale },
            {
              "@id": `uri:${payload.id_oper_universale}`,
              wikiDataUri: payload.id_oper_universale,
              name: payload.titolo,
              image: payload.immagine,
            },
            { upsert: true, new: true },
          );
        } else {
          // Opera non universale
          artwork = await ArtworkModel.findOneAndUpdate(
            { name: payload.titolo },
            {
              "@id": `uri:local:${Date.now()}`,
              wikiDataUri: "N/A",
              name: payload.titolo,
              image: payload.immagine,
            },
            { upsert: true, new: true },
          );
        }

        // 2. Creare o aggiornare gli Item (CreativeWork) per ogni descrizione
        // ATTENZIONE: per semplicità rimpiazziamo i precedenti per questo autore/opera
        await ItemModel.deleteMany({
          about: artwork._id,
          author: payload.autore,
        });

        for (const desc of payload.descrizioni) {
          const itemId = `${artwork.wikiDataUri || "local"}-${payload.autore}-${desc.tono}-${desc.lunghezza}`;
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
        // Visita (Percorso)
        await VisitModel.findOneAndUpdate(
          { "@id": payload.id },
          {
            "@id": payload.id,
            name: payload.titolo,
            price: payload.prezzo,
            author: payload.autore,
            itemListElement:
              payload.percorso
                ?.filter((t: any) => t.tipo === "item")
                .map((t: any) => t.id_item) || [],
            logistics:
              payload.percorso
                ?.filter((t: any) => t.tipo === "logistics")
                .map((t: any) => t.indicazione) || [],
          },
          { upsert: true },
        );
      }
    } else {
      // Formato Schema.org nativo (già presente nel server originale)
      if (payload["@type"] === "ItemList") {
        await VisitModel.create(payload);
      } else {
        const artworkData = payload.about;
        if (artworkData && typeof artworkData === "object") {
          const artwork = await ArtworkModel.findOneAndUpdate(
            { "@id": artworkData["@id"] },
            artworkData,
            { upsert: true, new: true },
          );
          payload.about = artwork._id;
        }
        await ItemModel.create(payload);
      }
    }

    console.log(`[BACKEND] Nuovo contenuto salvato`);
    res.status(201).send({ message: "Pubblicazione avvenuta con successo" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Errore durante il salvataggio" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    message: "Unified Backend running",
    node_version: process.version,
  });
});

app.listen(PORT, () => {
  console.log(`-------------------------------------------`);
  console.log(`  ArtAround Unified Backend on port ${PORT} `);
  console.log(`-------------------------------------------`);
});
