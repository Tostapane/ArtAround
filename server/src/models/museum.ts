/** Materializza in Mongo i musei configurati per servirli senza rileggere Wikidata. */
import { Schema, model } from "mongoose";
import { Museum as SharedMuseum } from "../../../shared/types";

export interface IMuseum extends SharedMuseum {
  "@context": string;
  "@type": string;
}

const museumSchema = new Schema<IMuseum>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "https://schema.org/Museum" },
  "@id": { type: String, required: true, unique: true },
  qid: String,
  name: String,
  created: String,
  location: String,
  mapPath: String,
  imagePath: String,
});

export const MuseumModel = model<IMuseum>("Museum", museumSchema);
