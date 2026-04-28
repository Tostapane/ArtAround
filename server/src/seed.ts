import "./env";
import mongoose from "mongoose";
import { ArtworkModel } from "./models/artwork";
import { ItemModel } from "./models/item";
import { VisitModel } from "./models/visit";
import { MuseumModel } from "./models/museum";
import {
  populateArtwork,
  populateItem,
  populateVisit,
  populateMuseum,
} from "./manager";
import { downloadImage } from "./services/imageDownloader";
import { educationalLevels, secPerArt } from "../../shared/constants";
import { museums } from "./data/museumContent";

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";

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
    for (const museum of Object.values(museums)) {
      var cont = 1;
      for (const qid of museum.artworks) {
        await populateArtwork(
          qid,
          `http://www.wikidata.org/entity${museum.qid}`,
          `art-${cont}`,
        );
        cont++;
        for (const level of educationalLevels) {
          for (const duration of secPerArt) {
            await populateItem(qid, level, duration);
            await delay(1000);
          }
        }
      }
      for (const level of educationalLevels) {
        for (const duration of secPerArt) {
          const items = await ItemModel.find({
            timeRequired: `${duration}`,
            educationalLevel: `${level}`,
          });
          await populateVisit(
            level,
            duration,
            `${museum.qid}`,
            `http://www.wikidata.org/entity${museum.qid}`,
            items.map((item) => item["@id"]),
            [],
          );
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
    console.log(`${artwork.qid}`);
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
    await downloadImage(artwork.imageUri, `${artwork.qid}`);
    await delay(2000); // 1-second delay between requests
  }
  await mongoose.disconnect();
}

async function seedMuseums() {
  try {
    console.log("Connessione a MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connesso!");

    await MuseumModel.deleteMany({});
    for (const museum of Object.values(museums)) {
      await populateMuseum(museum.qid, museum.artworks);
    }
  } catch (err) {
    console.error("Errore durante il seed museum", err);
  } finally {
    await mongoose.disconnect();
    console.log("Connessione chiusa. Uscita...");
  }
}
async function completeSeed() {
  await seedMuseums();
  await seed();
  await seedDownload();
}
completeSeed();
