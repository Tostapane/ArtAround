/**
 * Scritture e letture elementari sul database.
 *
 * Qui stanno gli inserimenti idempotenti (upsert per @id) usati dal seed e la
 * risoluzione degli item per le visite su misura. `resolveOrGenerateItem` usa il
 * `twist` come interruttore: senza angolazione particolare riusa un item curato
 * gia' presente, con un'angolazione ne genera uno nuovo che NON viene salvato —
 * le visite su misura vivono solo nel client.
 */
import { createHash } from "crypto";
import { IArtwork, ArtworkModel } from "./models/artwork";
import { IItem, ItemModel } from "./models/item";
import { IVisit, VisitModel } from "./models/visit";
import { createTwistedDescription } from "./services/llm";
import { IMuseum, MuseumModel } from "./models/museum";

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

export async function insertItem(item: Partial<IItem>) {
  return await ItemModel.create(item);
}
export async function deleteItem(itemId: string) {
  const result = await ItemModel.deleteOne({ "@id": itemId });
  if (result.deletedCount === 0)
    throw new Error("No item deleted with that ID");
}

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
      timeRequired: `${durationSec}`,
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

  let id = `${artwork.qid}-AI-${level}-${durationSec}`;
  if (hasTwist) {
    const hash = createHash("sha1").update(twist.trim()).digest("hex").slice(0, 8);
    id = `${id}-${hash}`;
  }
  return {
    "@id": id,
    about: artwork["@id"],
    text,
    timeRequired: `${durationSec}`,
    educationalLevel: level,
    author: "AI",
  } as IItem;
}

export async function insertVisit(visit: Partial<IVisit>) {
  return await VisitModel.create(visit);
}
export async function deleteVisit(visitId: string) {
  const result = await VisitModel.deleteOne({ "@id": visitId });
  if (result.deletedCount === 0)
    throw new Error("No visit deleted with that ID");
}

export async function intertMuseum(museum: Partial<IMuseum>) {
  return await MuseumModel.create(museum);
}
export async function deleteMuseum(museumId: string) {
  const result = await MuseumModel.deleteOne({ "@id": museumId });
  if (result.deletedCount === 0)
    throw new Error("No museum deleted with that ID");
}
