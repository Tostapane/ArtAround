/**
 * TESTERS: utilità che toccano il database.
 *
 * Tutto ciò che modifica dati esistenti vive qui e solo qui: il seed ricostruisce
 * da zero (e costa ore di chiamate all'LLM), queste funzioni invece riallineano
 * quello che c'è già. Sono idempotenti: eseguirle due volte non fa danni.
 *
 * Uso:
 *
 *     npx ts-node src/scripts/testers.ts <comando>
 *
 * L'elenco dei comandi non e' ricopiato qui: e' `COMMANDS`, in fondo al file, e un
 * comando sconosciuto lo stampa. Senza argomenti si esegue `stato`, che e' il
 * quadro d'insieme e nomina il comando da lanciare per ogni cosa fuori posto.
 * `tutto` li esegue tutti in fila e chiude con `stato`.
 *
 * Ogni comando porta sopra di se' che cosa riallinea e perche', che e' quel che si
 * va a cercare aprendo un file di comandi — la stessa eccezione che vale per le
 * rotte (`guidelines.md` §2).
 *
 * Un comando solo, `mappe`, non ha bisogno del database: legge file, quindi puo'
 * girare su una copia appena scaricata PRIMA del seed. E' li' che serve, perche'
 * aggiungere un museo e' un JSON piu' un SVG e poi ore di seed, e sapere prima se
 * la pianta si cammina evita di scoprirlo dopo.
 */

import { MONGO_URI } from "../env";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { ItemModel } from "../models/item";
import { VisitModel } from "../models/visit";
import { ArtworkModel } from "../models/artwork";
import { MuseumModel } from "../models/museum";
import { UserModel } from "../models/user";
import { sortByFlow, getMuseumGraph, MuseumGraph } from "../services/svgGraph";
import { loadMuseumConfigs } from "../data/museumConfigs";
import {
  scriviMiniatura,
  EsitoMiniatura,
} from "../services/imageDownloader";
import {
  DEFAULT_LICENSE,
  educationalLevels,
  formatDuration,
  secPerArt,
  SEED_AUTHOR,
  priceForTone,
} from "../../../shared/constants";
import { UserRole } from "../../../shared/types";

/** La radice dei file serviti: `mapPath` e `imagePath` sono relativi a questa. */
const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");

/**
 * Che cosa non va in una copertina dichiarata, in una riga, oppure "" se va bene.
 *
 * I percorsi delle figure si scrivono a mano nel file di configurazione, e il
 * modo in cui sbagliano quasi sempre e' l'ESTENSIONE: `.jpg` e `.jpeg` sono lo
 * stesso formato con due nomi, e quale dei due esca dipende da chi ha scaricato
 * il file, non da noi. Cercando lo stesso nome con un'altra estensione si passa
 * da "manca" a "manca perche' l'hai chiamato cosi'", che e' la differenza fra
 * un avviso e un'istruzione.
 *
 * Non si corregge il file da qui: la configurazione e' un INGRESSO, e niente nel
 * server la riscrive (vedi la testa di `museumConfigs.ts`). Correggerla di
 * nascosto vorrebbe dire che quel file non e' piu' la fonte di quel che si vede.
 */
function guaioCopertina(percorso: string): string {
  if (fs.existsSync(path.join(PUBLIC_DIR, percorso))) return "";
  const suDisco = path.join(PUBLIC_DIR, percorso);
  const cartella = path.dirname(suDisco);
  const nudo = path.basename(percorso, path.extname(percorso));
  let omonimi: string[] = [];
  try {
    omonimi = fs
      .readdirSync(cartella)
      .filter((f) => f !== path.basename(percorso))
      .filter((f) => path.basename(f, path.extname(f)) === nudo);
  } catch {
    // Cartella illeggibile: se ne lamenta gia' loadMuseumConfigs.
  }
  if (omonimi.length > 0)
    return (
      `dichiara ${percorso}, ma sul disco c'e' ${path.dirname(percorso)}/${omonimi[0]}` +
      ` — cambia quella riga nel file di configurazione`
    );
  return `dichiara ${percorso}, ma quel file non c'e'`;
}

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

