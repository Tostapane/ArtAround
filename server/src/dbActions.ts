import { IArtwork, ArtworkModel } from "./models/artwork";
import { IItem, ItemModel } from "./models/item";
import { IVisit, VisitModel } from "./models/visit";
import { fetchArtwork } from "./services/wikidata";
import { createDescription } from "./services/llm";
import { downloadImage } from "./services/imageDownloader";
import { IMuseum, MuseumModel } from "./models/museum";
// il vantaggio di usare una lista di opere e' che il museo
// deve solo fornire gli uri delle loro opere
// runnundo una volta uno script init verra riempito tutto il
// database

/*
 * ARTWORK
 */
export async function insertArtwork(artwork: Partial<IArtwork>) {
  return await ArtworkModel.create(artwork);
}

export async function deleteArtwork(Qid: string) {
  const result = await ArtworkModel.deleteOne({ qid: Qid });
  if (result.deletedCount === 0) throw new Error("No artwork deleted that ID");
}

/*
 * ITEM
 */
export async function insertItem(item: Partial<IItem>) {
  return await ItemModel.create(item);
}
export async function deleteItem(itemId: string) {
  const result = await ItemModel.deleteOne({ "@id": itemId });
  if (result.deletedCount === 0)
    throw new Error("No item deleted with that ID");
}

/*
 * VISIT
 */
export async function insertVisit(visit: Partial<IVisit>) {
  return await VisitModel.create(visit);
}
export async function deleteVisit(visitId: string) {
  const result = await VisitModel.deleteOne({ "@id": visitId });
  if (result.deletedCount === 0)
    throw new Error("No visit deleted with that ID");
}

/*
 * MUSEUM
 */
export async function intertMuseum(museum: Partial<IMuseum>) {
  return await MuseumModel.create(museum);
}
export async function deleteMuseum(museumId: string) {
  const result = await MuseumModel.deleteOne({ "@id": museumId });
  if (result.deletedCount === 0)
    throw new Error("No museum deleted with that ID");
}
