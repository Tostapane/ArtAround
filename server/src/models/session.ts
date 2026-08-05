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
 *
 * `kind` distingue una sessione dal biglietto di passaggio verso il navigator.
 * Senza, sono la stessa riga, e il biglietto — che viaggia in un indirizzo,
 * quindi finisce nella cronologia e nei registri del proxy — varrebbe da se'
 * come intestazione `Authorization` per tutti i suoi dieci minuti. Vale invece
 * solo a `POST /users/redeem`, che spendendolo lo cancella.
 */
import { Schema, model } from "mongoose";

export type SessionKind = "sessione" | "handoff";

export interface ISession {
  token: string;
  username: string;
  role: string;
  kind: SessionKind;
  expiresAt: Date;
}

const sessionSchema = new Schema<ISession>({
  token: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  role: { type: String, required: true },
  kind: { type: String, required: true, default: "sessione" },
  expiresAt: { type: Date, required: true },
});

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<ISession>("Session", sessionSchema);
