/**
 * Popola un museo unendo configurazione, Wikidata e pianta. Gli upsert rendono il
 * seed ripetibile e gli item senza testo non vengono salvati, evitando tappe mute
 * che sembrerebbero valide.
 */
import { fetchArtwork, fetchMuseum } from "./services/wikidata";
import { downloadImage } from "./services/imageDownloader";
import {
  upsertArtwork,
  upsertItem,
  upsertVisit,
  upsertMuseum,
} from "./catalogue";
import { createDescription } from "./services/llm";
import { ArtworkModel } from "./models/artwork";
import { MuseumConfig } from "./data/museumConfigs";
import { getMuseumGraph } from "./services/svgGraph";
import { LogisticNote } from "../../shared/types";
import {
  DEFAULT_LICENSE,
  SEED_AUTHOR,
  SEED_ID_TOKEN,
} from "../../shared/constants";

export function locationsFromMap(mapPath: string): Map<string, string> {
  const positions = new Map<string, string>();
  for (const node of getMuseumGraph(mapPath).nodes) {
    if (node.kind === "artwork" && node.elementId) {
      positions.set(node.qid, node.elementId);
    }
  }
  return positions;
}

export async function populateArtwork(
  qid: string,
  museum: string,
  location: string,
): Promise<boolean> {
  const data = await fetchArtwork(qid);
  if (!data) throw new Error("Artwork non trovato");

  if (!data.image) {
    console.warn(`[seed] opera ${qid} senza immagine (P18): saltata`);
    return false;
  }

  const imagePath = await downloadImage(data.image, `${qid}`);

  await upsertArtwork({
    qid: qid,
    name: data.name,
    author: {
      name: data.author,
      qid: data.author_qid,
    },
    style: {
      name: data.style,
      qid: data.style_qids,
    },
    imageUri: data.image,
    imagePath: imagePath,
    "@id": `http://www.wikidata.org/entity/${qid}`,
    ofMuseum: museum,
    locationId: location,
  });
  return true;
}

export async function populateItem(
  atworkQid: string,
  level: string,
  duration: number,
  itemAuthor?: string,
  itemPrice?: number,
  description?: string,
) {
  const artwork = await ArtworkModel.findOne({ qid: atworkQid });
  if (!artwork) throw new Error(`Artwork non trovato per QID: ${atworkQid}`);

  if (!itemAuthor && !description) {
    description = await createDescription(
      artwork.name,
      artwork.author.name,
      level,
      duration,
    );
    itemAuthor = SEED_AUTHOR;

    if (!description || description.trim() === "") {
      console.warn(
        `[seed] item ${atworkQid} (${level}/${duration}s) NON creato: ` +
          `il modello non ha prodotto una descrizione.`,
      );
      return;
    }
  }

  let firma = itemAuthor;
  if (itemAuthor === SEED_AUTHOR) firma = SEED_ID_TOKEN;
  const id = `${atworkQid}-${firma}-${level}-${duration}`;

  await upsertItem({
    "@id": id,
    kind: "opera",
    about: artwork["@id"],
    ofMuseum: artwork.ofMuseum,
    timeRequired: duration.toString(),
    educationalLevel: level,
    author: itemAuthor,
    price: itemPrice,
    text: description,
    license: DEFAULT_LICENSE,
  });
}

export async function populateVisit(
  level: string,
  durationPerArt: number,
  museum: string,
  museumUri: string,
  items: string[],
  logist: LogisticNote[],
  visitPrice?: number,
  visitAuthor?: string,
  imagePath?: string,
) {
  const id = `visit-${museum}-${level}-${durationPerArt}`;
  const name = `Visita ${level} · ${durationPerArt}s per opera`;
  await upsertVisit({
    "@id": id,
    name: name,
    level: level,
    duration: durationPerArt * items.length,
    price: visitPrice,
    author: visitAuthor,
    ofMuseum: museumUri,
    visibility: "pubblico",
    imagePath: imagePath || "",
    itemListElement: items,
    logistics: logist,
    license: DEFAULT_LICENSE,
  });
}

export async function populateMuseum(config: MuseumConfig) {
  let name = config.name;
  let created = config.created;
  let location = config.location;

  if (!created || !location) {
    const data = await fetchMuseum(config.qid);
    if (data) {
      if (!name) name = data.name;
      if (!created) created = data.created;
      if (!location) location = data.location;
    }
  }

  await upsertMuseum({
    "@id": `http://www.wikidata.org/entity/${config.qid}`,
    qid: config.qid,
    name,
    created,
    location,
    mapPath: config.mapPath,
    imagePath: config.imagePath,
  });
}