/**
 * Riporta nei documenti dei musei quel che dice oggi la loro configurazione:
 * la pianta e la copertina.
 *
 * Serve perche' quei due campi si copiano nel documento al momento del seed e
 * poi non si rileggono piu': cambiare `mapPath` nel JSON non tocca il database,
 * e il museo continua a chiedere una pianta all'indirizzo vecchio. Non e' un
 * guasto che si vede subito — la vetrina e il catalogo funzionano lo stesso —
 * ma il navigator non disegna piu' la sala e il calcolo del percorso resta
 * senza grafo.
 *
 * Non tocca nient'altro del museo: nome, luogo e anno restano quelli che ci
 * sono, perche' li puo' aver corretti il curatore dopo il seed.
 *
 * Avverte anche sulle copertine dichiarate e non trovate: `imagePath` si scrive a
 * mano, e un ".jpg" scritto sopra un file salvato in .png non da' nessun errore —
 * la carta del museo torna al solo testo, che e' esattamente quel che fa anche una
 * copertina non messa. Dei due silenzi solo uno e' voluto, quindi l'altro si dice.
 */
export async function migrateMuseumPaths() {
  let cambiati = 0;
  for (const config of loadMuseumConfigs()) {
    const museo = await MuseumModel.findOne({ qid: config.qid });
    if (!museo) {
      console.log(`  ${config.name}: non e' nel database, salto.`);
      continue;
    }
    if (config.imagePath) {
      const guaio = guaioCopertina(config.imagePath);
      if (guaio)
        console.log(`  ! ${config.name}: ${guaio}. La carta restera' di solo testo.`);
    }
    const vecchiaMappa = museo.mapPath || "";
    const vecchiaCopertina = museo.imagePath || "";
    const nuovaCopertina = config.imagePath || "";
    if (vecchiaMappa === config.mapPath && vecchiaCopertina === nuovaCopertina)
      continue;

    museo.mapPath = config.mapPath;
    museo.imagePath = nuovaCopertina;
    await museo.save();
    cambiati++;
    console.log(
      `  ${config.name}: mappa ${vecchiaMappa || "(vuota)"} -> ${config.mapPath}` +
        `, copertina ${vecchiaCopertina || "(vuota)"} -> ${nuovaCopertina || "(vuota)"}`,
    );
  }
  console.log(`Musei riallineati alla configurazione: ${cambiati}.`);
  await migrateVisitCovers();
}

/**
 * Porta nelle visite seminate la copertina che il file di configurazione da' al
 * loro tono.
 *
 * Le assegna anche il seed, ma il seed rifa' i testi: cambiare una figura non
 * puo' costare un giro di chiamate al modello, quindi la stessa assegnazione
 * vive anche qui. Tocca solo le visite di catalogo — quelle che il seed genera,
 * riconoscibili dall'`@id` — e lascia stare quelle composte dagli autori, che
 * la copertina se la scelgono caricandola.
 */
async function migrateVisitCovers() {
  let cambiate = 0;
  for (const config of loadMuseumConfigs()) {
    const copertine = config.visitImages;
    if (!copertine) continue;
    for (const tono of Object.keys(copertine)) {
      const guaio = guaioCopertina(copertine[tono]);
      if (guaio) console.log(`  ! ${config.name} / ${tono}: ${guaio}.`);
      const esito = await VisitModel.updateMany(
        { "@id": new RegExp(`^visit-${config.qid}-${tono}-`), level: tono },
        { $set: { imagePath: copertine[tono] } },
      );
      cambiate += esito.modifiedCount;
    }
  }
  console.log(`Visite di catalogo con la copertina del loro tono: ${cambiate}.`);
}

/**
 * Se il seed ha davvero prodotto tutta la griglia: per ogni opera attiva di ogni
 * museo, un contenuto per OGNI tono e OGNI durata.
 *
 * Il seed e' interrompibile e riprendibile, quindi la domanda "e' finito?" non
 * ha risposta guardandolo girare: la risposta e' qui, ed e' un conteggio. Le
 * opere si dividono in tre, e la terza colonna e' quella che conta: un'opera a
 * meta' griglia vuol dire un seed caduto in mezzo a quell'opera, ed e' l'unico
 * caso in cui rilanciare non basta — quella va rifatta con `--force`.
 *
 * Conta i contenuti di `sistema`, non tutti: quelli scritti dagli autori vivono
 * sulle stesse opere ma non devono coprire nessuna griglia. E le caselle riempite
 * si contano SULLE OPERE ATTIVE e non sui contenuti che stanno nel database: se
 * un'opera esce da `activeArtworks` i suoi contenuti restano li', e sommarli
 * direbbe "non manca niente" mentre in vetrina mancano opere intere.
 */
