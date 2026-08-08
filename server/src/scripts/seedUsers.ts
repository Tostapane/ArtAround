/**
 * Crea i quattro account richiesti dalla specifica (slide "Requisiti di
 * progetto"): autore1, autore2, visitatore1 e visitatore2, con password
 * "12345678".
 *
 * Il ruolo fa parte dell'identita', quindi la chiave d'upsert e' la coppia
 * (username, role). Idempotente: aggiorna la password di chi c'e' gia' senza
 * toccarne portafoglio e collezione, che stanno sotto `$setOnInsert`.
 *
 * Cancella anche i documenti rimasti senza ruolo dal vecchio modello "account
 * unico": non potrebbero piu' accedere. Se quegli account servono, si usa invece
 * `testers.ts account`, che non cancella niente.
 */
import { MONGO_URI } from "../env";
import mongoose from "mongoose";
import { UserModel } from "../models/user";

const utenti = [
  { username: "autore1", password: "12345678", role: "autore" },
  { username: "autore2", password: "12345678", role: "autore" },
  { username: "visitatore1", password: "12345678", role: "visitatore" },
  { username: "visitatore2", password: "12345678", role: "visitatore" },
];

async function seedUsers() {
  console.log("Connessione a MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connesso!");

  const puliti = await UserModel.deleteMany({ role: { $exists: false } });
  if (puliti.deletedCount)
    console.log(`  rimossi ${puliti.deletedCount} account legacy senza ruolo`);

  for (const u of utenti) {
    const onInsert: any =
      u.role === "visitatore" ? { wallet: 100, collezione: [] } : { collezione: [] };
    await UserModel.updateOne(
      { username: u.username, role: u.role },
      {
        $set: { password: u.password },
        $setOnInsert: onInsert,
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
