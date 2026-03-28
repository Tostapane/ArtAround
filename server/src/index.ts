import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
// import cors from "cors";
import path from "path";
import { ItemModel } from "./models/item";
import { VisitModel } from "./models/visit";
import { ArtworkModel } from "./models/artwork";

dotenv.config();

const app = express();
const PORT = 8000;

app.use(express.json());
// app.use(cors()); // Commentato temporaneamente per mancanza modulo e permessi installazione

// Servire i file statici del marketplace
app.use(express.static(path.join(__dirname, '../../marketplace/public')));
// Correzione per la nuova struttura nidificata di tsc
app.use('/dist/marketplace/src/frontend', express.static(path.join(__dirname, '../../marketplace/dist/marketplace/src/frontend')));
app.use('/dist/shared', express.static(path.join(__dirname, '../../marketplace/dist/shared')));

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

// API GET: Recupera la lista delle opere dal database reale
app.get('/api/opere', async (req, res) => {
  try {
    const items = await ItemModel.find().populate('about');
    const visits = await VisitModel.find();
    res.json([...items, ...visits]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Errore nel caricamento delle opere" });
  }
});

// API POST: Registra una nuova opera (Item o Visit) nel database
app.post('/api/opere', async (req, res) => {
  try {
    const payload = req.body;
    if (payload["@type"] === "ItemList") {
      await VisitModel.create(payload);
    } else {
      // Gestione nidificata dell'Artwork
      const artworkData = payload.about;
      if (artworkData && typeof artworkData === 'object') {
        const artwork = await ArtworkModel.findOneAndUpdate(
          { "@id": artworkData["@id"] },
          artworkData,
          { upsert: true, new: true }
        );
        // Sostituiamo l'oggetto completo con l'ID di Mongoose per il riferimento
        payload.about = artwork._id;
      }
      await ItemModel.create(payload);
    }
    console.log(`[BACKEND] Nuovo contenuto salvato: ${payload["@id"]}`);
    res.status(201).send({ message: "Pubblicazione avvenuta con successo" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Errore durante il salvataggio" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ message: "Backend running", node_version: process.version });
});

app.listen(PORT, () => {
  console.log(`server is listening on ${PORT}`);
});
