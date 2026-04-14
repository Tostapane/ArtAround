import { fetchArtwork } from "./services/wikidata";
import { downloadImage } from "./services/imageDownloader";
import { insertArtwork, insertItem, insertVisit } from "./dbActions";
import { ArtworkModel } from "./models/artwork";
import { createDescription } from "./services/llm";

/** funzione che si occupa ti ottenere le informazioni da wikidata,
 * scaricare l'immagine,
 * inserire l'immagine nel database
 */
export async function populateArtwork(uri: string, location: string) {
  const data = await fetchArtwork(uri);
  if (!data) throw new Error("Artwork non trovato");
  const imagePath = await downloadImage(data.image, `${uri}`);
  await insertArtwork({
    ...data,
    imageUri: data.image,
    image: imagePath,
    "@id": `uri:${uri}`,
    wikiDataUri: uri,
    locationId: location,
  });
  console.log("Artwork inserito correttamente");
}
/*
 * funzione che si occupa di creare la descrizione per un'opera
 * secondo i parametri specificati
 * aggiunge l'opera al database
 */

export async function populateItem(
  atworkUri: string,
  level: string,
  duration: number,
  itemAuthor?: string,
  itemPrice?: number,
  description?: string,
) {
  const artwork = await ArtworkModel.findOne({ wikiDataUri: atworkUri });
  if (!artwork) {
    throw new Error(`Artwork non trovato per URI: ${atworkUri}`);
  }

  console.log(` Genero ${artwork.name} ${level} ${duration} `);

  if (!itemAuthor && !description) {
    description = await createDescription(artwork.name, level, duration);
    itemAuthor = "sistema";
  }
  const id = atworkUri + "-" + level + "-" + duration + "-" + itemAuthor;

  await insertItem({
    "@id": id,
    about: artwork["@id"],
    timeRequired: duration.toString(),
    educationalLevel: level,
    author: itemAuthor,
    price: itemPrice,
    text: description,
  });
  console.log("Item inserito correttamente");
}

/*
 * funzione che si occupa di inserire nel database una visita, da ampliare?
 */
export async function populateVisit(
  name: string,
  items: string[],
  logist: string[],
  visitPrice?: number,
  visitAuthor?: string,
) {
  const id = "visit" + "-" + name;
  await insertVisit({
    "@id": id,
    name: name,
    price: visitPrice,
    author: visitAuthor,
    itemListElement: items,
    logistics: logist,
  });
  console.log("Visit inserita correttamente");
}
