import { Schema, model, Document, Types } from "mongoose";
import { Artwork } from "./artwork";

export type Expertise = "infantile" | "elementare" | "medio" | "specialistico";

// L'Item rappresenta un testo descrittivo (CreativeWork) su un soggetto
export interface Item extends Document {
  "@context": string;
  "@type": string;
  "@id": string; // Identificativo univoco (URI) dell'Item

  about: Types.ObjectId | Artwork;
  timeRequired: string; // Lunghezza (es. "3s", "15s", "PT1M")
  educationalLevel: Expertise;
  author: string;
  license: string;
}

const itemSchema = new Schema<Item>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "CreativeWork" },
  "@id": { type: String, required: true },
  about: { type: Schema.Types.ObjectId, ref: "Artwork", required: true },

  timeRequired: { type: String, required: true },
  educationalLevel: {
    type: String,
    enum: ["infantile", "elementare", "medio", "specialistico"],
    required: true,
  },
  author: { type: String, required: true },
  license: { type: String, required: true },
});

export const ItemModel = model<Item>("Item", itemSchema);
