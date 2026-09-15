/** Crea con password scrypt gli account dimostrativi senza duplicarli. */
import { MONGO_URI } from "../env";
import mongoose from "mongoose";
import { UserModel } from "../models/user";
import { hashPassword } from "../password";

const utenti = [
  { username: "autore1", password: "12345678", role: "autore" },
  { username: "autore2", password: "12345678", role: "autore" },
  { username: "visitatore1", password: "12345678", role: "visitatore" },
  { username: "visitatore2", password: "12345678", role: "visitatore" },
  { username: "curatore", password: "12345678", role: "curatore" },
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
    const password = await hashPassword(u.password);
    await UserModel.updateOne(
      { username: u.username, role: u.role },
      {
        $set: { password },
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
