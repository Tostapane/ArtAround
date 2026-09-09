/**
 * Schema Mongoose delle opere e indici per identificativo e museo, le due forme con
 * cui il catalogo le interroga.
 */
import { Schema, model } from "mongoose";
import { Artwork as SharedArtwork } from "../../../shared/types";

export interface IArtwork extends SharedArtwork {
  "@context": string;
  "@type": string;
}

const artworkSchema = new Schema<IArtwork>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "https://schema.org/VisualArtwork" },
  "@id": { type: String, required: true, unique: true },
  qid: { type: String, required: true },
  name: String,
  imageUri: String,
  imagePath: String,
  author: {
    name: String,
    qid: String,
  },
  style: {
    name: String,
    qid: String,
  },
  ofMuseum: String,
  lastUpdated: { type: Date, default: Date.now },
  locationId: String,
});

artworkSchema.index({ qid: 1 });
artworkSchema.index({ ofMuseum: 1 });

export const ArtworkModel = model<IArtwork>("Artwork", artworkSchema);
