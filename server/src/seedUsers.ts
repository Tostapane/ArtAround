import "./env";
import mongoose from "mongoose";
import { UserModel } from "./models/user";

/*
 * Seed dei 4 account richiesti dalla spec (slide "Requisiti di progetto"):
 * autore1, autore2 (ruolo autore) e visitatore1, visitatore2 (ruolo
 * visitatore) — password "12345678". Il ruolo fa parte dell'identità: la
 * chiave d'upsert è la coppia (username, role).
 * Idempotente: aggiorna la password se già presenti, senza toccare
 * wallet/collezione esistenti (upsert con $setOnInsert sui campi mutabili).
 */

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";

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

  // Rimuove eventuali documenti senza ruolo rimasti dal modello "account unico"
  // (altrimenti resterebbero orfani e in conflitto con il nuovo indice).
  const puliti = await UserModel.deleteMany({ role: { $exists: false } });
  if (puliti.deletedCount)
    console.log(`  rimossi ${puliti.deletedCount} account legacy senza ruolo`);

  for (const u of utenti) {
    // Il wallet è solo da visitatore (gli autori non comprano). Impostato solo
    // alla prima creazione, insieme alla collezione vuota.
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
