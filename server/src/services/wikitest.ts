import mongoose from "mongoose";
import { insertArtwork, deleteArtwork } from "../dbActions";
// Connection URI should match the one in index.ts or test.ts
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@mongodb:27017/artaround?authSource=admin";

// verranno presi dal file fornito dal gestore del museo
// e forniti sotto forma di array
const uris = [
  "Q12418", // Mona Lisa (Leonardo da Vinci)
  "Q45585", // The Starry Night (Vincent van Gogh)
  "Q128907", // The Last Supper (Leonardo da Vinci)
  "Q184707", // The Scream (Edvard Munch)
  "Q185372", // Girl with a Pearl Earring (Johannes Vermeer)
];

// inserisce le opere e le rimuove
async function runTests() {
  try {
    console.log("Tentativo di connessione a MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connesso con successo!");

    for (const uri of uris) {
      console.log(`Eseguendo test per: ${uri}`);
      await insertArtwork(uri);
    }
    for (const uri of uris) {
      await deleteArtwork(uri);
    }
  } catch (err) {
    console.error("Errore di connessione o esecuzione:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnesso da MongoDB.");
  }
}

runTests();
