/**
 * Documento Mongoose di un account.
 *
 * L'identita' e' l'USERNAME, e un nome vale per una persona sola: non esistono
 * un autore e un visitatore omonimi. La regola non e' cosmetica, e' quella che
 * rende vere tutte le guardie sui contenuti: `Item.author` e `Visit.author`
 * sono un nome nudo, senza il ruolo accanto, quindi finche' due account
 * potevano condividerlo bastava entrare con l'altro profilo per cancellare le
 * descrizioni del primo e per leggerne le private.
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

userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ collezione: 1 });

export const UserModel = model<IUser>("User", userSchema);
