/**
 * Documento Mongoose di una sessione aperta.
 *
 * Dice una cosa sola: quale stringa vale, in questo momento, per quale account.
 * Non porta portafoglio ne' collezione, che stanno sull'utente e si leggono
 * quando servono: copiandoli qui una sessione descriverebbe l'account com'era
 * al momento dell'accesso invece che com'e' adesso.
 *
 * Sta in Mongo e non in una Map perche' il processo riparte a ogni modifica del
 * codice: in memoria, ogni riavvio del server obbligherebbe tutti a rientrare.
 *
 * `expiresAt` e' un indice TTL, quindi le sessioni scadute le cancella Mongo da
 * se': non c'e' nessuna pulizia da ricordarsi di scrivere. Il controllo sulla
 * data resta comunque nel codice, perche' lo spazzino di Mongo passa circa una
 * volta al minuto e fra un passaggio e l'altro un documento scaduto c'e' ancora.
 */
import { Schema, model } from "mongoose";

export interface ISession {
  token: string;
  username: string;
  role: string;
  expiresAt: Date;
}

const sessionSchema = new Schema<ISession>({
  token: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  role: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<ISession>("Session", sessionSchema);
