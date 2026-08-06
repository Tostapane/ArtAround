/**
 * TESTERS: utilità che toccano il database.
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
 *   npx ts-node src/scripts/testers.ts mappe
 *   npx ts-node src/scripts/testers.ts percorso
 *   npx ts-node src/scripts/testers.ts buchi
 *   npx ts-node src/scripts/testers.ts tutto
 */

import { MONGO_URI } from "../env";
import mongoose from "mongoose";
import { ItemModel } from "../models/item";
import { VisitModel } from "../models/visit";
import { ArtworkModel } from "../models/artwork";
import { MuseumModel } from "../models/museum";
import { UserModel } from "../models/user";
import { sortByFlow, getMuseumGraph, MuseumGraph } from "../services/svgGraph";
import { loadMuseumConfigs } from "../data/museumConfigs";
import {
  DEFAULT_LICENSE,
  educationalLevels,
  formatDuration,
} from "../../../shared/constants";
import { UserRole } from "../../../shared/types";

/** Oltre questo, due tappe consecutive non sono piu' un passo ma un ritorno. */
const SALE_FRA_DUE_TAPPE = 2;

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
  console.log(`\nToni negli item:      ${itemTones.sort().join(", ") || "nessuno"}`);
  console.log(`Livelli nelle visite: ${visitLevels.sort().join(", ") || "nessuno"}`);
  console.log(`Toni attesi:          ${educationalLevels.join(", ")}`);

  const offVocabulary = itemTones.filter(
    (t: string) => !educationalLevels.includes(t),
  );
  if (offVocabulary.length > 0) {
    console.log(
      `\n!  ${offVocabulary.length} toni fuori vocabolario: ${offVocabulary.join(", ")}` +
        `\n   Esegui:  npx ts-node src/scripts/testers.ts toni`,
    );
  }

  let problemiMappa = 0;
  for (const config of loadMuseumConfigs()) {
    problemiMappa += problemiDellaMappa(
      getMuseumGraph(config.mapPath),
      config.activeArtworks,
    ).length;
  }
  if (problemiMappa > 0) {
    console.log(
      `\n!  ${problemiMappa} problemi sulle piante (nodi fuori sala, sale isolate, percorsi che saltano).` +
        `\n   Esegui:  npx ts-node src/scripts/testers.ts mappe`,
    );
  }

  const fuoriOrdine = await ordiniDaCorreggere();
  if (fuoriOrdine.length > 0) {
    console.log(
      `\n!  ${fuoriOrdine.length} visite seminate non seguono il data-flow della loro pianta.` +
        `\n   Esegui:  npx ts-node src/scripts/testers.ts percorso`,
    );
  }

  const unplacedNotes = await VisitModel.countDocuments({
    logistics: { $elemMatch: { $type: "string" } },
  });
  if (unplacedNotes > 0) {
    console.log(
      `\n!  ${unplacedNotes} visite con note logistiche senza posizione.` +
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
      `\n!  ${roleless.length} account senza ruolo (non possono accedere): ` +
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

/**
 * Toglie dalle opere i buchi di Wikidata scritti come se fossero nomi.
 *
 * Sono di due forme: la parola "Unknown", e l'indirizzo di un nodo anonimo
 * (`.well-known/genid/…`), che e' quel che Wikidata risponde per un'entita'
 * senza etichetta. Da oggi `services/wikidata.ts` non li scrive piu', ma un
 * riseed non li ripulisce: quando l'opera esiste gia' il seed le aggiorna solo
 * la posizione sulla pianta. Vanno percio' riallineati qui.
 *
 * Il campo diventa una stringa vuota e non sparisce: le viste si chiedono gia'
 * se c'e' un valore, e rispondono con `n/d` o nascondendo la riga.
 */
async function migrateUnknowns() {
  const artworks = await ArtworkModel.find();
  let autori = 0;
  let stili = 0;

  for (const a of artworks) {
    let cambiato = false;
    const buco = (nome: unknown): boolean => {
      if (typeof nome !== "string") return false;
      const pulito = nome.trim();
      if (pulito === "") return false;
      return pulito === "Unknown" || pulito.startsWith("http");
    };
    if (a.author && buco(a.author.name)) {
      a.author.name = "";
      autori++;
      cambiato = true;
    }
    if (a.style && buco(a.style.name)) {
      a.style.name = "";
      stili++;
      cambiato = true;
    }
    if (cambiato) await a.save();
  }

  console.log(
    `Buchi: ${autori} autori e ${stili} stili svuotati su ${artworks.length} opere.`,
  );
}

/**
 * Allinea la licenza dei contenuti GENERATI a `DEFAULT_LICENSE`.
 *
 * Serve perche' il seed la licenza non l'ha mai scritta: gli item nati prima di
 * questa correzione portano il vecchio default dello schema, che era per giunta
 * un indirizzo (`https://creativecommons.org/licenses/by/4.0/`) mentre tutto il
 * resto del sistema usa il codice. A schermo usciva l'indirizzo per esteso.
 *
 * Tocca SOLO quel che ha scritto il museo (`author: "sistema"`). I contenuti di
 * un autore non si toccano: la sua licenza l'ha scelta lui, e cambiargliela
 * sotto i piedi e' l'unica cosa che questo comando non deve poter fare.
 *
 * ⚠️ Non serve dopo un seed nuovo -- da adesso la licenza la scrive il seed --
 * ma serve su un database gia' popolato, perche' il seed **salta gli item che
 * esistono gia'**: riseminare senza `--force` non la riscriverebbe, e con
 * `--force` rigenererebbe anche tutti i testi, cioe' ore di chiamate al modello
 * per cambiare un campo.
 */
async function migrateLicenses() {
  const generati = { author: "sistema" };
  const prima = await ItemModel.distinct("license", generati);
  const r = await ItemModel.updateMany(
    { ...generati, license: { $ne: DEFAULT_LICENSE } },
    { $set: { license: DEFAULT_LICENSE } },
  );
  console.log(`Contenuti generati riallineati: ${r.modifiedCount}`);
  console.log(`  prima: ${prima.map((l) => JSON.stringify(l)).join(" | ")}`);
  console.log(`  ora:   ${JSON.stringify(DEFAULT_LICENSE)}`);

  const altrui = await ItemModel.distinct("license", { author: { $ne: "sistema" } });
  console.log(`Licenze dei contenuti d'autore, non toccate: ${altrui.length === 0 ? "(nessun contenuto d'autore)" : altrui.join(" | ")}`);
}

// --- Piante e percorsi ------------------------------------------------------

/**
 * Il collaudo di una pianta: le regole che il parser non puo' far rispettare.
 *
 * `svgGraph.ts` legge quel che il curatore ha annotato e non giudica: un nodo
 * fuori da ogni sala, una sala irraggiungibile o un percorso che salta da
 * un'ala all'altra sono disegni leciti. Nessuno di questi da' errore: la mappa
 * si carica, il percorso si calcola, e la cosa sbagliata si vede soltanto
 * camminando. Ogni controllo qui sotto e' un modo di sbagliare gia' successo.
 *
 * Il piu' importante e' l'ULTIMO, ed e' quello che sembra piu' innocuo.
 * `data-flow` non e' una classifica, e' un CAMMINO: numeri crescenti dicono
 * solo che nessuna sala si visita due volte, non che la 25 sia accanto alla 24.
 * In una galleria di sale in fila la differenza non si vede; in un edificio a
 * piu' ali o a piu' piani, una numerazione crescente puo' mandare il visitatore
 * avanti e indietro per mezzo museo a ogni tappa. La distanza fra due numeri
 * consecutivi deve percio' essere UNA sala (c'e' una porta) o DUE (si passa dal
 * corridoio, che e' una sala anche lui).
 *
 * Il controllo guarda il GRAFO, non il disegno: non sa dire se un'opera sta
 * nella sala giusta o se l'ordine ha senso per un curatore. Dice se la pianta
 * e' percorribile, che e' l'unica meta' verificabile da una macchina.
 */
function problemiDellaMappa(graph: MuseumGraph, qidAttesi: string[]): string[] {
  const problemi: string[] = [];

  for (const n of graph.nodes) {
    if (n.room) continue;
    problemi.push(
      `nodo fuori da ogni sala: ${n.elementId || n.qid || n.poiType} (${n.x}, ${n.y})`,
    );
  }
  for (const o of graph.obstacles) {
    if (!o.room) problemi.push(`ostacolo fuori da ogni sala: "${o.description}"`);
  }

  const ingresso = graph.nodes.find((n) => n.poiType === "entrance");
  if (!ingresso) {
    problemi.push('nessun data-poi="entrance": la localizzazione non parte');
  }

  const vicini = new Map<string, string[]>();
  for (const r of graph.regions) vicini.set(r.name, r.neighbors);

  if (ingresso && ingresso.room) {
    const viste = new Set<string>([ingresso.room]);
    const coda = [ingresso.room];
    while (coda.length > 0) {
      const qui = coda.shift() as string;
      for (const v of vicini.get(qui) || []) {
        if (viste.has(v)) continue;
        viste.add(v);
        coda.push(v);
      }
    }
    for (const r of graph.regions) {
      if (!viste.has(r.name)) {
        problemi.push(`sala non raggiungibile dall'ingresso: "${r.name}"`);
      }
    }
  }

  const perFlusso = new Map<number, string>();
  for (const r of graph.regions) {
    if (r.flow <= 0) continue;
    const gia = perFlusso.get(r.flow);
    if (gia) problemi.push(`data-flow ${r.flow} su due sale: "${gia}" e "${r.name}"`);
    else perFlusso.set(r.flow, r.name);
  }

  const conOpere = new Set<string>();
  for (const n of graph.nodes) {
    if (n.kind === "artwork" && n.room) conOpere.add(n.room);
  }
  for (const r of graph.regions) {
    if (conOpere.has(r.name) && r.flow <= 0) {
      problemi.push(`la sala "${r.name}" ha opere ma nessun data-flow: finiranno in fondo`);
    }
  }

  const inOrdine = graph.regions
    .filter((r) => r.flow > 0)
    .sort((a, b) => a.flow - b.flow);
  for (let i = 1; i < inOrdine.length; i++) {
    const prima = inOrdine[i - 1];
    const poi = inOrdine[i];
    const passi = distanzaFraSale(vicini, prima.name, poi.name);
    if (passi > SALE_FRA_DUE_TAPPE) {
      const quante = passi === Infinity ? "nessun cammino" : `${passi} sale`;
      problemi.push(
        `il percorso salta: ${prima.flow}. "${prima.name}" -> ${poi.flow}. "${poi.name}" (${quante})`,
      );
    }
  }

  const disegnate = new Set<string>();
  for (const n of graph.nodes) {
    if (n.kind === "artwork") disegnate.add(n.qid);
  }
  for (const qid of qidAttesi) {
    if (!disegnate.has(qid)) problemi.push(`l'opera ${qid} non ha un nodo sulla pianta`);
  }

  return problemi;
}

function distanzaFraSale(
  vicini: Map<string, string[]>,
  da: string,
  a: string,
): number {
  if (da === a) return 0;
  const visti = new Map<string, number>([[da, 0]]);
  const coda = [da];
  while (coda.length > 0) {
    const qui = coda.shift() as string;
    const passi = visti.get(qui) as number;
    for (const v of vicini.get(qui) || []) {
      if (visti.has(v)) continue;
      if (v === a) return passi + 1;
      visti.set(v, passi + 1);
      coda.push(v);
    }
  }
  return Infinity;
}

/** Il collaudo di tutte le piante configurate. Non tocca il database. */
async function checkMaps() {
  let totale = 0;
  for (const config of loadMuseumConfigs()) {
    const problemi = problemiDellaMappa(
      getMuseumGraph(config.mapPath),
      config.activeArtworks,
    );
    if (problemi.length === 0) {
      console.log(`  ${config.name}: percorribile.`);
      continue;
    }
    totale += problemi.length;
    console.log(`  ${config.name} (${config.qid}):`);
    for (const p of problemi) console.log(`    ! ${p}`);
  }
  console.log(
    totale === 0
      ? "Piante: nessun problema."
      : `Piante: ${totale} problemi. Si correggono sull'SVG, non nel database.`,
  );
}

/**
 * Le visite SEMINATE che non sono nell'ordine in cui il museo si attraversa,
 * con l'ordine giusto accanto. La usano il resoconto (che segnala) e la
 * migrazione (che riscrive), cosi' "qual e' l'ordine giusto" e' scritto una
 * volta sola.
 *
 * Guarda SOLO i `@id` che cominciano per `visit-`, il prefisso del seed: quelle
 * d'autore (`tour-…`) e quelle su misura (`custom-…`) hanno l'ordine che ha
 * scelto qualcuno, e non e' cosa da riallineare.
 */
async function ordiniDaCorreggere(): Promise<
  { visita: any; ordinati: string[] }[]
> {
  const daFare: { visita: any; ordinati: string[] }[] = [];
  for (const museo of await MuseumModel.find().select("@id qid mapPath")) {
    if (!museo.mapPath) continue;
    const visite = await VisitModel.find({
      ofMuseum: museo["@id"],
      "@id": { $regex: "^visit-" },
    });
    for (const visita of visite) {
      const ids = visita.itemListElement || [];
      if (ids.length < 2) continue;
      const items = await ItemModel.find({ "@id": { $in: ids } }).select("@id about");
      const conQid = items.map((it) => {
        const pezzi = String(it.about || "").split("/");
        return { id: it["@id"], qid: pezzi[pezzi.length - 1] };
      });
      const ordinati = sortByFlow(conQid, museo.mapPath).map((r) => r.id);
      if (ordinati.length !== ids.length) {
        console.log(
          `  ! ${visita["@id"]}: ${ids.length} tappe ma ${ordinati.length} item ritrovati, lasciata com'era`,
        );
        continue;
      }
      if (ordinati.join("|") === ids.join("|")) continue;
      daFare.push({ visita, ordinati });
    }
  }
  return daFare;
}

/**
 * Rimette le tappe delle visite seminate nell'ordine in cui il museo si
 * attraversa.
 *
 * Il seed le scriveva nell'ordine in cui il database restituiva gli item, che
 * non e' un ordine: il percorso rimbalzava da una sala all'altra, e da quando
 * le piante hanno i piani saliva e scendeva le scale a ogni tappa. Da oggi il
 * seed le ordina da se' (`inOrdineDiPercorso`), ma le visite gia' scritte
 * restano come sono: rifarle costerebbe ore di chiamate al modello per
 * rigenerare testi che vanno benissimo, mentre qui si riscrive solo l'elenco.
 * Serve anche dopo ogni ritocco ai `data-flow` di una pianta.
 *
 * Nel percorso con contenuti opzionali gli opzionali tornano a essere la
 * seconda meta' del cammino, che e' la regola del seed: tenendo il vecchio
 * insieme diventerebbero tappe sparse a caso lungo il nuovo giro.
 */
async function migrateVisitOrder() {
  const daFare = await ordiniDaCorreggere();
  for (const { visita, ordinati } of daFare) {
    visita.itemListElement = ordinati;
    if (visita.optionalItems && visita.optionalItems.length > 0) {
      visita.optionalItems = ordinati.slice(Math.ceil(ordinati.length / 2));
    }
    await visita.save();
  }
  console.log(
    `Percorsi: ${daFare.length} visite riordinate secondo il data-flow della mappa.`,
  );
}

const COMMANDS: Record<string, () => Promise<void>> = {
  stato,
  toni: migrateTones,
  nomi: renameVisits,
  logistica: migrateLogistics,
  generi: migrateKinds,
  buchi: migrateUnknowns,
  licenze: migrateLicenses,
  account: requiredAccounts,
  mappe: checkMaps,
  percorso: migrateVisitOrder,
  async tutto() {
    await migrateTones();
    await renameVisits();
    await migrateLogistics();
    await migrateKinds();
    await migrateUnknowns();
    await migrateVisitOrder();
    await requiredAccounts();
    await checkMaps();
    await stato();
  },
};

/**
 * Il collaudo delle piante legge file, non documenti: deve poter girare su una
 * copia appena scaricata, PRIMA del seed. E' li' che serve, perche' aggiungere
 * un museo e' un JSON piu' un SVG e poi ore di seed: sapere prima se la pianta
 * si cammina evita di scoprirlo dopo.
 */
const SENZA_DATABASE = new Set(["mappe"]);

async function main() {
  const command = process.argv[2] || "stato";
  const action = COMMANDS[command];
  if (!action) {
    console.log(`Comando sconosciuto: "${command}".`);
    console.log(`Disponibili: ${Object.keys(COMMANDS).join(", ")}`);
    process.exit(1);
  }
  const serveIlDatabase = !SENZA_DATABASE.has(command);
  try {
    if (serveIlDatabase) await connect();
    await action();
  } catch (err) {
    console.error("Errore:", err);
    process.exitCode = 1;
  } finally {
    if (serveIlDatabase) {
      await mongoose.disconnect();
      console.log("Connessione chiusa.");
    }
  }
}

main();
