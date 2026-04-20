import { fetchArtwork } from "./services/wikidata";
import { downloadImage } from "./services/imageDownloader";
import { insertArtwork, insertItem, insertVisit } from "./dbActions";
import { ArtworkModel } from "./models/artwork";
import { createDescription } from "./services/llm";

/**
 * Popola un artwork nel database ottenendo dati da Wikidata.
 */
export async function populateArtwork(qid: string, location: string) {
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
    locationId: location,
  });
  console.log(`Artwork ${qid} inserito correttamente`);
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

  const id = `${atworkQid}-${level}-${duration}`;

  await insertItem({
    "@id": id,
    about: artwork["@id"], // Full Wikidata URL
    timeRequired: duration.toString(),
    educationalLevel: level,
    author: itemAuthor,
    price: itemPrice,
    text: description,
  });
  console.log("Item inserito correttamente");
}

/**
 * Inserisce una visita (percorso) nel database.
 */
export async function populateVisit(
  level: string,
  duration: number,
  items: string[],
  logist: string[],
  visitPrice?: number,
  visitAuthor?: string,
) {
  const name = `${level}-${duration}`;
  const id = `visit-${name}`;
  await insertVisit({
    "@id": id,
    name: name,
    level: level,
    duration: duration,
    price: visitPrice,
    author: visitAuthor,
    itemListElement: items,
    logistics: logist,
  });
  console.log("Visit inserita correttamente");
}
