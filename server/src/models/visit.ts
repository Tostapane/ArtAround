/**
 * Schema delle visite: percorso, logistica ancorata, opzionali, visibilita', accesso
 * guidato e quiz. Gli indici servono catalogo e autore.
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
