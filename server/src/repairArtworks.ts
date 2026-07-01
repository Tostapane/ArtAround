import "./env";
import mongoose from "mongoose";
import { ArtworkModel } from "./models/artwork";
import { ItemModel } from "./models/item";
import { VisitModel } from "./models/visit";
import { populateArtwork, populateItem } from "./manager";
import { educationalLevels, secPerArt } from "../../shared/constants";

/*
 * Riparazione mirata: alcuni QID nel seed originale erano identificativi
 * Wikidata inesistenti (HTTP 404) -> nessun nome/immagine, il label service
 * ripiegava sul QID. Qui sostituiamo SOLO quelle opere con QID reali e
 * verificati, senza rigenerare l'intero database (evita ~25 min di LLM).
 *
 * Per ogni sostituzione: elimino la vecchia opera e i suoi item, rimuovo i
 * riferimenti dalle visite del museo, popolo la nuova opera + i suoi item
 * (uno per ogni livello/durata) e li riaggancio alle visite corrispondenti.
 */

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";

// old = QID non valido presente nel DB; new = QID reale sostitutivo
const swaps: { old: string; nuovo: string; museumQid: string }[] = [
  // Opere senza immagine (QID spazzatura) -> opere reali con immagine
  { old: "Q199392", nuovo: "Q597114", museumQid: "Q19675" }, // Morte della Vergine
  { old: "Q728973", nuovo: "Q783215", museumQid: "Q19675" }, // San Giovanni Battista
  { old: "Q2247953", nuovo: "Q2653851", museumQid: "Q19675" }, // Innalzamento della Croce
  { old: "Q797909", nuovo: "Q3228069", museumQid: "Q19675" }, // The Lock
  { old: "Q275454", nuovo: "Q6287319", museumQid: "Q19675" }, // Giovane tra le Arti Liberali
  { old: "Q2266521", nuovo: "Q1114881", museumQid: "Q19675" }, // Venere e le tre Grazie
  { old: "Q2316682", nuovo: "Q19912235", museumQid: "Q160236" }, // Christ Bearing the Cross
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function repair() {
  console.log("Connessione a MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connesso!");

  for (const { old, nuovo, museumQid } of swaps) {
    const museumUri = `http://www.wikidata.org/entity/${museumQid}`;
    const oldUri = `http://www.wikidata.org/entity/${old}`;
    const nuovoUri = `http://www.wikidata.org/entity/${nuovo}`;
    console.log(`\n[${museumQid}] ${old} -> ${nuovo}`);

    // 1. Rimuovo vecchi item e opera
    const oldItems = await ItemModel.find({ about: oldUri });
    const oldItemIds = oldItems.map((i) => i["@id"]);
    await ItemModel.deleteMany({ about: oldUri });
    await ArtworkModel.deleteMany({ qid: old });

    // 2. Sgancio i vecchi item dalle visite del museo
    if (oldItemIds.length) {
      await VisitModel.updateMany(
        { ofMuseum: museumUri },
        { $pull: { itemListElement: { $in: oldItemIds } } },
      );
    }

    // 3. Popolo la nuova opera (nome, autore, stile, immagine da Wikidata)
    await populateArtwork(nuovo, museumUri, "art-repair");
    const art = await ArtworkModel.findOne({ qid: nuovo });
    console.log(`   opera creata: ${art?.name}`);

    // 4. Genero i nuovi item (uno per livello/durata) e li aggancio alle visite
    for (const level of educationalLevels) {
      for (const duration of secPerArt) {
        await populateItem(nuovo, level, duration);
        await delay(2500);
        const itemId = `${nuovo}-sistema-${level}-${duration}`;
        await VisitModel.updateOne(
          { "@id": `visit-${museumQid}-${level}-${duration}` },
          { $addToSet: { itemListElement: itemId } },
        );
        console.log(`   + item ${level}/${duration}s agganciato alla visita`);
      }
    }
  }

  await mongoose.disconnect();
  console.log("\nRiparazione completata. Connessione chiusa.");
}

repair().catch(async (e) => {
  console.error("Errore durante la riparazione:", e);
  await mongoose.disconnect();
  process.exit(1);
});
