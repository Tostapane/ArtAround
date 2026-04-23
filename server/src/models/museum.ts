import { Schema, model } from "mongoose";
import { Museum as SharedMuseum } from "../../../shared/types";

/**
 * Interface representing the Museum document in Mongoose.
 * It extends the SharedMuseum interface to include Schema.org metadata.
 */

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
});

export const MuseumModel = model<IMuseum>("Museum", museumSchema);
