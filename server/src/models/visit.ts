/**
 * Documento Mongoose di una visita.
 *
 * Le note logistiche sono di tipo libero perche' i documenti creati prima delle
 * note posizionate contengono stringhe nude; i client sanno leggere entrambe le
 * forme e `testers.ts` le riallinea.
 */
import { Schema, model } from "mongoose";
import { Visit as SharedVisit } from "../../../shared/types";

/**
 * Interface representing the Visit (ItemList) document in Mongoose.
 */
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
  license: String,
  ofMuseum: String,
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

export const VisitModel = model<IVisit>("Visit", visitSchema);
