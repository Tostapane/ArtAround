/**
 * TESTERS — utilità che toccano il DATABASE.
 *
 * Tutto ciò che modifica dati esistenti vive qui e solo qui: il seed ricostruisce
 * da zero (e costa ore di chiamate all'LLM), queste funzioni invece riallineano
 * quello che c'è già. Sono idempotenti: eseguirle due volte non fa danni.
 *
 * Uso:
 *   npx ts-node src/scripts/testers.ts stato
 *   npx ts-node src/scripts/testers.ts toni
 *   npx ts-node src/scripts/testers.ts nomi
 *   npx ts-node src/scripts/testers.ts logistica
 *   npx ts-node src/scripts/testers.ts generi
 *   npx ts-node src/scripts/testers.ts tutto
 */

import { MONGO_URI } from "../env";
import mongoose from "mongoose";
import { ItemModel } from "../models/item";
import { VisitModel } from "../models/visit";
import { ArtworkModel } from "../models/artwork";
import { MuseumModel } from "../models/museum";
import { UserModel } from "../models/user";
import { educationalLevels, formatDuration } from "../../../shared/constants";
import { UserRole } from "../../../shared/types";

const TONE_MAP: Record<string, string> = {
  Principiante: "Semplice",
  Intermedio: "Medio",
  infantile: "Infantile",
  semplice: "Semplice",
  medio: "Medio",
  avanzato: "Avanzato",
};

async function connect() {
  console.log("Connessione a MongoDB…");
  await mongoose.connect(MONGO_URI);
  console.log("Connesso.");
}

export async function stato() {
  const [museums, artworks, item, visits, users] = await Promise.all([
    MuseumModel.countDocuments(),
    ArtworkModel.countDocuments(),
    ItemModel.countDocuments(),
    VisitModel.countDocuments(),
    UserModel.countDocuments(),
  ]);
  console.log(
    `\nMusei ${museums} · Opere ${artworks} · Item ${item} · Visite ${visits} · Utenti ${users}`,
  );

  const itemTones = await ItemModel.distinct("educationalLevel");
  const visitLevels = await VisitModel.distinct("level");
  console.log(`\nToni negli item:      ${itemTones.sort().join(", ") || "—"}`);
  console.log(`Livelli nelle visite: ${visitLevels.sort().join(", ") || "—"}`);
  console.log(`Toni attesi:          ${educationalLevels.join(", ")}`);

  const offVocabulary = itemTones.filter(
    (t: string) => !educationalLevels.includes(t),
  );
  if (offVocabulary.length > 0) {
    console.log(
      `\n⚠  ${offVocabulary.length} toni fuori vocabolario: ${offVocabulary.join(", ")}` +
        `\n   Esegui:  npx ts-node src/scripts/testers.ts toni`,
    );
  }

  const unplacedNotes = await VisitModel.countDocuments({
    logistics: { $elemMatch: { $type: "string" } },
  });
  if (unplacedNotes > 0) {
    console.log(
      `\n⚠  ${unplacedNotes} visite con note logistiche senza posizione.` +
        `\n   Esegui:  npx ts-node src/scripts/testers.ts logistica`,
    );
  }
  console.log("");
}

export async function migrateTones() {
  let changedItems = 0;
  for (const [from, to] of Object.entries(TONE_MAP)) {
    if (from === to) continue;
    const r = await ItemModel.updateMany(
      { educationalLevel: from },
      { $set: { educationalLevel: to } },
    );
    if (r.modifiedCount) {
      console.log(`  item: ${from} -> ${to}  (${r.modifiedCount})`);
      changedItems += r.modifiedCount;
    }
  }

  let changedVisits = 0;
  for (const [from, to] of Object.entries(TONE_MAP)) {
    if (from === to) continue;
    const r = await VisitModel.updateMany(
      { level: from },
      { $set: { level: to } },
    );
    if (r.modifiedCount) {
      console.log(`  visite: ${from} -> ${to}  (${r.modifiedCount})`);
      changedVisits += r.modifiedCount;
    }
  }

  console.log(
    `Toni riallineati: ${changedItems} item, ${changedVisits} visite. ` +
      `Gli @id restano invariati (sono referenziati da visite e librerie).`,
  );
}

