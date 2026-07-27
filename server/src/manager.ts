/**
 * Popolamento di un museo a partire da Wikidata.
 *
 * Scarica i metadati di opere e musei, salva una copia locale delle immagini e
 * genera le descrizioni mancanti. Un'opera senza immagine (P18) viene saltata:
 * meglio non averla che averla senza volto.
 */
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
): Promise<boolean> {
  const data = await fetchArtwork(qid);
  if (!data) throw new Error("Artwork non trovato");

  if (!data.image) {
    console.warn(`[seed] opera ${qid} senza immagine (P18): saltata`);
    return false;
  }

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
    itemAuthor = "sistema";
  }

  const id = `${atworkQid}-${itemAuthor}-${level}-${duration}`;

  await insertItem({
    "@id": id,
    about: artwork["@id"], 
    timeRequired: duration.toString(),
    educationalLevel: level,
    author: itemAuthor,
    price: itemPrice,
    text: description,
  });
}

export async function populateVisit(
  level: string,
  durationPerArt: number, 
  museum: string,
  museumUri: string,
  items: string[],
  logist: string[],
  visitPrice?: number,
  visitAuthor?: string,
) {
  const id = `visit-${museum}-${level}-${durationPerArt}`;
  const name = `Visita ${level} · ${durationPerArt}s per opera`;
  await insertVisit({
    "@id": id,
    name: name,
    level: level,
    duration: durationPerArt * items.length,
    price: visitPrice,
    author: visitAuthor,
    ofMuseum: museumUri,
    itemListElement: items,
    logistics: logist,
  });
}

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