export async function checkItemGrid() {
  const durate = secPerArt.map((d) => `${d}`);
  const attesiPerOpera = educationalLevels.length * secPerArt.length;

  for (const config of loadMuseumConfigs()) {
    const uri = `http://www.wikidata.org/entity/${config.qid}`;
    const items = await ItemModel.find({
      kind: "opera",
      author: SEED_AUTHOR,
      ofMuseum: uri,
    }).select("about educationalLevel timeRequired");

    const visti = new Set(
      items.map(
        (i: any) => `${i.about}|${i.educationalLevel}|${i.timeRequired}`,
      ),
    );

    const complete: string[] = [];
    const parziali: { qid: string; n: number }[] = [];
    const assenti: string[] = [];
    let riempite = 0;
    for (const qid of config.activeArtworks) {
      let n = 0;
      for (const tono of educationalLevels) {
        for (const durata of durate) {
          if (visti.has(`http://www.wikidata.org/entity/${qid}|${tono}|${durata}`))
            n++;
        }
      }
      riempite += n;
      if (n === attesiPerOpera) complete.push(qid);
      else if (n === 0) assenti.push(qid);
      else parziali.push({ qid, n });
    }

    const attesi = config.activeArtworks.length * attesiPerOpera;
    const orfani = items.length - riempite;
    console.log(
      `\n${config.name} — ${config.activeArtworks.length} opere attive, ` +
        `${educationalLevels.length} toni x ${secPerArt.length} durate = ${attesi} contenuti attesi`,
    );
    console.log(
      `  complete ${complete.length}   parziali ${parziali.length}   assenti ${assenti.length}` +
        `   (caselle riempite ${riempite}/${attesi}, ne mancano ${attesi - riempite})`,
    );
    if (orfani > 0)
      console.log(
        `  ${orfani} contenuti di opere non piu' in activeArtworks: restano nel ` +
          `database e non si vedono in vetrina.`,
      );
    if (parziali.length > 0) {
      console.log(
        `  ! ${parziali.length} opere a meta' griglia: ` +
          parziali.slice(0, 8).map((p) => `${p.qid}=${p.n}/${attesiPerOpera}`).join(", "),
      );
      console.log(
        `    Rilanciare il seed NON le completa: sono opere che il catalogo da' per fatte.` +
          `\n    Esegui:  npx ts-node src/scripts/seed.ts ${config.qid} --force`,
      );
    }
    if (assenti.length > 0) {
      console.log(
        `  ${assenti.length} opere ancora da fare: ` +
          assenti.slice(0, 8).join(", ") +
          (assenti.length > 8 ? " …" : ""),
      );
      console.log(
        `    Esegui:  npx ts-node src/scripts/seed.ts ${config.qid}` +
          `   (il seed stampa la sua stima mentre gira)`,
      );
    }
    if (parziali.length === 0 && assenti.length === 0)
      console.log("  griglia completa.");
  }
  console.log("");
}

/**
 * Chiude le visite composte da chi non e' autore.
 *
 * Da oggi la visibilita' si scrive alla creazione (`POST /visits`), ma le visite
 * gia' nel database non ce l'hanno e valgono percio' pubbliche: l'itinerario che
 * un visitatore aveva composto per se' e' rimasto in vetrina a tutti. Qui si
 * guarda il RUOLO DI OGGI di chi l'ha scritta, che per una visita gia' esistente
 * e' l'unica informazione disponibile.
 *
 * Non tocca le visite seminate (autore `sistema`) ne' quelle di un autore: le
 * prime sono il catalogo, le seconde sono in vendita.
 *
 * Alle altre scrive "pubblico" per esteso. Funzionerebbero anche senza — i filtri
 * chiedono `$ne: "privato"` proprio per non dipendere da un campo che le visite
 * piu' vecchie non hanno — ma restare senza vorrebbe dire due modi di dire la
 * stessa cosa, di cui uno invisibile: chi un giorno cercasse
 * `{visibility: "pubblico"}` per avere il catalogo si troverebbe con zero
 * risultati e nessun errore. Il seed da solo non le sistema, perche' `insertVisit`
 * e' un upsert e su un documento che esiste gia' i valori di scorta non scattano.
 */
