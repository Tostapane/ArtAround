import { fetchArtwork } from "./services/wikidata";
import { downloadImage } from "./services/imageDownloader";
import { insertArtwork } from "./dbActions";
import { ArtworkModel } from "./models/artwork";
import { insertItem } from "./dbActions";
import { createDescription } from "./services/llm";

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
    about: artwork._id,
    timeRequired: duration.toString(),
    educationalLevel: level,
    author: itemAuthor,
    price: itemPrice,
    text: description,
  });
  console.log("Item inserito correttamente");
}
