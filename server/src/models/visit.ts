/**
 * Documento Mongoose di una visita.
 *
 * Le note logistiche sono di tipo libero perche' i documenti creati prima delle
 * note posizionate contengono stringhe nude; i client sanno leggere entrambe le
 * forme e `testers.ts` le riallinea.
 */
import { Schema, model } from "mongoose";
import { Visit as SharedVisit } from "../../../shared/types";
import { DEFAULT_LICENSE } from "../../../shared/constants";

/**
 * Interface representing the Visit (ItemList) document in Mongoose.
 */
export interface IVisit extends SharedVisit {
  "@context": string;
  "@type": string;
}

const visitSchema = new Schema<IVisit>({
  "@context": { type: String, default: "https://schema.org" },
  "@type": { type: String, default: "ItemList" },
  "@id": { type: String, required: true },
  name: { type: String, required: true },
  level: { type: String, required: true },
  duration: { type: Number, required: true },
  price: Number,
  author: String,
  // Come sull'item: un default sullo schema, perche' non tutte le visite nascono
  // dalla stessa funzione. Le due speciali del seed (tappe opzionali e guidata)
  // le scrive `VisitModel.create` per conto suo, e senza questa riga uscivano
  // senza diritti dichiarati.
  license: { type: String, default: DEFAULT_LICENSE },
  ofMuseum: String,
  imagePath: { type: String },
  itemListElement: [String],
  optionalItems: [String],
  logistics: [Schema.Types.Mixed],
  accessKey: String,
  quiz: {
    type: [
      {
        _id: false,
        question: { type: String, required: true },
        options: { type: [String], required: true },
        correct: { type: Number, required: true },
      },
    ],
    default: undefined,
  },
});

// Indici: vedi la nota in models/item.ts.
visitSchema.index({ "@id": 1 }, { unique: true });
visitSchema.index({ ofMuseum: 1 }); // le visite di un museo: la query piu' frequente
visitSchema.index({ author: 1 });
visitSchema.index({ itemListElement: 1 }); // chi cita un item: serve alla cascata

export const VisitModel = model<IVisit>("Visit", visitSchema);
