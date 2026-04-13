import { Schema, model, Document, Types } from "mongoose";
import { Artwork } from "./artwork";
import { Item as SharedItem } from "../../../shared/types";

// export type Expertise = "infantile" | "elementare" | "medio" | "specialistico";

// L'Item rappresenta un testo descrittivo (CreativeWork) su un soggetto
export interface Item extends Omit<SharedItem, "about">, Document {
  "@context": string; // uri schema.org
  "@type": string; // CreativeWork

  // uri opera + difficolta + tempo richiesto
  // Q12418-Principiante-5 = Mona Lisa, livello principiante, 5 secondi
  "@id": string;

  about: Types.ObjectId | Artwork;
  timeRequired: string; // Lunghezza (es. "3s", "15s", "PT1M")
  educationalLevel: string;
  author: string;
  license: string;
  price?: number;
  text: string;
}

const itemSchema = new Schema<Item>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "CreativeWork" },
  "@id": { type: String, required: true },
  about: { type: Schema.Types.ObjectId, ref: "Artwork", required: true },

  timeRequired: { type: String, required: true },
  educationalLevel: { type: String, required: true },
  author: { type: String, required: true },
  license: {
    type: String,
    default: "https://creativecommons.org/licenses/by/4.0/",
  },
  price: { type: Number, default: 0 },
  text: String,
});

export const ItemModel = model<Item>("Item", itemSchema);
