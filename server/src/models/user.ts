import { Schema, model } from "mongoose";
import { User as SharedUser } from "../../../shared/types";

/**
 * Documento Utente del marketplace.
 * NOTA: la sicurezza NON e' oggetto di valutazione (vedi spec.md), quindi la
 * password e' salvata in chiaro per semplicita' della demo — non farlo in un
 * prodotto reale.
 */
export interface IUser extends SharedUser {
  password: string;
}

// Il ruolo fa parte dell'identità: un account è autore OPPURE visitatore. Lo
// stesso username può esistere una volta come autore e una come visitatore
// (account distinti, non collegati). L'unicità è quindi sulla COPPIA
// (username, role), non sul solo username.
const userSchema = new Schema<IUser>({
  username: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["autore", "visitatore"], required: true },
  // Il wallet (budget d'acquisto) è un concetto da VISITATORE: gli account
  // autore NON ce l'hanno (non comprano; i ricavi si vedono in /sales). Nessun
  // default → viene impostato esplicitamente solo per i visitatori.
  wallet: { type: Number },
  collezione: { type: [String], default: [] },
});

userSchema.index({ username: 1, role: 1 }, { unique: true });

export const UserModel = model<IUser>("User", userSchema);
