import "./env";
import mongoose from "mongoose";
import { ItemModel } from "./models/item";
import { VisitModel } from "./models/visit";
import { ArtworkModel } from "./models/artwork";
import { MuseumModel } from "./models/museum";
import { UserModel } from "./models/user";
import { educationalLevels, formatDurata } from "../../shared/constants";

/**
 * TESTERS — utilità che toccano il DATABASE.
 *
 * Tutto ciò che modifica dati esistenti vive qui e solo qui: il seed ricostruisce
 * da zero (e costa ore di chiamate all'LLM), queste funzioni invece riallineano
 * quello che c'è già. Sono idempotenti: eseguirle due volte non fa danni.
 *
 * Uso:
 *   npx ts-node src/testers.ts stato
 *   npx ts-node src/testers.ts toni
 *   npx ts-node src/testers.ts nomi
 *   npx ts-node src/testers.ts logistica
 *   npx ts-node src/testers.ts tutto
 */

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";

/**
 * I toni vecchi -> i toni della specifica (slide 22).
 *
 * Il sistema aveva DUE vocabolari per lo stesso campo: l'editor scriveva
 * infantile/semplice/medio/avanzato (che è quello della slide), mentre il seed,
 * il pianificatore LLM e i filtri usavano Principiante/Intermedio/Avanzato. Si
 * sovrapponevano su un solo valore. Ora `shared/constants.ts` ha i quattro toni
 * della slide, e questa mappa porta i dati esistenti sulla stessa lingua.
 *
 * NOTA IMPORTANTE: si cambia SOLO il campo, mai l'`@id`. L'id contiene il tono
 * (`Q123-autore-Intermedio-60`) ma è referenziato da `Visit.itemListElement` e
 * da `User.collezione`: riscriverlo spezzerebbe ogni visita e ogni libreria.
 * Un id è opaco — deve restare stabile, non descrittivo.
 */
const MAPPA_TONI: Record<string, string> = {
  Principiante: "Semplice",
  Intermedio: "Medio",
  // "Avanzato" esiste identico in entrambi i vocabolari: nessuna conversione.
  // Le forme minuscole dell'editor vecchio vengono normalizzate in maiuscolo.
  infantile: "Infantile",
  semplice: "Semplice",
  medio: "Medio",
  avanzato: "Avanzato",
};

async function connetti() {
  console.log("Connessione a MongoDB…");
  await mongoose.connect(MONGO_URI);
  console.log("Connesso.");
}

/** Fotografia dello stato: quanti documenti, e con quali valori. */
export async function stato() {
  const [musei, opere, item, visite, utenti] = await Promise.all([
    MuseumModel.countDocuments(),
    ArtworkModel.countDocuments(),
    ItemModel.countDocuments(),
    VisitModel.countDocuments(),
    UserModel.countDocuments(),
  ]);
  console.log(
    `\nMusei ${musei} · Opere ${opere} · Item ${item} · Visite ${visite} · Utenti ${utenti}`,
  );

  const toniItem = await ItemModel.distinct("educationalLevel");
  const livelliVisite = await VisitModel.distinct("level");
  console.log(`\nToni negli item:      ${toniItem.sort().join(", ") || "—"}`);
  console.log(`Livelli nelle visite: ${livelliVisite.sort().join(", ") || "—"}`);
  console.log(`Toni attesi:          ${educationalLevels.join(", ")}`);

  const fuoriVocabolario = toniItem.filter(
    (t: string) => !educationalLevels.includes(t),
  );
  if (fuoriVocabolario.length > 0) {
    console.log(
      `\n⚠  ${fuoriVocabolario.length} toni fuori vocabolario: ${fuoriVocabolario.join(", ")}` +
        `\n   Esegui:  npx ts-node src/testers.ts toni`,
    );
  }

  const vecchieNote = await VisitModel.countDocuments({
    logistics: { $elemMatch: { $type: "string" } },
  });
  if (vecchieNote > 0) {
    console.log(
      `\n⚠  ${vecchieNote} visite con note logistiche senza posizione.` +
        `\n   Esegui:  npx ts-node src/testers.ts logistica`,
    );
  }
  console.log("");
}

/** Riallinea i toni di item e visite al vocabolario della specifica. */
export async function migraToni() {
  let itemCambiati = 0;
  for (const [vecchio, nuovo] of Object.entries(MAPPA_TONI)) {
    if (vecchio === nuovo) continue;
    const r = await ItemModel.updateMany(
      { educationalLevel: vecchio },
      { $set: { educationalLevel: nuovo } },
    );
    if (r.modifiedCount) {
      console.log(`  item: ${vecchio} -> ${nuovo}  (${r.modifiedCount})`);
      itemCambiati += r.modifiedCount;
    }
  }

  let visiteCambiate = 0;
  for (const [vecchio, nuovo] of Object.entries(MAPPA_TONI)) {
    if (vecchio === nuovo) continue;
    const r = await VisitModel.updateMany(
      { level: vecchio },
      { $set: { level: nuovo } },
    );
    if (r.modifiedCount) {
      console.log(`  visite: ${vecchio} -> ${nuovo}  (${r.modifiedCount})`);
      visiteCambiate += r.modifiedCount;
    }
  }

  console.log(
    `Toni riallineati: ${itemCambiati} item, ${visiteCambiate} visite. ` +
      `Gli @id restano invariati (sono referenziati da visite e librerie).`,
  );
}

