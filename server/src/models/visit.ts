/**
 * Documento Mongoose di una visita.
 *
 * Le note logistiche sono di tipo libero perche' i documenti creati prima delle
 * note posizionate contengono stringhe nude; i client sanno leggere entrambe le
 * forme e `testers.ts` le riallinea.
 *
 * `license` e `visibility` hanno un valore di scorta sullo SCHEMA e non nella
 * funzione che scrive, come sull'item, perche' non tutte le visite nascono dalla
 * stessa funzione: le due speciali del seed (tappe opzionali e guidata) le scrive
 * `VisitModel.create` per conto suo, e senza queste righe uscivano senza diritti
 * dichiarati.
 *
 * Gli indici sono le forme di interrogazione che questo modello riceve davvero
 * (il perche' sta in `models/item.ts`): `@id`, `ofMuseum` (le visite di un museo,
 * la piu' frequente), `author`, e `itemListElement`, che serve a chiedere chi cita
 * un item — cioe' alla cascata di un'eliminazione.
 */
import { Schema, model } from "mongoose";
import { Visit as SharedVisit } from "../../../shared/types";
import { DEFAULT_LICENSE } from "../../../shared/constants";

export interface IVisit extends SharedVisit {
  "@context": string;
  "@type": string;
}

const visitSchema = new Schema<IVisit>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "ItemList" },
  "@id": { type: String, required: true },
  name: { type: String, required: true },
  level: { type: String, required: true },
  duration: { type: Number, required: true },
  price: Number,
  author: String,
  license: { type: String, default: DEFAULT_LICENSE },
  ofMuseum: String,
  visibility: {
    type: String,
    enum: ["pubblico", "privato"],
    default: "pubblico",
  },
  imagePath: { type: String },
  itemListElement: [String],
  optionalItems: [String],
  logistics: [Schema.Types.Mixed],
  accessKey: String,
  quiz: {
    type: [
      {
        _id: false,
        question: { type: String, required: true },
        options: { type: [String], required: true },
        correct: { type: Number, required: true },
      },
    ],
    default: undefined,
  },
});

visitSchema.index({ "@id": 1 }, { unique: true });
visitSchema.index({ ofMuseum: 1 });
visitSchema.index({ author: 1 });
visitSchema.index({ itemListElement: 1 });

export const VisitModel = model<IVisit>("Visit", visitSchema);
