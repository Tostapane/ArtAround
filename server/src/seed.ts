/**
 * Riempimento del database a partire dai file di configurazione dei musei.
 *
 * Si esegue un museo alla volta:
 *
 *     npx ts-node src/seed.ts                 elenca i musei configurati
 *     npx ts-node src/seed.ts Q51252          semina quel museo
 *     npx ts-node src/seed.ts Q51252 --force  rigenera anche gli item gia' scritti
 *     npx ts-node src/seed.ts tutti           semina tutti i musei configurati
 *     npx ts-node src/seed.ts speciali        le due visite dimostrative
 *
 * Due proprieta' che decidono la forma di tutto il file:
 *
 * RIPRENDIBILE. Ogni item e' una chiamata all'LLM con una pausa in mezzo per
 * non superare i limiti di frequenza: un museo da cento opere sono ottocento
 * chiamate e qualche ora, e in qualche ora qualcosa si interrompe sempre. Il
 * seed salta quel che trova gia' scritto, quindi rilanciarlo riparte da dove si
 * era fermato invece di rifare tutto.
 *
 * ADDITIVO. Semina il museo chiesto e non tocca gli altri. Cancellare tutto per
 * aggiungere un museo vorrebbe dire rigenerare anche i contenuti degli altri
 * tre — e, con essi, buttare via gli acquisti e le visite composte a mano che vi
 * puntano.
 *
 * Le immagini si scaricano subito dopo l'opera, non in una passata finale: cosi'
 * un'interruzione lascia opere complete, non opere senza volto.
 */
import { MONGO_URI } from "./env";
import mongoose from "mongoose";
import { ArtworkModel } from "./models/artwork";
import { ItemModel } from "./models/item";
import { VisitModel } from "./models/visit";
import { UserModel } from "./models/user";
import {
  populateArtwork,
  populateItem,
  populateVisit,
  populateMuseum,
  locationsFromMap,
} from "./manager";
import { educationalLevels, secPerArt } from "../../shared/constants";
import { LogisticNote } from "../../shared/types";
import { loadMuseumConfigs, findMuseumConfig, MuseumConfig } from "./data/museumConfigs";
import { costruisciQuiz } from "./data/quiz";

const PAUSA_LLM_MS = 6000;
const PAUSA_IMMAGINE_MS = 1000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function museumUri(qid: string): string {
  return `http://www.wikidata.org/entity/${qid}`;
}

function fmt(seconds: number): string {
  return `${Math.floor(seconds / 60)}m ${String(Math.round(seconds % 60)).padStart(2, "0")}s`;
}

// ============================================================================
//                              Seed di un museo
// ============================================================================

/**
 * Le indicazioni valide per tutto il museo diventano note d'APERTURA della
 * visita (`after: null`): riguardano l'ingresso, il biglietto, il guardaroba,
 * cioe' cose da sapere prima della prima tappa e non fra una tappa e l'altra.
 */
function openingNotes(config: MuseumConfig): LogisticNote[] {
  if (!config.logistics) return [];
  return config.logistics.map((text) => ({ after: null, text }));
}