/**
 * Dà alle visite generate dal seed un nome che una persona possa scegliere.
 * "Visita Principiante · 15s per opera" è il nome di una riga di database, non
 * di un percorso: dice i secondi per opera, che nessuno sa interpretare, e non
 * dice quante tappe ci sono né quanto dura in tutto.
 */
export async function rinominaVisite() {
  const visite = await VisitModel.find({});
  let cambiate = 0;

  for (const v of visite) {
    // Solo i nomi generati automaticamente: quelli scritti da una persona
    // non si toccano.
    if (!/^Visita .+ · \d+s per opera$/.test(v.name || "")) continue;

    const tappe = (v.itemListElement || []).length;
    const nome =
      `${etichettaLivello(v.level)} · ${tappe} ${tappe === 1 ? "tappa" : "tappe"} · ` +
      formatDurata(v.duration);
    console.log(`  "${v.name}"  ->  "${nome}"`);
    v.name = nome;
    await v.save();
    cambiate++;
  }
  console.log(`Visite rinominate: ${cambiate}.`);
}

/** Un titolo umano per il livello, invece della sola etichetta tecnica. */
function etichettaLivello(livello: string): string {
  const titoli: Record<string, string> = {
    Infantile: "Percorso per i più piccoli",
    Semplice: "Percorso introduttivo",
    Medio: "Percorso completo",
    Avanzato: "Percorso approfondito",
  };
  return titoli[livello] || `Percorso ${livello}`;
}

/**
 * Porta le note logistiche al formato con posizione.
 * Le vecchie erano stringhe nude: si sapeva CHE c'erano, non DOVE andavano.
 * Non potendo indovinare a quale tappa appartenessero, diventano note di
 * apertura (`after: null`) — corrette e visibili, invece che perse.
 */
export async function migraLogistica() {
  const visite = await VisitModel.find({});
  let cambiate = 0;

  for (const v of visite) {
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
    cambiate++;
  }
  console.log(`Visite con note logistiche convertite: ${cambiate}.`);
}

/**
 * Crea i quattro account richiesti dalla specifica (slide "Requisiti di
 * progetto": autore1, autore2, visitatore1, visitatore2, password "12345678").
 *
 * Differenza importante rispetto a `seedUsers.ts`: quello CANCELLA i documenti
 * senza ruolo rimasti dal vecchio modello, questo non cancella niente. Se nel
 * database ci sono account di prova a cui tieni, usa questo.
 * Idempotente: aggiorna la password se l'account c'è già, senza toccare
 * wallet e collezione.
 */
export async function accountRichiesti() {
  const utenti: { username: string; role: "autore" | "visitatore" }[] = [
    { username: "autore1", role: "autore" },
    { username: "autore2", role: "autore" },
    { username: "visitatore1", role: "visitatore" },
    { username: "visitatore2", role: "visitatore" },
  ];
  for (const u of utenti) {
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

  // Segnala — senza toccarli — i documenti senza ruolo: non possono più
  // accedere (il login li rifiuta apposta) e vanno o corretti o rimossi.
  const orfani = await UserModel.find({ role: { $exists: false } }).lean();
  if (orfani.length > 0) {
    console.log(
      `\n⚠  ${orfani.length} account senza ruolo (non possono accedere): ` +
        orfani.map((o: any) => o.username).join(", ") +
        `\n   Assegna loro un ruolo, oppure eseguendo seedUsers.ts verranno eliminati.`,
    );
  }
}

const COMANDI: Record<string, () => Promise<void>> = {
  stato,
  toni: migraToni,
  nomi: rinominaVisite,
  logistica: migraLogistica,
  account: accountRichiesti,
  async tutto() {
    await migraToni();
    await rinominaVisite();
    await migraLogistica();
    await accountRichiesti();
    await stato();
  },
};

async function main() {
  const comando = process.argv[2] || "stato";
  const azione = COMANDI[comando];
  if (!azione) {
    console.log(`Comando sconosciuto: "${comando}".`);
    console.log(`Disponibili: ${Object.keys(COMANDI).join(", ")}`);
    process.exit(1);
  }
  try {
    await connetti();
    await azione();
  } catch (err) {
    console.error("Errore:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Connessione chiusa.");
  }
}

main();
