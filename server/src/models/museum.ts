/**
 * Documento Mongoose di un museo.
 *
 * `IMuseum` estende il tipo condiviso con i due campi Schema.org che stanno solo
 * sul documento salvato. Non tutti i campi del tipo hanno una colonna qui:
 * `logistics` sta nel file di configurazione e `opere`/`visite` sono conteggi che
 * la rotta calcola, quindi ne' gli uni ne' gli altri si salvano.
 */
import { Schema, model } from "mongoose";
import { Museum as SharedMuseum } from "../../../shared/types";

export interface IMuseum extends SharedMuseum {
  "@context": string;
  "@type": string;
}

const museumSchema = new Schema<IMuseum>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "https://schema.org/Museum" },
  "@id": { type: String, required: true, unique: true },
  qid: String,
  name: String,
  created: String,
  location: String,
  mapPath: String,
  imagePath: String,
});

export const MuseumModel = model<IMuseum>("Museum", museumSchema);
