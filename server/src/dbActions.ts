import { Artwork, ArtworkModel } from "./models/artwork";
import { Item, ItemModel } from "./models/item";
import { VisitModel } from "./models/visit";
import { fetchArtwork } from "./services/wikidata";
import { createDescription } from "./services/llm";
import { downloadImage } from "./services/imageDownloader";
// il vantaggio di usare una lista di opere e' che il museo
// deve solo fornire gli uri delle loro opere
// runnundo una volta uno script init verra riempito tutto il
// database

export async function insertArtwork(artwork: Partial<Artwork>) {
  return await ArtworkModel.create(artwork);
}

export async function deleteArtwork(uri: string) {
  const result = await ArtworkModel.deleteOne({ wikiDataUri: uri });
  if (result.deletedCount === 0) throw new Error("No artwork with that URI");
}

export async function insertItem(item: Partial<Item>) {
  return await ItemModel.create(item);
}
export async function deleteItem(itemUri: string) {
  const result = await ItemModel.deleteOne({ "@id": itemUri });
  if (result.deletedCount === 0) throw new Error("No item found with that URI");
}
// stessa storia per la visita, possibile reperirle sia dal file iniziale
// che crearne personalizzate direttamente dai customers!

export async function insertVisit() {}
