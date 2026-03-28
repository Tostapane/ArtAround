import { Schema, model, Document, Types } from "mongoose";

// La Visita è una sequenza (ItemList) di Item e indicazioni logistiche
// nota: la visit aimmagazzina solo gli id degli item, non gli item stessi!
export interface Visit extends Document {
  "@context": string;
  "@type": string;
  "@id": string; // Identificativo univoco (URI) della Visita

  name: string;
  price?: number;
  museum?: string;
  author?: string;

  // La sequenza di id degli item selezionati
  itemListElement: string[];
  // La sequenza ordinata di indicazioni
  logistics: string[];
}

const visitSchema = new Schema<Visit>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "ItemList" },
  "@id": { type: String, required: true },

  name: { type: String, required: true },
  price: { type: Number },
  museum: { type: String, index: true },
  author: String,

  itemListElement: [String],
  logistics: [String],
});

export const VisitModel = model<Visit>("Visit", visitSchema);
