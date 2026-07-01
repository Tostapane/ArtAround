import "./env";
import mongoose from "mongoose";
import { UserModel } from "./models/user";

/*
 * Seed dei 4 account richiesti dalla spec (slide/§1):
 * autore1, autore2, visitatore1, visitatore2 — password "12345678".
 * Idempotente: aggiorna se gia' presenti, senza toccare wallet/collezione
 * esistenti (upsert con $setOnInsert sui campi mutabili).
 */

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";

const utenti = [
  { username: "autore1", password: "12345678", role: "autore" as const },
  { username: "autore2", password: "12345678", role: "autore" as const },
  { username: "visitatore1", password: "12345678", role: "visitatore" as const },
  { username: "visitatore2", password: "12345678", role: "visitatore" as const },
];

async function seedUsers() {
  console.log("Connessione a MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connesso!");

  for (const u of utenti) {
    await UserModel.updateOne(
      { username: u.username },
      {
        $set: { password: u.password, role: u.role },
        // wallet/collezione impostati solo alla prima creazione
        $setOnInsert: { wallet: 100, collezione: [] },
      },
      { upsert: true },
    );
    console.log(`  utente pronto: ${u.username} (${u.role})`);
  }

  await mongoose.disconnect();
  console.log("Seed utenti completato.");
}

seedUsers().catch(async (e) => {
  console.error("Errore seed utenti:", e);
  await mongoose.disconnect();
  process.exit(1);
});