export async function migrateVisitVisibility() {
  const visits = await VisitModel.find({ visibility: { $ne: "privato" } });
  let chiuse = 0;
  for (const v of visits) {
    if (!v.author || v.author === SEED_AUTHOR) continue;
    const account = await UserModel.findOne({ username: v.author });
    if (!account) {
      console.log(`  ${v["@id"]}: autore "${v.author}" non e' un account, salto.`);
      continue;
    }
    if (account.role === "autore") continue;
    v.visibility = "privato";
    await v.save();
    chiuse++;
    console.log(
      `  ${v["@id"]}: composta da ${v.author} (${account.role}) -> privata.`,
    );
  }
  console.log(`Visite passate a privata: ${chiuse}.`);

  const esito = await VisitModel.updateMany(
    { visibility: { $exists: false } },
    { $set: { visibility: "pubblico" } },
  );
  console.log(`Visite senza il campo, ora esplicitamente pubbliche: ${esito.modifiedCount}.`);
}

/**
 * Da `sistema` a `Museo` nel nome dell'autore dei contenuti seminati.
 *
 * **Va eseguita PRIMA del prossimo seed.** Il seed riconosce quel che ha gia'
 * scritto cercando `author: SEED_AUTHOR`: finche' nel database c'e' ancora
 * "sistema" non trova niente, e rigenera da capo ogni descrizione — migliaia di
 * chiamate al modello, e altrettanti documenti doppi.
 *
 * Non tocca gli `@id`, che restano `…-sistema-…`: sono indirizzi permanenti a
 * cui puntano le tappe delle visite e le librerie (vedi `SEED_ID_TOKEN`).
 */
export async function migrateSeedAuthor() {
  const vecchio = "sistema";
  const item = await ItemModel.updateMany(
    { author: vecchio },
    { $set: { author: SEED_AUTHOR } },
  );
  const visite = await VisitModel.updateMany(
    { author: vecchio },
    { $set: { author: SEED_AUTHOR } },
  );
  console.log(
    `Autore dei contenuti seminati "${vecchio}" -> "${SEED_AUTHOR}": ` +
      `${item.modifiedCount} contenuti, ${visite.modifiedCount} visite.`,
  );
  const rimasti = await ItemModel.countDocuments({ author: vecchio });
  if (rimasti > 0) console.log(`  ! ne restano ${rimasti} col nome vecchio.`);
}

/**
 * Riporta i prezzi del catalogo del museo sul listino per tono.
 *
 * I contenuti seminati prima avevano un prezzo estratto a sorte: due
 * descrizioni della stessa opera potevano costare 5 e 30 centesimi senza che la
 * differenza volesse dire niente. Ora il prezzo segue il tono (`priceByTone`), e
 * questa funzione riscrive quel che c'e' gia'.
 *
 * Tocca SOLO quel che ha scritto il museo: i contenuti degli autori hanno il
 * prezzo che ha deciso il loro autore, e non e' cosa nostra.
 *
 * Non restituisce e non ritira niente a chi ha gia' comprato: un acquisto e'
 * gia' avvenuto, e il portafoglio non si ricalcola all'indietro. Cambia quanto
 * costera' da adesso — compreso il totale delle visite, che si somma sulle
 * tappe non possedute.
 */
