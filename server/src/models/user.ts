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
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["autore", "visitatore"], required: true },
  wallet: { type: Number, default: 100 },
  collezione: { type: [String], default: [] },
});

export const UserModel = model<IUser>("User", userSchema);
