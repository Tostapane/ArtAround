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

// NB: l'account non ha più un ruolo fisso — "autore"/"visitatore" sono modalità
// dell'interfaccia scelte dopo il login. Il campo `role` non fa più parte dello
// schema (eventuali valori residui su vecchi documenti vengono semplicemente
// ignorati).
const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  wallet: { type: Number, default: 100 },
  collezione: { type: [String], default: [] },
});

export const UserModel = model<IUser>("User", userSchema);
