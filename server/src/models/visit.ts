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
  price: Number,
  author: String,
  itemListElement: [String],
  logistics: [String],
});

export const VisitModel = model<IVisit>("Visit", visitSchema);
