import "./env";
import mongoose from "mongoose";
import { ArtworkModel } from "./models/artwork";
import { ItemModel } from "./models/item";
import { VisitModel } from "./models/visit";
import { MuseumModel } from "./models/museum";
import { UserModel } from "./models/user";
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
        const inserita = await populateArtwork(
          qid,
          `http://www.wikidata.org/entity/${museum.qid}`,
          `art-${artworkIdx}`,
        );
        // Opera senza immagine: saltata (niente item ne' inclusione nelle visite)
        if (!inserita) {
          console.log(`   opera ${qid} saltata (nessuna immagine).`);
          continue;
        }
        let itemIdx = 0;
        for (const level of educationalLevels) {
          for (const duration of secPerArt) {
            itemIdx++;
            itemCount++;
            await populateItem(qid, level, duration);
            await delay(5000);
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
/*
 * Seed di due visite "dimostrative" che il seed automatico (omogeneo) non
 * produce. Va eseguito DOPO seed() (servono gli item gia' presenti nel DB):
 *  1) una visita normale con CONTENUTI OPZIONALI (optionalItems): un
 *     sottoinsieme delle opere e' marcato come "da mostrare solo se resta tempo";
 *  2) una VISITA GUIDATA del docente (modulo 18-27): protetta da parola chiave
 *     ("Fenice rossa"), con un account docente che la avvia e alcuni account
 *     studente che possono agganciarsi digitando la parola chiave.
 *
 * Idempotente: rimuove le due visite (per @id) e ricrea/aggiorna gli account.
 * Autonomo: gestisce da se' connessione e disconnessione.
 */
const PAROLA_CHIAVE_GUIDATA = "Fenice rossa";
const DOCENTE = "docente1";
const STUDENTI = ["studente1", "studente2", "studente3"];

async function seedSpecialVisits() {
  try {
    console.log("Connessione a MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connesso!");

    // Primo museo disponibile: le due visite useranno le sue opere.
    const museum = Object.values(museums)[0];
    if (!museum) {
      console.log("Nessun museo configurato: niente visite da seminare.");
      return;
    }
    const museumUri = `http://www.wikidata.org/entity/${museum.qid}`;
    const aboutIds = museum.artworks.map(
      (q) => `http://www.wikidata.org/entity/${q}`,
    );

    // Item omogenei (stesso livello e durata) del museo scelto: sono la base
    // condivisa delle due visite. Servono gli item gia' generati da seed().
    const level = educationalLevels[0];
    const duration = secPerArt[0];
    const items = await ItemModel.find({
      timeRequired: `${duration}`,
      educationalLevel: `${level}`,
      about: { $in: aboutIds },
    });
    if (items.length === 0) {
      console.log(
        `Nessun item trovato per ${museum.qid} (${level}/${duration}s): esegui prima seed().`,
      );
      return;
    }
    const itemIds = items.map((it) => it["@id"]);
    const durataTotale = duration * itemIds.length;

    // Contenuti opzionali: marchiamo come "opzionale" la seconda meta' delle
    // opere (da mostrare solo se resta tempo o su domanda del visitatore).
    const primoOpzionale = Math.ceil(itemIds.length / 2);
    const opzionali: string[] = [];
    for (let i = primoOpzionale; i < itemIds.length; i++) {
      opzionali.push(itemIds[i]);
    }

    const visitaOpzionali = {
      "@id": `visit-opzionali-${museum.qid}`,
      name: "Percorso con contenuti opzionali",
      level: `${level}`,
      duration: durataTotale,
      ofMuseum: museumUri,
      itemListElement: itemIds,
      optionalItems: opzionali,
      logistics: [],
    };

    const visitaGuidata = {
      "@id": `visit-guidata-${museum.qid}`,
      name: "Visita guidata del docente",
      level: `${level}`,
      duration: durataTotale,
      author: DOCENTE,
      accessKey: PAROLA_CHIAVE_GUIDATA,
      ofMuseum: museumUri,
      itemListElement: itemIds,
      logistics: [],
    };

    // Idempotenza: via le versioni precedenti, poi ricrea.
    await VisitModel.deleteMany({
      "@id": { $in: [visitaOpzionali["@id"], visitaGuidata["@id"]] },
    });
    await VisitModel.create(visitaOpzionali);
    await VisitModel.create(visitaGuidata);
    console.log(
      `Visite create: "${visitaOpzionali.name}" (${opzionali.length}/${itemIds.length} opzionali) e ` +
        `"${visitaGuidata.name}" (parola chiave: «${PAROLA_CHIAVE_GUIDATA}»).`,
    );

    // Account che partecipano alla visita guidata: il docente (autore, la avvia
    // dal marketplace) e gli studenti (si agganciano con la parola chiave).
    const account = [DOCENTE, ...STUDENTI];
    for (const username of account) {
      await UserModel.updateOne(
        { username },
        {
          $set: { password: "12345678" },
          $setOnInsert: { wallet: 100, collezione: [] },
        },
        { upsert: true },
      );
      console.log(`  account pronto: ${username}`);
    }
    console.log(
      `Docente: ${DOCENTE} · studenti: ${STUDENTI.join(", ")} (password "12345678").`,
    );
  } catch (err) {
    console.error("Errore durante il seed delle visite speciali", err);
  } finally {
    await mongoose.disconnect();
    console.log("Connessione chiusa. Uscita...");
  }
}

async function completeSeed() {
  // await seedMuseums();
  await seed();
  await seedDownload();
  await seedSpecialVisits();
}
completeSeed();
