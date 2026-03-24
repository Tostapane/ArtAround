import { Schema, model, Document, Types } from "mongoose";

export type Expertise = "infantile" | "elementare" | "medio" | "specialistico";

// L'Item rappresenta un testo descrittivo (CreativeWork) su un soggetto
export interface Item extends Document {
  "@context": string;
  "@type": string;
  "@id": string; // Identificativo univoco (URI) dell'Item

  about: {
    "@type": string; // Es. "VisualArtwork", "Event", "Person"
    "@id": string; // URI del soggetto descritto
    name: string; // Nome del soggetto
  };

  timeRequired: string; // Lunghezza (es. "3s", "15s", "PT1M")
  educationalLevel: Expertise;
  author: string;
  license: string;
}

// Un passo della visita: può essere un Item descrittivo OPPURE un'indicazione logistica
export interface VisitStep {
  "@type": string;
  item?: Types.ObjectId | Item; // Riferimento a un Item (se è un passo descrittivo)
  logistics?: string; // Testo dell'indicazione logistica (se è un passo logistico)
}

// La Visita è una sequenza (ItemList) di Item e indicazioni logistiche
export interface Visit extends Document {
  "@context": string;
  "@type": string;
  "@id": string; // Identificativo univoco (URI) della Visita

  name: string;
  price?: number;

  // La sequenza ordinata di descrizioni e logistica
  itemListElement: VisitStep[];
}

// --- Mongoose Schemas ---

const itemSchema = new Schema<Item>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "CreativeWork" },
  "@id": { type: String, required: true },

  about: {
    "@type": { type: String, required: true },
    "@id": { type: String, required: true },
    name: { type: String, required: true },
  },

  timeRequired: { type: String, required: true },
  educationalLevel: {
    type: String,
    enum: ["infantile", "elementare", "medio", "specialistico"],
    required: true,
  },
  author: { type: String, required: true },
  license: { type: String, required: true },
});

const visitStepSchema = new Schema<VisitStep>(
  {
    "@type": { type: String, default: "HowToStep" },
    item: { type: Schema.Types.ObjectId, ref: "Item" },
    logistics: { type: String },
  },
  { _id: false },
); // Evita di creare un _id per ogni singolo passo se non necessario

const visitSchema = new Schema<Visit>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "ItemList" },
  "@id": { type: String, required: true },

  name: { type: String, required: true },
  price: { type: Number },

  itemListElement: [visitStepSchema],
});

// Esportazione dei Modelli
export const ItemModel = model<Item>("Item", itemSchema);
export const VisitModel = model<Visit>("Visit", visitSchema);
