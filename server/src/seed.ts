import mongoose from "mongoose";
import dotenv from "dotenv";
import { ArtworkModel } from "./models/artwork";
import { ItemModel } from "./models/item";
import { VisitModel } from "./models/visit";
import { insertArtwork, insertItem } from "./dbActions";
dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";

const levels = ["Infantile", "Principiante", "Intermedio", "Avanzato"];
const durations = [5, 30, 60];
// Lista di QID di opere famose per il test
const testArtworks = [
  "Q12418", // Mona Lisa (Leonardo da Vinci)
  "Q45585", // The Starry Night (Vincent van Gogh)
  "Q128907", // The Last Supper (Leonardo da Vinci)
  "Q184707", // The Scream (Edvard Munch)
  "Q185372", // Girl with a Pearl Earring (Johannes Vermeer)
];

async function seed() {
  try {
    console.log("Connessione a MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connesso!");

    // Pulizia
    await ArtworkModel.deleteMany({});
    await ItemModel.deleteMany({});
    await VisitModel.deleteMany({});
    console.log("Database pulito.");

    for (const qid of testArtworks) {
      await insertArtwork(qid);
      for (const level of levels) {
        for (const duration of durations) {
          await insertItem(qid, level, duration);
        }
      }
    }
  } catch (err) {
    console.error("Errore durante il test", err);
  }
}

seed();
