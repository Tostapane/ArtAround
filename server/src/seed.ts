import mongoose from "mongoose";
import dotenv from "dotenv";
import { ArtworkModel } from "./models/artwork";
import { ItemModel } from "./models/item";
import { VisitModel } from "./models/visit";
import { populateArtwork, populateItem } from "./manager";
import { downloadImage } from "./services/imageDownloader";

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";

const levels = ["Intermedio", "Avanzato"];
const durations = [5, 30, 60];
// Lista di QID di opere famose per il test
const testArtworks = [
  "Q12418",
  "Q45585",
  "Q185372",
  "Q18891156",
  "Q128910",
  "Q175036",
  "Q151047",
  "Q208758",
  "Q219831",
  "Q328523",
  "Q321303",
  "Q29530",
  "Q220859",
  // "Q152124",
  // "Q30343",
  // "Q5110738",
  // "Q2712211",
  // "Q1452140",
];
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
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
    var cont = 1;
    for (const qid of testArtworks) {
      await populateArtwork(qid, `art-${cont}`);
      cont++;
      for (const level of levels) {
        for (const duration of durations) {
          await populateItem(qid, level, duration);
          await delay(1200);
        }
      }
    }
  } catch (err) {
    console.error("Errore durante il test", err);
  } finally {
    await mongoose.disconnect();
    console.log("Connessione chiusa. Uscita...");
  }
}
async function printStored() {
  await mongoose.connect(MONGO_URI);
  const artworks = await ArtworkModel.find();
  for (const artwork of artworks) {
    console.log(`${artwork.wikiDataUri}`);
  }
  await mongoose.disconnect();
}
async function seedDownload() {
  console.log("Connessione a MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connesso!");

  const artworks = await ArtworkModel.find().lean();
  for (const artwork of artworks) {
    console.log(`Downloading ${artwork.name}`);
    await downloadImage(artwork.imageUri, `${artwork.wikiDataUri}`);
    await delay(2000); // 1-second delay between requests
  }
  await mongoose.disconnect();
}

seed();
