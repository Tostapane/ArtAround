import "./env";
import mongoose from "mongoose";
import { VisitModel } from "./models/visit";

/*
 * Rinomina le visite di sistema (tour auto-generati dal seed) il cui `name`
 * era il codice grezzo (es. "Q19675-Principiante-15") in un nome leggibile
 * (es. "Visita Principiante · 15s"). Idempotente.
 */

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";

async function rename() {
  await mongoose.connect(MONGO_URI);
  const visits = await VisitModel.find({});
  let n = 0;
  for (const v of visits) {
    // solo le visite col vecchio nome-codice (iniziano con "Qxxxx-")
    if (/^Q\d+-/.test(v.name || "")) {
      v.name = `Visita ${v.level} · ${v.duration}s`;
      await v.save();
      n++;
    }
  }
  console.log(`Rinominate ${n} visite.`);
  await mongoose.disconnect();
}

rename().catch(async (e) => {
  console.error("Errore rename visite:", e);
  await mongoose.disconnect();
  process.exit(1);
});
