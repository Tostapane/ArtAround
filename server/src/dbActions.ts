import { createHash } from "crypto";
import { IArtwork, ArtworkModel } from "./models/artwork";
import { IItem, ItemModel } from "./models/item";
import { IVisit, VisitModel } from "./models/visit";
import { fetchArtwork } from "./services/wikidata";
import { createDescription, createTwistedDescription } from "./services/llm";
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

// Risolve l'item da usare per un'opera in una visita SU MISURA.
// Il `twist` (angolazione da enfatizzare) fa anche da interruttore di riuso:
//  - twist vuoto -> riusa un item esistente (curato o gia' presente nel DB):
//    livello+durata, poi solo livello, poi uno qualsiasi;
//  - twist presente (o nessun item da riusare) -> genera la descrizione.
// Le visite su misura vivono nel client: l'item generato NON viene persistito,
// e' costruito in memoria e restituito al chiamante. Ritorna null se la
// generazione fallisce.
export async function resolveOrGenerateItem(
  artwork: IArtwork,
  level: string,
  durationSec: number,
  twist: string,
): Promise<IItem | null> {
  const baseFilter = { about: artwork["@id"] };
  const hasTwist = twist.trim() !== "";

  if (!hasTwist) {
    let item = await ItemModel.findOne({
      ...baseFilter,
      educationalLevel: level,
      timeRequired: `${durationSec}s`,
    });
    if (!item)
      item = await ItemModel.findOne({ ...baseFilter, educationalLevel: level });
    if (!item) item = await ItemModel.findOne(baseFilter);
    if (item) return item;
  }

  const text = await createTwistedDescription(
    artwork.name,
    artwork.author.name,
    level,
    durationSec,
    twist,
  );
  if (!text) return null;

  // @id solo informativo (item non persistito); il twist lo rende distinto
  let id = `${artwork.qid}-AI-${level}-${durationSec}`;
  if (hasTwist) {
    const hash = createHash("sha1").update(twist.trim()).digest("hex").slice(0, 8);
    id = `${id}-${hash}`;
  }
  return {
    "@id": id,
    about: artwork["@id"],
    text,
    timeRequired: `${durationSec}s`,
    educationalLevel: level,
    author: "AI",
  } as IItem;
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