export async function migrateSeedPrices() {
  const prima = await ItemModel.aggregate([
    { $match: { author: SEED_AUTHOR } },
    { $group: { _id: "$price", n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log(
    "  prezzi prima: " +
      prima.map((r: any) => `${r._id}€ x${r.n}`).join(", "),
  );

  let cambiati = 0;
  for (const tono of educationalLevels) {
    const esito = await ItemModel.updateMany(
      { author: SEED_AUTHOR, educationalLevel: tono, price: { $ne: priceForTone(tono) } },
      { $set: { price: priceForTone(tono) } },
    );
    cambiati += esito.modifiedCount;
    console.log(
      `  ${tono.padEnd(10)} -> ${priceForTone(tono).toFixed(2)}€   (${esito.modifiedCount} riscritti)`,
    );
  }
  console.log(`Contenuti del museo riprezzati: ${cambiati}.`);
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
 * Non serve dopo un seed nuovo -- da adesso la licenza la scrive il seed --
 * ma serve su un database gia' popolato, perche' il seed **salta gli item che
 * esistono gia'**: riseminare senza `--force` non la riscriverebbe, e con
 * `--force` rigenererebbe anche tutti i testi, cioe' ore di chiamate al modello
 * per cambiare un campo.
 */
async function migrateLicenses() {
  const generati = { author: SEED_AUTHOR };
  const prima = await ItemModel.distinct("license", generati);
  const r = await ItemModel.updateMany(
    { ...generati, license: { $ne: DEFAULT_LICENSE } },
    { $set: { license: DEFAULT_LICENSE } },
  );
  console.log(`Contenuti generati riallineati: ${r.modifiedCount}`);
  console.log(`  prima: ${prima.map((l) => JSON.stringify(l)).join(" | ")}`);
  console.log(`  ora:   ${JSON.stringify(DEFAULT_LICENSE)}`);

  const altrui = await ItemModel.distinct("license", { author: { $ne: SEED_AUTHOR } });
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
 * Dove ci sono tappe opzionali, quelle tornano a essere la seconda meta' del
 * cammino, che e' la regola del seed: tenendo il vecchio insieme diventerebbero
 * tappe sparse a caso lungo il nuovo giro.
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

const PAUSA_WIKIMEDIA_MS = 500; // sotto questa cadenza Wikimedia risponde 429, e i ritentativi non bastano

function pausa(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scrive le miniature che mancano alle opere gia' sul disco.
 *
 * Le figure sono state scaricate per mesi in un formato solo, quindi una
 * tessera larga 324 px riceveva l'originale da 960: da 7 a 16 volte i pixel che
 * puo' mostrare, e su un telefono molti di piu'. Da oggi il seed scrive la
 * coppia (`imageDownloader`), ma i file gia' scritti restano soli — e il client
 * la miniatura la NOMINA senza chiedere se c'e', quindi senza questo giro
 * quelle tessere resterebbero vuote.
 *
 * Costa richieste HTTP a Wikimedia e nessuna chiamata al modello: minuti, non
 * le ore di un seed. Ed e' ripetibile: chi la miniatura ce l'ha si salta.
 */
async function migrateThumbs() {
  const opere = await ArtworkModel.find({
    imagePath: { $regex: "^/images/artworks/" },
  });
  const conti: Record<EsitoMiniatura, number> = {
    scaricata: 0,
    copiata: 0,
    "gia c'era": 0,
    "senza originale": 0,
  };
  for (const opera of opere) {
    const nomeFile = (opera.imagePath || "").split("/").pop() || "";
    const esito = await scriviMiniatura(opera.imageUri || "", nomeFile);
    conti[esito]++;
    if (esito === "scaricata") await pausa(PAUSA_WIKIMEDIA_MS);
  }
  console.log(
    `Miniature su ${opere.length} opere: ${conti.scaricata} scaricate, ` +
      `${conti.copiata} copiate dall'originale, ${conti["gia c'era"]} gia' presenti, ` +
      `${conti["senza originale"]} senza il file originale.`,
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
  musei: migrateMuseumPaths,
  griglia: checkItemGrid,
  private: migrateVisitVisibility,
  autore: migrateSeedAuthor,
  prezzi: migrateSeedPrices,
  percorso: migrateVisitOrder,
  miniature: migrateThumbs,
  async tutto() {
    await migrateTones();
    await renameVisits();
    await migrateLogistics();
    await migrateKinds();
    await migrateUnknowns();
    await migrateMuseumPaths();
    await migrateVisitVisibility();
    await migrateSeedAuthor();
    await migrateSeedPrices();
    await migrateVisitOrder();
    await migrateThumbs();
    await requiredAccounts();
    await checkMaps();
    await stato();
  },
};

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
