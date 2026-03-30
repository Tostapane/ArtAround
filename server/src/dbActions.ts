import { ArtworkModel } from "./models/artwork";
import { ItemModel } from "./models/item";
import { VisitModel } from "./models/visit";
import { fetchArtwork } from "./services/wikidata";
import { createDescription } from "./services/llm";

// il vantaggio di usare una lista di opere e' che il museo
// deve solo fornire gli uri delle loro opere
// runnundo una volta uno script init verra riempito tutto il
// database
export async function insertArtwork(currUri: string) {
  try {
    const data = await fetchArtwork(currUri);
    if (!data) {
      console.log("No data found for", currUri);
      return;
    }
    await ArtworkModel.create({
      "@id": `uri:${currUri}`,
      wikiDataUri: currUri,
      name: data.name,
      author: data.author,
      style: data.style,
    });
    console.log("Artwork nserito correttamente:", currUri);
  } catch (err) {
    console.error(`Errore di inserimento di ${currUri}:`, err);
  }
}

export async function deleteArtwork(currUri: string) {
  try {
    const result = await ArtworkModel.deleteOne({ wikiDataUri: currUri });
    if (result.deletedCount === 0)
      console.log("No artwork found with that URI");
    else console.log("Artwork successfully deleted");
  } catch (err) {
    console.error("Error during deletion of the artwork", err);
  }
}
// storia diversa per gli item, che possono essere sia forniti
// dal file iniziale che attraverso la piattaforma
// se non viene specificato autore e descrizione, se ne occupa l'ai
export async function insertItem(
  atworkUri: string,
  level: string,
  duration: number,
  itemAuthor?: string,
  itemPrice?: number,
  description?: string,
) {
  try {
    const artwork = await ArtworkModel.findOne({ wikiDataUri: atworkUri });
    if (!itemAuthor && !description) {
      description = await createDescription(artwork.name, level, duration);
      itemAuthor = "gemini";
    }
    const id = atworkUri + "-" + level + "-" + duration + "-" + itemAuthor;

    await ItemModel.create({
      // come tratto l'about?
      "@id": id,
      about: artwork._id,
      timeRequired: duration,
      educationalLevel: level,
      author: itemAuthor,
      price: itemPrice,
      text: description,
    });
    console.log("Item inserito correttamente");
  } catch (err) {
    console.error(`Errow while inserting the item`, err);
  }
}
export async function deleteItem(itemUri: string) {
  try {
    const result = await ItemModel.deleteOne({ id: itemUri });
    if (result.deletedCount === 0) console.log("No item found with that URI");
    else console.log("Item successfully deleted");
  } catch (err) {
    console.error("Error during deletion of the Item", err);
  }
}
// stessa storia per la visita, possibile reperirle sia dal file iniziale
// che crearne personalizzate direttamente dai customers!

export async function insertVisit() {}
