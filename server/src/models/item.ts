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

// Indici: le forme di query che questo modello riceve davvero.
// Senza, Mongo apre OGNI documento e scarta a mano (COLLSCAN): il costo cresce
// col numero di documenti, non con quello dei risultati.
itemSchema.index({ "@id": 1 }, { unique: true }); // findOne per @id, dappertutto
itemSchema.index({ about: 1 }); // gli item di un'opera, e il catalogo per museo
itemSchema.index({ author: 1 }); // i contenuti di un autore, e le vendite

export const ItemModel = model<IItem>("Item", itemSchema);
