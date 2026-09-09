/**
 * Schema dei biglietti opachi di sessione e handoff. L'indice TTL elimina le
 * credenziali scadute senza affidare la durata alla memoria del processo.
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
