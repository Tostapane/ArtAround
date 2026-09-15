/**
 * Orchestra il seed ripetibile di musei, opere, griglia tono-durata e visite di
 * catalogo. Ogni combinazione viene completata prima di passare alla successiva.
 */
import { MONGO_URI } from "../env";
import mongoose from "mongoose";
import { IArtwork, ArtworkModel } from "../models/artwork";
import { IItem, ItemModel } from "../models/item";
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

  console.log(
    `\n=== ${config.name} (${config.qid}): ${config.activeArtworks.length} opere ` +
      `x ${educationalLevels.length} toni x ${secPerArt.length} durate = ` +
      `fino a ${config.activeArtworks.length * itemsPerArtwork} item ===`,
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
  const artworks: IArtwork[] = [];
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
    artworks.push(artwork);
  }

  const soggetti = museumTopics(config, artworks);
  const notes = openingNotes(config);
  const artworkIds = artworks.map((artwork) => artwork["@id"]);
  const totalItems = artworks.length * itemsPerArtwork;
  const generationStartTime = Date.now();
  let elaborati = 0;
  let generati = 0;
  let saltati = 0;
  let falliti = 0;

  for (const level of educationalLevels) {
    for (const duration of secPerArt) {
      const items: IItem[] = [];
      const esistenti = await ItemModel.find({
        about: { $in: artworkIds },
        educationalLevel: level,
        timeRequired: `${duration}`,
        author: SEED_AUTHOR,
      });
      const esistentiPerOpera = new Map(
        esistenti.map((item) => [item.about || "", item]),
      );

      for (const artwork of artworks) {
        const gia = esistentiPerOpera.get(artwork["@id"]);

        let item = gia;
        let esito = "gia' presente";
        if (!gia || force) {
          const creato = await populateItem(
            artwork,
            level,
            duration,
            undefined,
            priceForTone(level),
          );
          if (creato) {
            item = creato;
            generati++;
            esito = "generato";
          } else {
            falliti++;
            esito = gia
              ? "rigenerazione fallita, uso il precedente"
              : "non creato";
          }
        } else {
          saltati++;
        }
        if (item) items.push(item);

        elaborati++;
        const elapsed = (Date.now() - generationStartTime) / 1000;
        const rimasti = totalItems - elaborati;
        const eta = elaborati > 0 ? rimasti * (elapsed / elaborati) : 0;
        console.log(
          `[${config.qid} ${level}/${duration}s ${artwork.qid}] ${esito}  ·  ` +
            `${elaborati}/${totalItems} elaborati  ·  ETA ~${fmt(eta)}`,
        );
      }

      const topicItems = await seedMuseumTopics(
        config,
        soggetti,
        level,
        duration,
        force,
      );
      const percorso = inOrdineDiPercorso(items, config.mapPath);
      const tappe = tappeConSoggetti(topicItems, percorso, artworks);
      if (tappe.length === 0) {
        console.warn(
          `[${config.qid}] visita ${level}/${duration}s non creata: nessun item.`,
        );
        continue;
      }

      await populateVisit(
        level,
        duration,
        config.qid,
        uri,
        tappe,
        notes,
        undefined,
        SEED_AUTHOR,
        config.visitImages ? config.visitImages[level] : undefined,
      );
      console.log(
        `[${config.qid}] visita ${level}/${duration}s aggiornata con ${tappe.length} tappe.`,
      );
    }
  }

  console.log(
    `=== ${config.name}: ${generati} item generati, ${saltati} gia' presenti, ` +
      `${falliti} generazioni fallite, ` +
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

interface MuseumTopic {
  kind: string;
  name: string;
  imagePath: string;
  kindName: string;
}

function museumTopics(
  config: MuseumConfig,
  artworks: IArtwork[],
): MuseumTopic[] {
  const candidati = [
    { kind: "stile", scelto: piuRicorrente(artworks, (a) => a.style) },
    { kind: "artista", scelto: piuRicorrente(artworks, (a) => a.author) },
  ];
  const soggetti: MuseumTopic[] = [];

  for (const s of candidati) {
    if (!s.scelto) {
      console.log(
        `[${config.qid}] nessun ${s.kind} nel catalogo: soggetto saltato.`,
      );
      continue;
    }
    const immagine =
      s.scelto.artwork.imagePath || s.scelto.artwork.imageUri || "";
    const genere = kindById(s.kind);
    if (!genere) continue;
    soggetti.push({
      kind: s.kind,
      name: s.scelto.name,
      imagePath: immagine,
      kindName: genere.name,
    });
  }
  return soggetti;
}

async function seedMuseumTopics(
  config: MuseumConfig,
  soggetti: MuseumTopic[],
  level: string,
  duration: number,
  force: boolean,
): Promise<IItem[]> {
  const items: IItem[] = [];
  const righe = soggetti.map((soggetto) => ({
    soggetto,
    id: `${config.qid}-${soggetto.kind}-${SEED_ID_TOKEN}-${level}-${duration}`,
  }));
  const esistenti = await ItemModel.find({
    "@id": { $in: righe.map((riga) => riga.id) },
  });
  const esistentiPerId = new Map(
    esistenti.map((item) => [item["@id"], item]),
  );

  for (const { soggetto, id } of righe) {
    const gia = esistentiPerId.get(id);
    if (gia && !force) {
      items.push(gia);
      continue;
    }

    const text = await createSubjectDescription(
      soggetto.name,
      soggetto.kindName,
      level,
      duration,
    );
    if (!text || text.trim() === "") {
      console.warn(
        `[${config.qid}] soggetto "${soggetto.name}" (${level}/${duration}s) NON creato.`,
      );
      if (gia) items.push(gia);
      continue;
    }

    const item = await ItemModel.findOneAndUpdate(
      { "@id": id },
      {
        "@id": id,
        kind: soggetto.kind,
        subject: soggetto.name,
        imagePath: soggetto.imagePath,
        ofMuseum: museumUri(config.qid),
        text,
        timeRequired: `${duration}`,
        educationalLevel: level,
        author: SEED_AUTHOR,
        price: priceForTone(level),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    items.push(item);
    console.log(
      `[${config.qid}] soggetto ${soggetto.kind} "${soggetto.name}" ${level}/${duration}s.`,
    );
  }
  return items;
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

function tappeConSoggetti(
  soggetti: IItem[],
  percorso: IItem[],
  artworks: IArtwork[],
): string[] {
  const operePerId = new Map(artworks.map((opera) => [opera["@id"], opera]));
  const daCollocare = new Set(soggetti.map((item) => item["@id"]));
  const tappe: string[] = [];

  for (const item of percorso) {
    const opera = operePerId.get(item.about || "");
    if (opera) {
      for (const soggetto of soggetti) {
        if (!daCollocare.has(soggetto["@id"])) continue;
        const nome = soggetto.subject || "";
        const corrisponde =
          (soggetto.kind === "artista" && opera.author?.name === nome) ||
          (soggetto.kind === "stile" && opera.style?.name === nome);
        if (!corrisponde) continue;
        tappe.push(soggetto["@id"]);
        daCollocare.delete(soggetto["@id"]);
      }
    }
    tappe.push(item["@id"]);
  }

  for (const soggetto of soggetti) {
    if (!daCollocare.has(soggetto["@id"])) continue;
    console.warn(
      `[seed] soggetto "${soggetto.subject || soggetto.kind}" escluso dalla visita: ` +
        `nessuna opera corrispondente nel percorso.`,
    );
  }
  return tappe;
}

// ============================================================================

function elenca(configs: MuseumConfig[]) {
  console.log("Musei configurati in public/allestimento/:\n");
  for (const c of configs) {
    console.log(
      `  ${c.qid.padEnd(10)} ${c.name.padEnd(32)} ${String(c.activeArtworks.length).padStart(4)} opere  ${c.mapPath}`,
    );
  }
  console.log("\nUso: npx ts-node src/scripts/seed.ts <qid|tutti> [--force]");
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
