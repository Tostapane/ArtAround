import { Schema, model } from "mongoose";
import { Item as SharedItem } from "../../../shared/types";

/**
 * Interface representing the Item (CreativeWork) document in Mongoose.
 * Extends SharedItem but forces 'about' to be a string (Artwork ID) for DB storage.
 */
export interface IItem extends Omit<SharedItem, "about"> {
  "@context": string;
  "@type": string;
  about: string; // Stored as reference ID
}

const itemSchema = new Schema<IItem>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "https://schema.org/CreativeWork" },
  "@id": { type: String, required: true },
  about: { type: String, required: true },
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

export const ItemModel = model<IItem>("Item", itemSchema);
