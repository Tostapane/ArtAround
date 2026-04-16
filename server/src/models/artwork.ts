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
  lastUpdated: { type: Date, default: Date.now },
  locationId: String,
});

export const ArtworkModel = model<IArtwork>("Artwork", artworkSchema);
