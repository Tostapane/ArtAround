/**
 * Riempimento del database a partire dai file di configurazione dei musei.
 *
 * Si esegue un museo alla volta:
 *
 *     npx ts-node src/scripts/seed.ts                 elenca i musei configurati
 *     npx ts-node src/scripts/seed.ts Q51252          semina quel museo
 *     npx ts-node src/scripts/seed.ts Q51252 --force  rigenera anche gli item gia' scritti
 *     npx ts-node src/scripts/seed.ts tutti           semina tutti i musei configurati
 *     npx ts-node src/scripts/seed.ts speciali        le visite dimostrative, su OGNI museo
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
 * tre, e con essi gli acquisti e le visite composte a mano che vi puntano.
 *
 * Le immagini si scaricano subito dopo l'opera, non in una passata finale: cosi'
 * un'interruzione lascia opere complete, non opere senza volto.
 *
 * Oltre alle opere semina due soggetti che opere non sono, lo stile e l'autore
 * piu' ricorrenti in quel museo, perche' la slide 21 chiede contenuti anche su
 * stili e artisti, e senza nemmeno uno non si possono mostrare. Restano nel
 * catalogo: in quale visita e in quale punto vadano non lo decide il seed.
 */
import { MONGO_URI } from "../env";
import mongoose from "mongoose";
import { ArtworkModel } from "../models/artwork";
import { ItemModel } from "../models/item";
import { VisitModel } from "../models/visit";
import { UserModel } from "../models/user";
import {
  populateArtwork,
  populateItem,
  populateVisit,
  populateMuseum,
  locationsFromMap,
} from "../manager";
import {
  educationalLevels,
  secPerArt,
  kindById,
} from "../../../shared/constants";
import { createSubjectDescription } from "../services/llm";
import { LogisticNote } from "../../../shared/types";
import {
  loadMuseumConfigs,
  findMuseumConfig,
  MuseumConfig,
} from "../data/museumConfigs";
import { costruisciQuiz } from "../data/quiz";

const PAUSA_LLM_MS = 0;
const PAUSA_IMMAGINE_MS = 1000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function museumUri(qid: string): string {
  return `http://www.wikidata.org/entity/${qid}`;
}

function fmt(seconds: number): string {
  return `${Math.floor(seconds / 60)}m ${String(Math.round(seconds % 60)).padStart(2, "0")}s`;
}

/**
 * Il prezzo di una descrizione seminata: uno dei sette scalini fino a 30
 * centesimi, estratto a sorte. Serve a far esistere il commercio nel catalogo,
 * che con tutto gratis non si puo' mostrare: ci vogliono contenuti a pagamento,
 * visite che ne contengono qualcuno, e un portafoglio che cala.
 *
 * I centesimi sono interi e la divisione arriva alla fine, cosi' il valore
 * scritto e' sempre uno dei sette e non un decimale che ci somiglia. Lo zero
 * resta fra le possibilita': un catalogo in cui tutto costa non fa vedere il
 * caso gratuito, che e' quello di partenza.
 */
const PREZZI_CENTESIMI = [0, 5, 10, 15, 20, 25, 30];