async function seedMuseum(config: MuseumConfig, force: boolean) {
  const uri = museumUri(config.qid);
  const positions = locationsFromMap(config.mapPath);
  const itemsPerArtwork = educationalLevels.length * secPerArt.length;
  const totalItems = config.activeArtworks.length * itemsPerArtwork;

  console.log(
    `\n=== ${config.name} (${config.qid}) — ${config.activeArtworks.length} opere, ` +
      `fino a ${totalItems} item ===`,
  );
  const senzaNodo = config.activeArtworks.filter((q) => !positions.has(q));
  if (senzaNodo.length > 0) {
    console.warn(
      `[seed] ${senzaNodo.length} opere non hanno un nodo su ${config.mapPath} ` +
        `e non compariranno sulla pianta: ${senzaNodo.join(", ")}`,
    );
  }

  await populateMuseum(config);

  const startTime = Date.now();
  let generati = 0;
  let saltati = 0;
  let artworkIdx = 0;

  for (const qid of config.activeArtworks) {
    artworkIdx++;
    const etichetta = `[${config.qid} ${artworkIdx}/${config.activeArtworks.length} ${qid}]`;

    let artwork = await ArtworkModel.findOne({ qid });
    if (!artwork) {
      let position = positions.get(qid);
      if (!position) position = "";
      const inserita = await populateArtwork(qid, uri, position);
      if (!inserita) {
        console.log(`${etichetta} saltata: nessuna immagine su Wikidata.`);
        continue;
      }
      artwork = await ArtworkModel.findOne({ qid });
      console.log(`${etichetta} opera inserita.`);
      await delay(PAUSA_IMMAGINE_MS);
    } else {
      // La posizione puo' essere cambiata sulla pianta dopo il primo seed.
      const position = positions.get(qid);
      if (position && artwork.locationId !== position) {
        await ArtworkModel.updateOne({ qid }, { locationId: position });
        console.log(`${etichetta} posizione aggiornata: ${position}.`);
      }
    }
    if (!artwork) continue;

    let nuoviQui = 0;
    for (const level of educationalLevels) {
      for (const duration of secPerArt) {
        const gia = await ItemModel.findOne({
          about: artwork["@id"],
          educationalLevel: level,
          timeRequired: `${duration}`,
          author: "sistema",
        });
        if (gia && !force) {
          saltati++;
          continue;
        }
        await populateItem(qid, level, duration);
        generati++;
        nuoviQui++;
        const elapsed = (Date.now() - startTime) / 1000;
        const rimasti = totalItems - generati - saltati;
        const eta = rimasti * (elapsed / generati);
        console.log(
          `${etichetta} item ${level}/${duration}s  ·  ${generati} generati, ` +
            `${saltati} gia' presenti  ·  ETA ~${fmt(eta)}`,
        );
        await delay(PAUSA_LLM_MS);
      }
    }
    // Un'opera gia' completa non stampa niente per conto suo: in una ripresa
    // sarebbero cento righe di silenzio apparente prima della prima novita'.
    if (nuoviQui === 0) console.log(`${etichetta} gia' completa.`);
  }

  await seedMuseumVisits(config);
  console.log(
    `=== ${config.name}: ${generati} item generati, ${saltati} gia' presenti, ` +
      `in ${fmt((Date.now() - startTime) / 1000)} ===`,
  );
}

/**
 * Una visita per ogni combinazione di tono e durata, con dentro tutte le opere
 * del museo per cui quell'item esiste davvero.
 */
async function seedMuseumVisits(config: MuseumConfig) {
  const uri = museumUri(config.qid);
  const aboutIds = config.activeArtworks.map(museumUri);
  const notes = openingNotes(config);

  for (const level of educationalLevels) {
    for (const duration of secPerArt) {
      const items = await ItemModel.find({
        timeRequired: `${duration}`,
        educationalLevel: level,
        about: { $in: aboutIds },
      });
      if (items.length === 0) continue;
      await populateVisit(
        level,
        duration,
        config.qid,
        uri,
        items.map((item) => item["@id"]),
        notes,
      );
    }
  }
  console.log(`[${config.qid}] visite di catalogo aggiornate.`);
}

// ============================================================================
//                            Visite dimostrative
// ============================================================================

/*
 * Le due visite che il seed omogeneo non sa produrre, sul primo museo
 * configurato:
 *  1) una visita con CONTENUTI OPZIONALI: la seconda meta' delle tappe e'
 *     marcata come "da mostrare solo se resta tempo";
 *  2) una VISITA GUIDATA del docente (modulo 18-27), protetta da parola chiave,
 *     con il quiz costruito sulle opere della visita stessa, un account docente
 *     che la avvia e tre account studente che si agganciano con la parola.
 *
 * Idempotente: rimuove le due visite (per @id) e ricrea/aggiorna gli account.
 */
const PAROLA_CHIAVE_GUIDATA = "Fenice rossa";
const DOCENTE = "docente1";
const STUDENTI = ["studente1", "studente2", "studente3"];

