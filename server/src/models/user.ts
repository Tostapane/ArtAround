/**
 * Documento Mongoose di un account.
 *
 * L'identita' e' la coppia (username, ruolo): lo stesso nome puo' esistere come
 * autore e come visitatore, e sono due account distinti e non collegati.
 * La password e' in chiaro: la sicurezza non e' materia di valutazione.
 */
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

const userSchema = new Schema<IUser>({
  username: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["autore", "visitatore"], required: true },
  wallet: { type: Number },
  collezione: { type: [String], default: [] },
});

userSchema.index({ username: 1, role: 1 }, { unique: true });

export const UserModel = model<IUser>("User", userSchema);
