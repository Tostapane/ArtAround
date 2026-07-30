/**
 * Documento Mongoose di un'opera.
 */
import { Schema, model } from "mongoose";
import { Artwork as SharedArtwork } from "../../../shared/types";

/**
 * Interface representing the Artwork document in Mongoose.
 * It extends the SharedArtwork interface to include Schema.org metadata.
 */
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

// Indici: vedi la nota in models/item.ts.
// `@id` e' gia' unique nel campo, quindi Mongoose gli fa l'indice da se'.
artworkSchema.index({ qid: 1 });
artworkSchema.index({ ofMuseum: 1 });

export const ArtworkModel = model<IArtwork>("Artwork", artworkSchema);
