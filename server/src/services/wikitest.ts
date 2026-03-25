import mongoose from "mongoose";
import { insertArtwork } from "../dbActions";
// Connection URI should match the one in index.ts or test.ts
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@mongodb:27017/artaround?authSource=admin";

// verranno presi dal file fornito dal gestore del museo
// e forniti sotto forma di array
const uris = [
  "Q45585", // The Starry Night (Vincent van Gogh)
];

async function runTests() {
  try {
    console.log("Tentativo di connessione a MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connesso con successo!");

    for (const uri of uris) {
      console.log(`Eseguendo test per: ${uri}`);
      await insertArtwork(uri);
    }
  } catch (err) {
    console.error("Errore di connessione o esecuzione:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnesso da MongoDB.");
  }
}

runTests();
