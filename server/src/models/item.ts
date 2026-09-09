/**
 * Schema Mongoose dei contenuti narrativi. Gli indici seguono catalogo, autore,
 * museo e soggetto; il testo puo' parlare di un'opera o di un tema associato.
 */
import { Schema, model } from "mongoose";
import { Item as SharedItem } from "../../../shared/types";
import { DEFAULT_LICENSE } from "../../../shared/constants";

export interface IItem extends Omit<SharedItem, "about"> {
  "@context": string;
  "@type": string;
  about?: string;
}

const itemSchema = new Schema<IItem>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "CreativeWork" },
  "@id": { type: String, required: true },
  kind: { type: String, required: true },
  about: { type: String },
  subject: { type: String },
  imagePath: { type: String },
  ofMuseum: { type: String, required: true },
  timeRequired: { type: String, required: true },
  educationalLevel: { type: String, required: true },
  author: { type: String, required: true },
  license: {
    type: String,
    default: DEFAULT_LICENSE,
  },
  price: { type: Number, default: 0 },
  text: String,
  visibility: {
    type: String,
    enum: ["pubblico", "privato"],
    default: "pubblico",
  },
});

itemSchema.index({ "@id": 1 }, { unique: true });
itemSchema.index({ about: 1 });
itemSchema.index({ ofMuseum: 1 });
itemSchema.index({ author: 1 });

export const ItemModel = model<IItem>("Item", itemSchema);
