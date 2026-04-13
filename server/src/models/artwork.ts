import { Schema, model, Document, Types } from "mongoose";
import { Artwork as SharedArtwork } from "../../../shared/types";

export interface Artwork extends SharedArtwork, Document {
  // saranno necessari?
  "@context": string;
  "@type": string;
  "@id": string; // uri interno
  wikiDataUri: string;
  name: string;
  imageUri: string;
  image: string;
  author: string;
  style: string;
  lastUpdated: Date;
  locationId: string;
}

// --- Mongoose Schemas ---
const artworkSchema = new Schema<Artwork>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "VisualArtwork" },
  "@id": { type: String, required: true, unique: true },
  wikiDataUri: { type: String, required: true },
  name: String,
  imageUri: String,
  image: String,
  author: String,
  style: String,
  lastUpdated: { type: Date, default: Date.now }, // Date.now?
  locationId: String,
});

// Esportazione dei Modelli
export const ArtworkModel = model<Artwork>("Artwork", artworkSchema);
