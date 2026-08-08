/**
 * Documento Mongoose di un contenuto (item).
 *
 * `about` e' salvato come stringa, cioe' l'`@id` dell'opera, e non come oggetto:
 * il collegamento si espande con `populate` solo quando serve al client. Per
 * questo IItem restringe il tipo condiviso invece di ereditarlo tale e quale.
 *
 * `about` non e' obbligatorio: uno stile o un periodo non sono un documento da
 * referenziare, sono il nome che ne ha scritto l'autore. A dire quale dei due
 * casi si ha in mano e' `kind`, che c'e' sempre.
 *
 * `ofMuseum` sta sull'item e non si risale all'opera: e' il campo con cui si
 * prende il catalogo di un museo, e un item senza opera non ci arriverebbe.
 *
 * Gli indici in fondo sono le forme di interrogazione che questo modello riceve
 * davvero: `@id` (la `findOne` di tutto il codice), `about` (gli item di una
 * singola opera), `ofMuseum` (il catalogo di un museo), `author` (i contenuti di
 * un autore, e le vendite). Senza, Mongo apre OGNI documento e scarta a mano, e
 * il costo cresce col numero di documenti invece che con quello dei risultati.
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
