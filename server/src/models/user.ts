/**
 * Documento Mongoose di un account.
 *
 * L'identita' e' la coppia (username, ruolo): lo stesso nome puo' esistere come
 * autore e come curatore, e sono account distinti e non collegati.
 * I ruoli sono tre: visitatore (consuma), autore (produce), curatore (risponde
 * del museo). Solo il visitatore ha un portafoglio e una collezione; sugli
 * altri due i campi restano assenti, non a zero.
 * La password e' in chiaro: la sicurezza non e' materia di valutazione.
 *
 * L'indice su `collezione` serve a chiedere chi possiede un contenuto: lo
 * chiedono il resoconto vendite e il calcolo dell'impatto di un'eliminazione, e
 * senza indice ogni conteggio scandisce l'intera collezione degli utenti.
 */
import { Schema, model } from "mongoose";
import { User as SharedUser } from "../../../shared/types";

export interface IUser extends SharedUser {
  password: string;
}

const userSchema = new Schema<IUser>({
  username: { type: String, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["autore", "visitatore", "curatore"],
    required: true,
  },
  wallet: { type: Number },
  collezione: { type: [String], default: [] },
});

userSchema.index({ username: 1, role: 1 }, { unique: true });
userSchema.index({ collezione: 1 });

export const UserModel = model<IUser>("User", userSchema);
