import { Schema, model, Document } from "mongoose";
export type expertise = "infantile" | "semplice" | "medio" | "avanzato";
export type time = 5 | 30 | 60 | 120 | 240;
// visita -> insieme di opere
// ogni visita ha piu item
// item -> descrizione fornita da un autore per una specifica opera

// opzione 1 -> ogni opera contiene gli item di se stessa
// opzione 2 -> la visita contiene gli item, questi vengono selezionati a runtime in abse alle opere scelte

export interface Opera extends Document {
  id: string;
  title: string;
  author: string;
  // indicazioni spaziali ?
}

export interface Item extends Document {
  "@context": string;
  "@type": string;

  timeRequired: time;
  educationalLevel: expertise;
  author: string;
  license: string;
}

export interface Visit extends Document {
  // indicazioni spaziali ?
  price: number;
  items: Item[];
}

const itemSchema = new Schema<Item>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "Artwork" },

  timeRequired: { type: Number, required: true },
  educationalLevel: { type: String, required: true },
  author: { type: String, required: true },
  license: { type: String, required: true },
});