function prezzoCasuale(): number {
  const i = Math.floor(Math.random() * PREZZI_CENTESIMI.length);
  return (PREZZI_CENTESIMI[i] as number) / 100;
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

  // Il costo si dice PRIMA di cominciare: e' opere x toni x durate, ognuno una
  // chiamata al modello con la sua pausa, e chi lancia il comando deve poter
  // decidere sapendo quante ore e quante chiamate sta impegnando.
  const oreAlPeggio = (totalItems * PAUSA_LLM_MS) / 3_600_000;
  console.log(
    `\n=== ${config.name} (${config.qid}): ${config.activeArtworks.length} opere ` +
      `x ${educationalLevels.length} toni x ${secPerArt.length} durate = ` +
      `fino a ${totalItems} item (${oreAlPeggio.toFixed(1)}h se mancassero tutti) ===`,
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
        await populateItem(qid, level, duration, undefined, prezzoCasuale());
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

  await seedMuseumTopics(config, force);
  await seedMuseumVisits(config);
  console.log(
    `=== ${config.name}: ${generati} item generati, ${saltati} gia' presenti, ` +
      `in ${fmt((Date.now() - startTime) / 1000)} ===`,
  );
}

// ============================================================================
//                        Soggetti che non sono opere
// ============================================================================

/** Il valore piu' ricorrente e un'opera che lo porta: serve il nome e una faccia. */
function piuRicorrente(
  artworks: any[],
  leggi: (a: any) => { name?: string; qid?: string } | undefined,
): { name: string; qid: string; artwork: any } | null {
  const conteggi = new Map<string, number>();
  const esempi = new Map<string, any>();

  for (const a of artworks) {
    const valore = leggi(a);
    // "Unknown" e gli indirizzi di nodo anonimo sono buchi di Wikidata, non nomi.
    if (!valore || !valore.name) continue;
    if (valore.name === "Unknown" || valore.name.startsWith("http")) continue;
    const gia = conteggi.get(valore.name);
    if (gia) {
      conteggi.set(valore.name, gia + 1);
    } else {
      conteggi.set(valore.name, 1);
      esempi.set(valore.name, { artwork: a, qid: valore.qid || "" });
    }
  }

  let vincitore = "";
  let massimo = 0;
  conteggi.forEach((quante, nome) => {
    if (quante > massimo) {
      massimo = quante;
      vincitore = nome;
    }
  });
  if (vincitore === "") return null;

  const esempio = esempi.get(vincitore);
  return { name: vincitore, qid: esempio.qid, artwork: esempio.artwork };
}

/**
 * I contenuti che non parlano di un'opera. Quali soggetti siano lo decide il
 * catalogo, cioe' lo stile e l'autore che vi ricorrono di piu', e non un elenco
 * scritto qui:
 * cosi' un museo di arte contemporanea non semina il Rinascimento. L'immagine e'
 * quella di un'opera che porta quel valore: e' la piu' vicina che il museo abbia.
 */
async function seedMuseumTopics(config: MuseumConfig, force: boolean) {
  const uri = museumUri(config.qid);
  const artworks = await ArtworkModel.find({ ofMuseum: uri });
  if (artworks.length === 0) return;

  const soggetti = [
    { kind: "stile", scelto: piuRicorrente(artworks, (a) => a.style) },
    { kind: "artista", scelto: piuRicorrente(artworks, (a) => a.author) },
  ];

  for (const s of soggetti) {
    if (!s.scelto) {
      console.log(
        `[${config.qid}] nessun ${s.kind} nel catalogo: soggetto saltato.`,
      );
      continue;
    }
    const nome = s.scelto.name;
    const immagine =
      s.scelto.artwork.imagePath || s.scelto.artwork.imageUri || "";
    const genere = kindById(s.kind);
    if (!genere) continue;

    for (const level of educationalLevels) {
      for (const duration of secPerArt) {
        // Uno per genere, quindi il genere basta a identificarlo: cambiando lo
        // stile piu' ricorrente il documento si aggiorna invece di sdoppiarsi.
        const id = `${config.qid}-${s.kind}-sistema-${level}-${duration}`;
        const gia = await ItemModel.findOne({ "@id": id });
        if (gia && !force) continue;

        const text = await createSubjectDescription(
          nome,
          genere.name,
          level,
          duration,
        );
        if (!text || text.trim() === "") {
          console.warn(
            `[${config.qid}] soggetto "${nome}" (${level}/${duration}s) NON creato.`,
          );
          continue;
        }
        await ItemModel.findOneAndUpdate(
          { "@id": id },
          {
            "@id": id,
            kind: s.kind,
            subject: nome,
            imagePath: immagine,
            ofMuseum: uri,
            text,
            timeRequired: `${duration}`,
            educationalLevel: level,
            author: "sistema",
            price: prezzoCasuale(),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        console.log(
          `[${config.qid}] soggetto ${s.kind} "${nome}" ${level}/${duration}s.`,
        );
        await delay(PAUSA_LLM_MS);
      }
    }
  }
}

/**
 * Una visita per ogni combinazione di tono e durata, con dentro tutte le opere
 * del museo per cui quell'item esiste davvero.
 *
 * Ci stanno solo opere. Dove mettere un contenuto su uno stile e' una scelta di
 * curatela, mentre questa e' un'enumerazione meccanica del catalogo: i soggetti
 * seminati restano disponibili, e a collocarli in un percorso, nel punto in cui
 * hanno senso, e' chi compone la visita.
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
 * Le due visite che il seed omogeneo non sa produrre, su OGNI museo configurato:
 *  1) una visita con CONTENUTI OPZIONALI: la seconda meta' delle tappe e'
 *     marcata come "da mostrare solo se resta tempo";
 *  2) una VISITA GUIDATA del docente (modulo 18-27), protetta da parola chiave,
 *     con il quiz costruito sulle opere della visita stessa.
 *
 * Il docente e gli studenti sono gli stessi per tutti i musei e si creano una
 * volta sola, fuori dal giro: sono persone, non arredo di un museo.
 *
 * Idempotente: gli `@id` portano il qid, quindi rilanciarlo riscrive le visite
 * di quel museo e lascia stare le altre. Un museo non ancora seminato non ha
 * item da cui pescare: lo dice e passa oltre, invece di scrivere una visita
 * vuota.
 *
 * LA PAROLA CHIAVE PORTA IL QID, e non e' un vezzo. `POST /visits` rifiuta con
 * 409 due visite guidate che condividano la parola, e le sale aperte stanno in
 * una mappa indicizzata proprio su quella: una parola sola per quattro musei
 * vorrebbe dire che l'ultima sala aperta si prende gli studenti delle altre, e
 * che a chi arriva dal museo sbagliato risponde un 409 senza spiegazione. Il
 * qid e' l'unico campo unico per costruzione fra quelli che il curatore scrive.
 */
const PAROLA_CHIAVE_GUIDATA = "Fenice rossa";
const DOCENTE = "docente1";
const STUDENTI = ["studente1", "studente2", "studente3"];

function parolaChiave(config: MuseumConfig): string {
  return `${PAROLA_CHIAVE_GUIDATA} ${config.qid}`;
}

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
    accessKey: parolaChiave(config),
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
    `${config.name}: "${visitaOpzionali.name}" ` +
      `(${opzionali.length}/${itemIds.length} opzionali) e "${visitaGuidata.name}" ` +
      `(parola chiave: «${visitaGuidata.accessKey}», quiz di ${quiz.length} domande).`,
  );
}

/** Il docente e i suoi studenti: gli stessi per ogni museo, quindi una volta sola. */
async function seedDemoAccounts() {
  const account: { username: string; role: "autore" | "visitatore" }[] = [
    { username: DOCENTE, role: "autore" },
    ...STUDENTI.map((username) => ({
      username,
      role: "visitatore" as const,
    })),
  ];
  for (const a of account) {
    const onInsert: any =
      a.role === "visitatore"
        ? { wallet: 100, collezione: [] }
        : { collezione: [] };
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
    "\nUso: npx ts-node src/scripts/seed.ts <qid|tutti|speciali> [--force]",
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
      await seedDemoAccounts();
      for (const config of configs) await seedSpecialVisits(config);
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
