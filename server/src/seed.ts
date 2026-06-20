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

    // Totali e contatori per il progresso
    const museumList = Object.values(museums);
    const totalMuseums = museumList.length;
    const itemsPerArtwork = educationalLevels.length * secPerArt.length;
    const totalArtworks = museumList.reduce((s, m) => s + m.artworks.length, 0);
    const totalItems = totalArtworks * itemsPerArtwork;
    let artworkCount = 0;
    let itemCount = 0;
    const startTime = Date.now();
    const fmt = (s: number) =>
      `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s`;

    console.log(
      `Seed: ${totalMuseums} musei, ${totalArtworks} opere, ${totalItems} item da generare (~3s/item).`,
    );

    let museumIdx = 0;
    for (const museum of museumList) {
      museumIdx++;
      let artworkIdx = 0;
      for (const qid of museum.artworks) {
        artworkIdx++;
        artworkCount++;
        console.log(
          `\n[Museo ${museumIdx}/${totalMuseums} ${museum.qid}] [Opera ${artworkIdx}/${museum.artworks.length} ${qid}]  (opera ${artworkCount}/${totalArtworks})`,
        );
        await populateArtwork(
          qid,
          `http://www.wikidata.org/entity/${museum.qid}`,
          `art-${artworkIdx}`,
        );
        let itemIdx = 0;
        for (const level of educationalLevels) {
          for (const duration of secPerArt) {
            itemIdx++;
            itemCount++;
            await populateItem(qid, level, duration);
            await delay(2500);
            const elapsed = (Date.now() - startTime) / 1000;
            const eta = (totalItems - itemCount) * (elapsed / itemCount);
            console.log(
              `   - Item ${itemIdx}/${itemsPerArtwork} (${level}/${duration}s)  ·  ${itemCount}/${totalItems} item totali  ·  ETA ~${fmt(eta)}`,
            );
          }
        }
      }

      // gli @id degli artwork di QUESTO museo: una visita deve contenere solo
      // item che descrivono opere del proprio museo (non di altri musei)
      const aboutIds = museum.artworks.map(
        (q) => `http://www.wikidata.org/entity/${q}`,
      );
      console.log(`[Museo ${museumIdx}/${totalMuseums}] genero le visite...`);
      for (const level of educationalLevels) {
        for (const duration of secPerArt) {
          const items = await ItemModel.find({
            timeRequired: `${duration}`,
            educationalLevel: `${level}`,
            about: { $in: aboutIds },
          });
          await populateVisit(
            level,
            duration,
            `${museum.qid}`,
            `http://www.wikidata.org/entity/${museum.qid}`,
            items.map((item) => item["@id"]),
            [],
          );
        }
      }
    }

    console.log(
      `\nSeed completato in ${fmt((Date.now() - startTime) / 1000)}.`,
    );
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
