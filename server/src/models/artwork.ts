/**
 * Documento Mongoose di un'opera.
 *
 * `IArtwork` estende il tipo condiviso con i due campi Schema.org che stanno
 * solo sul documento salvato.
 *
 * Gli indici sono le forme di interrogazione che questo modello riceve davvero
 * (il perche' sta in `models/item.ts`): per qid, e per museo. `@id` e' gia'
 * `unique` sul campo, quindi Mongoose gli fa l'indice da se'.
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
