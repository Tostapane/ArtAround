import { fetchArtwork, fetchMuseum } from "./services/wikidata";
import { downloadImage } from "./services/imageDownloader";
import {
  insertArtwork,
  insertItem,
  insertVisit,
  intertMuseum,
} from "./dbActions";
import { createDescription } from "./services/llm";
import { ArtworkModel } from "./models/artwork";
import { generateMuseumConfig } from "./services/museumConfig";

/**
 * Popola un artwork nel database ottenendo dati da Wikidata.
 */
export async function populateArtwork(
  qid: string,
  museum: string,
  location: string,
) {
  const data = await fetchArtwork(qid);
  if (!data) throw new Error("Artwork non trovato");

  const imagePath = await downloadImage(data.image, `${qid}`);

  await insertArtwork({
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
}

/**
 * Crea e inserisce un Item (descrizione) associato a un artwork.
 */
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
    itemAuthor = "sistema";
  }

  const id = `${atworkQid}-${itemAuthor}-${level}-${duration}`;

  await insertItem({
    "@id": id,
    about: artwork["@id"], // Full Wikidata URL
    timeRequired: duration.toString(),
    educationalLevel: level,
    author: itemAuthor,
    price: itemPrice,
    text: description,
  });
}

/**
 * Inserisce una visita (percorso) nel database.
 */
export async function populateVisit(
  level: string,
  duration: number,
  museum: string,
  museumUri: string,
  items: string[],
  logist: string[],
  visitPrice?: number,
  visitAuthor?: string,
) {
  const name = `${museum}-${level}-${duration}`;
  const id = `visit-${name}`;
  await insertVisit({
    "@id": id,
    name: name,
    level: level,
    duration: duration,
    price: visitPrice,
    author: visitAuthor,
    ofMuseum: museumUri,
    itemListElement: items,
    logistics: logist,
  });
}

/**
 * Fetcha il museo, ne crea il file di configurazione e inseirsce i suoi dati nel database
 */
export async function populateMuseum(qid: string, artworks: readonly string[]) {
  const data = await fetchMuseum(qid);
  if (!data) throw new Error("Museum non trovato");
  generateMuseumConfig(qid, data, `${data.name}`, artworks);
  await intertMuseum({
    "@id": `http://www.wikidata.org/entity/${qid}`,
    qid: qid,
    name: data.name,
    created: data.created,
    location: data.location,
    mapPath: `/maps/${data.name}.svg`,
  });
}