export async function renameVisits() {
  const visits = await VisitModel.find({});
  let changed = 0;

  for (const v of visits) {
    if (!/^Visita .+ · \d+s per opera$/.test(v.name || "")) continue;

    const stops = (v.itemListElement || []).length;
    const nome =
      `${levelTitle(v.level)} · ${stops} ${stops === 1 ? "tappa" : "tappe"} · ` +
      formatDuration(v.duration);
    console.log(`  "${v.name}"  ->  "${nome}"`);
    v.name = nome;
    await v.save();
    changed++;
  }
  console.log(`Visite rinominate: ${changed}.`);
}

function levelTitle(level: string): string {
  const titles: Record<string, string> = {
    Infantile: "Percorso per i più piccoli",
    Semplice: "Percorso introduttivo",
    Medio: "Percorso completo",
    Avanzato: "Percorso approfondito",
  };
  return titles[level] || `Percorso ${level}`;
}

export async function migrateLogistics() {
  const visits = await VisitModel.find({});
  let changed = 0;

  for (const v of visits) {
    const note = (v.logistics || []) as any[];
    if (note.length === 0) continue;
    if (!note.some((n) => typeof n === "string")) continue;

    v.logistics = note
      .map((n) => {
        if (typeof n === "string") {
          const testo = n.trim();
          return testo === "" ? null : { after: null, text: testo };
        }
        return n;
      })
      .filter(Boolean) as any;
    v.markModified("logistics");
    await v.save();
    changed++;
  }
  console.log(`Visite con note logistiche convertite: ${changed}.`);
}

export async function requiredAccounts() {
  const users: { username: string; role: UserRole }[] = [
    { username: "autore1", role: "autore" },
    { username: "autore2", role: "autore" },
    { username: "visitatore1", role: "visitatore" },
    { username: "visitatore2", role: "visitatore" },
    { username: "curatore1", role: "curatore" },
  ];
  for (const u of users) {
    const onInsert: any =
      u.role === "visitatore"
        ? { wallet: 100, collezione: [] }
        : { collezione: [] };
    await UserModel.updateOne(
      { username: u.username, role: u.role },
      { $set: { password: "12345678" }, $setOnInsert: onInsert },
      { upsert: true },
    );
    console.log(`  account pronto: ${u.username} (${u.role})`);
  }

  const roleless = await UserModel.find({ role: { $exists: false } }).lean();
  if (roleless.length > 0) {
    console.log(
      `\n⚠  ${roleless.length} account senza ruolo (non possono accedere): ` +
        roleless.map((o: any) => o.username).join(", ") +
        `\n   Assegna loro un ruolo, oppure eseguendo seedUsers.ts verranno eliminati.`,
    );
  }
}

/**
 * Riallinea gli item scritti quando un contenuto poteva parlare solo di un'opera:
 * `kind` e' "opera" e il museo si legge dall'opera che descrivono. Senza, non
 * appartengono a nessun catalogo e spariscono dal marketplace senza un errore.
 */
async function migrateKinds() {
  const artworks = await ArtworkModel.find().select("@id ofMuseum");
  const museoDi = new Map<string, string>();
  for (const a of artworks) museoDi.set(a["@id"], a.ofMuseum);

  const items = await ItemModel.find();
  let generi = 0;
  let musei = 0;
  let orfani = 0;

  for (const it of items) {
    let cambiato = false;
    if (!it.kind) {
      it.kind = "opera";
      generi++;
      cambiato = true;
    }
    if (!it.ofMuseum) {
      const museo = it.about ? museoDi.get(it.about) : undefined;
      if (!museo) {
        orfani++;
      } else {
        it.ofMuseum = museo;
        musei++;
        cambiato = true;
      }
    }
    if (cambiato) await it.save();
  }

  console.log(
    `Generi: ${generi} item marcati "opera", ${musei} col museo scritto, ` +
      `${orfani} senza opera riconoscibile (lasciati fuori dal catalogo).`,
  );
}

const COMMANDS: Record<string, () => Promise<void>> = {
  stato,
  toni: migrateTones,
  nomi: renameVisits,
  logistica: migrateLogistics,
  generi: migrateKinds,
  account: requiredAccounts,
  async tutto() {
    await migrateTones();
    await renameVisits();
    await migrateLogistics();
    await migrateKinds();
    await requiredAccounts();
    await stato();
  },
};

async function main() {
  const command = process.argv[2] || "stato";
  const action = COMMANDS[command];
  if (!action) {
    console.log(`Comando sconosciuto: "${command}".`);
    console.log(`Disponibili: ${Object.keys(COMMANDS).join(", ")}`);
    process.exit(1);
  }
  try {
    await connect();
    await action();
  } catch (err) {
    console.error("Errore:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Connessione chiusa.");
  }
}

main();
