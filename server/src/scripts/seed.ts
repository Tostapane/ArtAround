/**
 * Riempimento del database a partire dai file di configurazione dei musei.
 *
 * Si esegue un museo alla volta:
 *
 *     npx ts-node src/scripts/seed.ts                 elenca i musei configurati
 *     npx ts-node src/scripts/seed.ts Q51252          semina quel museo
 *     npx ts-node src/scripts/seed.ts Q51252 --force  rigenera anche gli item gia' scritti
 *     npx ts-node src/scripts/seed.ts tutti           semina tutti i musei configurati
 *     npx ts-node src/scripts/seed.ts speciali        la visita guidata del docente, su OGNI museo
 *
 * Due proprieta' che decidono la forma di tutto il file:
 *
 * RIPRENDIBILE. Ogni item e' una chiamata all'LLM: un museo da cento opere sono
 * duemila chiamate, e in una corsa cosi' lunga qualcosa si interrompe sempre. Il
 * seed salta quel che trova gia' scritto, quindi rilanciarlo riparte da dove si
 * era fermato invece di rifare tutto.
 *
 * Fra due chiamate al modello non c'e' nessuna pausa, e la sola che resta e'
 * quella verso Wikimedia, che i suoi limiti li fa ancora rispettare. Le
 * chiamate al modello sono su un piano a pagamento, e rallentare apposta un
 * seed che dura ore per un limite che non scatta piu' era tempo regalato.
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
 * stili e artisti, e senza nemmeno uno non si possono mostrare. Quali siano lo
 * decide il CATALOGO e non un elenco scritto qui, cosi' un museo di arte
 * contemporanea non semina il Rinascimento; l'immagine e' quella di un'opera che
 * porta quel valore, cioe' la piu' vicina che il museo abbia.
 *
 * I soggetti stanno in TESTA alle visite di catalogo. Un contenuto su uno stile o
 * su un artista non e' appeso a una parete, quindi non ha un posto nell'ordine di
 * cammino e `inOrdineDiPercorso` non saprebbe dove metterlo; infilato fra due
 * sale spezzerebbe il giro. In apertura invece e' l'inquadramento che si ascolta
 * prima di muoversi, cioe' la stessa posizione in cui il museo mette un pannello
 * introduttivo. Le indicazioni logistiche del museo diventano per lo stesso
 * motivo note d'APERTURA (`after: null`): ingresso, biglietto e guardaroba si
 * sanno prima della prima tappa, non fra una tappa e l'altra.
 *
 * Le venti visite di un museo hanno percio' le stesse tappe: a cambiare sono tono
 * e durata — come si racconta e quanto dura — non che cosa si guarda. E' anche il
 * motivo per cui la copertina si sceglie per tono e non per visita
 * (`visitImages`): cinque visite che differiscono per la sola durata non hanno
 * cinque facce diverse.
 *
 * `inOrdineDiPercorso` esiste perche' il database rende gli item nell'ordine in
 * cui sono stati scritti, che non e' un ordine: una visita seminata cosi' rimbalza
 * da una sala all'altra e, da quando le piante hanno i piani, sale e scende le
 * scale a ogni tappa. L'ordine di percorrenza sta sulla mappa (`data-flow`) ed e'
 * lo stesso che mette in fila il catalogo; qui si applica alle tappe, che sono
 * item e non opere, passando per il qid dell'opera di cui l'item parla.
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
  SEED_AUTHOR,
  SEED_ID_TOKEN,
  priceForTone,
} from "../../../shared/constants";
import { createSubjectDescription } from "../services/llm";
import { sortByFlow } from "../services/svgGraph";
import { LogisticNote } from "../../../shared/types";
import {
  loadMuseumConfigs,
  findMuseumConfig,
  MuseumConfig,
} from "../data/museumConfigs";
import { costruisciQuiz } from "../data/quiz";

const PAUSA_IMMAGINE_MS = 1000; // la pausa fra due scaricamenti, per non far scattare il 429 di Wikimedia

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
    `\n=== ${config.name} (${config.qid}): ${config.activeArtworks.length} opere ` +
      `x ${educationalLevels.length} toni x ${secPerArt.length} durate = ` +
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
          author: SEED_AUTHOR,
        });
        if (gia && !force) {
          saltati++;
          continue;
        }
        await populateItem(qid, level, duration, undefined, priceForTone(level));
        generati++;
        nuoviQui++;
        const elapsed = (Date.now() - startTime) / 1000;
        const rimasti = totalItems - generati - saltati;
        const eta = rimasti * (elapsed / generati);
        console.log(
          `${etichetta} item ${level}/${duration}s  ·  ${generati} generati, ` +
            `${saltati} gia' presenti  ·  ETA ~${fmt(eta)}`,
        );
      }
    }
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

function piuRicorrente(
  artworks: any[],
  leggi: (a: any) => { name?: string; qid?: string } | undefined,
): { name: string; qid: string; artwork: any } | null {
  const conteggi = new Map<string, number>();
  const esempi = new Map<string, any>();

  for (const a of artworks) {
    const valore = leggi(a);
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
        const id = `${config.qid}-${s.kind}-${SEED_ID_TOKEN}-${level}-${duration}`;
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
            author: SEED_AUTHOR,
            price: priceForTone(level),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        console.log(
          `[${config.qid}] soggetto ${s.kind} "${nome}" ${level}/${duration}s.`,
        );
      }
    }
  }
}

function inOrdineDiPercorso<T extends { about?: string }>(
  items: T[],
  mapPath: string,
): T[] {
  const conQid = items.map((it) => {
    const uri = it.about || "";
    const pezzi = uri.split("/");
    return { item: it, qid: pezzi[pezzi.length - 1] };
  });
  return sortByFlow(conQid, mapPath).map((riga) => riga.item);
}

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
      const percorso = inOrdineDiPercorso(items, config.mapPath);

      const soggetti = await ItemModel.find({
        timeRequired: `${duration}`,
        educationalLevel: level,
        ofMuseum: uri,
        kind: { $ne: "opera" },
        author: SEED_AUTHOR,
      });

      const tappe = [
        ...soggetti.map((item: any) => item["@id"]),
        ...percorso.map((item) => item["@id"]),
      ];
      await populateVisit(
        level,
        duration,
        config.qid,
        uri,
        tappe,
        notes,
        undefined,
        undefined,
        config.visitImages ? config.visitImages[level] : undefined,
      );
    }
  }
  console.log(`[${config.qid}] visite di catalogo aggiornate.`);
}

// ============================================================================
//                            Visite dimostrative
// ============================================================================

/*
 * La visita che il seed omogeneo non sa produrre, su OGNI museo configurato: la
 * VISITA GUIDATA del docente (modulo 18-27), protetta da parola chiave, col quiz
 * costruito sulle opere della visita stessa. Cancella per strada anche la vecchia
 * "Percorso con contenuti opzionali": era una visita dimostrativa in vetrina con
 * le stesse tappe delle altre venti, e le tappe opzionali si mostrano meglio da
 * dove si creano, cioe' il compositore.
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
  const itemIds = inOrdineDiPercorso(items, config.mapPath).map((it) => it["@id"]);
  const durataTotale = duration * itemIds.length;
  const notes = openingNotes(config);

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
    "@id": { $in: [`visit-opzionali-${config.qid}`, visitaGuidata["@id"]] },
  });
  await VisitModel.create(visitaGuidata);
  console.log(
    `${config.name}: "${visitaGuidata.name}" ` +
      `(parola chiave: «${visitaGuidata.accessKey}», quiz di ${quiz.length} domande).`,
  );
}

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
  console.log("Musei configurati in public/allestimento/:\n");
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
