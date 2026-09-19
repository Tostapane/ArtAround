/**
 * Risolve una visita generata dall'LLM contro il catalogo e ordina le tappe secondo
 * data-flow della pianta, unica sorgente dell'ordine spaziale.
 */
import { createHash } from "crypto";
import { IArtwork } from "../models/artwork";
import { IItem, ItemModel } from "../models/item";
import { createTwistedDescription } from "./llm";

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
    kind: "opera",
    about: artwork["@id"],
    ofMuseum: artwork.ofMuseum,
    text,
    timeRequired: `${durationSec}`,
    educationalLevel: level,
    author: "AI",
  } as IItem;
}
