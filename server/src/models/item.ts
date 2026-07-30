/**
 * Documento Mongoose di un contenuto (item).
 *
 * `about` e' salvato come stringa — l'`@id` dell'opera — e non come oggetto: il
 * collegamento si espande con `populate` solo quando serve al client. Per questo
 * IItem restringe il tipo condiviso invece di ereditarlo tale e quale.
 */
import { Schema, model } from "mongoose";
import { Item as SharedItem } from "../../../shared/types";

export interface IItem extends Omit<SharedItem, "about"> {
  "@context": string;
  "@type": string;
  about: string; 
}

const itemSchema = new Schema<IItem>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "CreativeWork" },
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
  visibility: {
    type: String,
    enum: ["pubblico", "privato"],
    default: "pubblico",
  },
});

export const ItemModel = model<IItem>("Item", itemSchema);
