import { Schema, model, Document, Types } from "mongoose";

export type Expertise = "infantile" | "elementare" | "medio" | "specialistico";

export interface Artwork extends Document {
  // saranno necessari?
  "@context": string;
  "@type": string;
  "@id": string; // uri interno
  wikiDataUri: string;
  name?: string;
  image?: string;
  author?: string;
  style?: string;
  lastUpdated?: Date;
}

// L'Item rappresenta un testo descrittivo (CreativeWork) su un soggetto
export interface Item extends Document {
  "@context": string;
  "@type": string;
  "@id": string; // Identificativo univoco (URI) dell'Item

  about: Types.ObjectId | Artwork;
  timeRequired: string; // Lunghezza (es. "3s", "15s", "PT1M")
  educationalLevel: Expertise;
  author: string;
  license: string;
}

// La Visita è una sequenza (ItemList) di Item e indicazioni logistiche
export interface Visit extends Document {
  "@context": string;
  "@type": string;
  "@id": string; // Identificativo univoco (URI) della Visita

  name: string;
  price?: number;

  // La sequenza ordinata di descrizioni
  itemListElement: Item[];
  // La sequenza ordinata di indicazioni
  logistics: string[];
}

// --- Mongoose Schemas ---
const artworkSchema = new Schema<Artwork>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "VisualArtwork" },
  "@id": { type: String, required: true, unique: true },
  wikiDataUri: { type: String, required: true },
  name: String,
  image: String,
  author: String,
  style: String,
  lastUpdated: { type: Date, default: Date.now }, // Date.now?
});

const itemSchema = new Schema<Item>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "CreativeWork" },
  "@id": { type: String, required: true },
  about: { type: Schema.Types.ObjectId, ref: "Artwork", required: true },

  timeRequired: { type: String, required: true },
  educationalLevel: {
    type: String,
    enum: ["infantile", "elementare", "medio", "specialistico"],
    required: true,
  },
  author: { type: String, required: true },
  license: { type: String, required: true },
});

const visitSchema = new Schema<Visit>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "ItemList" },
  "@id": { type: String, required: true },

  name: { type: String, required: true },
  price: { type: Number },

  itemListElement: [itemSchema],
  logistics: [String],
});

// Esportazione dei Modelli
export const ArtworkModel = model<Artwork>("Artwork", artworkSchema);
export const ItemModel = model<Item>("Item", itemSchema);
export const VisitModel = model<Visit>("Visit", visitSchema);
