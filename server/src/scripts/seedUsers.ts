/**
 * Crea i quattro account richiesti dalla specifica.
 *
 * Cancella anche i documenti rimasti senza ruolo dal vecchio modello "account
 * unico": non potrebbero piu' accedere. Se quegli account servono, si usa invece
 * `testers.ts account`, che non cancella niente.
 */
import { MONGO_URI } from "../env";
import mongoose from "mongoose";
import { UserModel } from "../models/user";

/*
 * Seed dei 4 account richiesti dalla spec (slide "Requisiti di progetto"):
 * autore1, autore2 (ruolo autore) e visitatore1, visitatore2 (ruolo
 * visitatore), con password "12345678". Il ruolo fa parte dell'identità: la
 * chiave d'upsert è la coppia (username, role).
 * Idempotente: aggiorna la password se già presenti, senza toccare
 * wallet/collezione esistenti (upsert con $setOnInsert sui campi mutabili).
 */

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