async function seedSpecialVisits(config: MuseumConfig) {
  const uri = museumUri(config.qid);
  const aboutIds = config.activeArtworks.map(museumUri);

  const level = educationalLevels[0];
  const duration = secPerArt[0];
  const items = await ItemModel.find({
    timeRequired: `${duration}`,
    educationalLevel: `${level}`,
    about: { $in: aboutIds },
  });
  if (items.length === 0) {
    console.log(
      `Nessun item per ${config.qid} (${level}/${duration}s): semina prima il museo.`,
    );
    return;
  }
  const itemIds = items.map((it) => it["@id"]);
  const durataTotale = duration * itemIds.length;
  const notes = openingNotes(config);

  const primoOpzionale = Math.ceil(itemIds.length / 2);
  const opzionali: string[] = [];
  for (let i = primoOpzionale; i < itemIds.length; i++) {
    opzionali.push(itemIds[i]);
  }

  const visitaOpzionali = {
    "@id": `visit-opzionali-${config.qid}`,
    name: "Percorso con contenuti opzionali",
    level: `${level}`,
    duration: durataTotale,
    ofMuseum: uri,
    itemListElement: itemIds,
    optionalItems: opzionali,
    logistics: notes,
  };

  // Il test di competenza di fine visita (slide 33), sulle opere del percorso.
  const opereDellaVisita = await ArtworkModel.find({
    "@id": { $in: items.map((it: any) => it.about) },
  });
  const quiz = costruisciQuiz(opereDellaVisita);

  const visitaGuidata = {
    "@id": `visit-guidata-${config.qid}`,
    name: "Visita guidata del docente",
    level: `${level}`,
    duration: durataTotale,
    author: DOCENTE,
    accessKey: PAROLA_CHIAVE_GUIDATA,
    ofMuseum: uri,
    itemListElement: itemIds,
    logistics: notes,
    quiz,
  };

  await VisitModel.deleteMany({
    "@id": { $in: [visitaOpzionali["@id"], visitaGuidata["@id"]] },
  });
  await VisitModel.create(visitaOpzionali);
  await VisitModel.create(visitaGuidata);
  console.log(
    `Visite create su ${config.name}: "${visitaOpzionali.name}" ` +
      `(${opzionali.length}/${itemIds.length} opzionali) e "${visitaGuidata.name}" ` +
      `(parola chiave: «${PAROLA_CHIAVE_GUIDATA}», quiz di ${quiz.length} domande).`,
  );

  const account: { username: string; role: "autore" | "visitatore" }[] = [
    { username: DOCENTE, role: "autore" },
    ...STUDENTI.map((username) => ({
      username,
      role: "visitatore" as const,
    })),
  ];
  for (const a of account) {
    const onInsert: any =
      a.role === "visitatore" ? { wallet: 100, collezione: [] } : { collezione: [] };
    await UserModel.updateOne(
      { username: a.username, role: a.role },
      {
        $set: { password: "12345678" },
        $setOnInsert: onInsert,
      },
      { upsert: true },
    );
    console.log(`  account pronto: ${a.username} (${a.role})`);
  }
  console.log(
    `Docente: ${DOCENTE} · studenti: ${STUDENTI.join(", ")} (password "12345678").`,
  );
}

// ============================================================================
//                                   Comandi
// ============================================================================

function elenca(configs: MuseumConfig[]) {
  console.log("Musei configurati in src/data/museums/:\n");
  for (const c of configs) {
    console.log(
      `  ${c.qid.padEnd(10)} ${c.name.padEnd(32)} ${String(c.activeArtworks.length).padStart(4)} opere  ${c.mapPath}`,
    );
  }
  console.log(
    "\nUso: npx ts-node src/seed.ts <qid|tutti|speciali> [--force]",
  );
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const comando = args.filter((a) => !a.startsWith("--"))[0];

  const configs = loadMuseumConfigs();
  if (configs.length === 0) {
    console.error("Nessun museo configurato: niente da seminare.");
    return;
  }
  if (!comando) {
    elenca(configs);
    return;
  }

  await mongoose.connect(MONGO_URI);
  console.log(`Connesso a MongoDB.`);
  try {
    if (comando === "tutti") {
      for (const config of configs) await seedMuseum(config, force);
    } else if (comando === "speciali") {
      await seedSpecialVisits(configs[0]);
    } else {
      const config = findMuseumConfig(comando);
      if (!config) {
        console.error(`Nessun museo configurato con qid ${comando}.`);
        elenca(configs);
        return;
      }
      await seedMuseum(config, force);
    }
  } catch (err) {
    console.error("Errore durante il seed", err);
  } finally {
    await mongoose.disconnect();
    console.log("Connessione chiusa.");
  }
}

main();
