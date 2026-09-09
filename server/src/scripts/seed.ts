/**
 * Orchestra il seed ripetibile di musei, opere, griglia tono-durata, visite di
 * catalogo e visite guidate con quiz. Le modalita' completano una parte senza
 * rigenerare le chiamate gia' riuscite.
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

const PAUSA_IMMAGINE_MS = 1000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function museumUri(qid: string): string {
  return `http://www.wikidata.org/entity/${qid}`;
}

function fmt(seconds: number): string {
  return `${Math.floor(seconds / 60)}m ${String(Math.round(seconds % 60)).padStart(2, "0")}s`;
}

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
