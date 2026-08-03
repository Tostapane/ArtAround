/**
 * Chi sta chiedendo: dall'intestazione `Authorization` all'account.
 *
 * L'identita' viaggiava nell'indirizzo (`?user=nome`), e un nome scritto a mano
 * valeva quanto quello vero: bastava cambiarlo per leggere i testi a pagamento
 * di un altro, spendere il suo portafoglio o cancellargli un contenuto. Ora
 * viaggia in un'intestazione e vale solo se e' il server ad averla coniata, in
 * `POST /users/login`, che e' l'unico punto in cui la password si verifica.
 *
 * Due mestieri, tenuti separati apposta:
 *   resolveSession  GUARDA  — montata su tutto /api, non rifiuta niente e
 *                             lascia l'utente assente se non c'e' biglietto;
 *   requireSession  DECIDE  — sulle rotte che un utente lo pretendono.
 * Quattro rotte devono restare aperte (`index.ts` dice quali e perche'), e un
 * rifiuto montato su tutto le spegnerebbe senza dirlo.
 *
 * IL BIGLIETTO PER IL NAVIGATOR e' una sessione come le altre, con una scadenza
 * corta. Il navigator sta su un'altra origine e non vede la memoria del
 * marketplace, quindi l'identita' deve attraversare nell'indirizzo; ma un
 * indirizzo finisce nella cronologia e nei registri, percio' quel che attraversa
 * non e' la sessione lunga — e' un biglietto da dieci minuti che `POST
 * /users/redeem` cancella spendendolo. Una collezione sola e un concetto solo:
 * cambia quanto vive, non che cos'e'.
 *
 * L'utente si legge con `sessionUser` e mai da `req` a mano: aggiungere il campo
 * ai tipi di Express vorrebbe dire un `.d.ts` ambientale, e ts-node quelli non li
 * carica (il motivo sta in cima a `env.ts`).
 */
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { SessionModel } from "./models/session";

export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
export const TICKET_TTL_MS = 10 * 60 * 1000;

export interface SessionUser {
  username: string;
  role: string;
}

/**
 * Si chiama solo dietro `requireSession`, che garantisce l'utente: se manca e'
 * una rotta montata senza guardia, cioe' un difetto nostro, e va vista subito
 * invece di diventare una richiesta anonima servita per sbaglio.
 */
export function sessionUser(req: Request): SessionUser {
  const found = (req as any).sessionUser;
  if (!found) throw new Error("Rotta senza requireSession");
  return found;
}

export async function createSession(
  user: SessionUser,
  ttlMs: number = SESSION_TTL_MS,
): Promise<string> {
  const token = randomUUID();
  await SessionModel.create({
    token,
    username: user.username,
    role: user.role,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

/** Spendere un biglietto e uscire sono la stessa operazione: la riga sparisce. */
export async function destroySession(
  token: string,
): Promise<SessionUser | null> {
  if (!token) return null;
  const found = await SessionModel.findOneAndDelete({ token });
  if (!found) return null;
  if (found.expiresAt.getTime() < Date.now()) return null;
  return { username: found.username, role: found.role };
}

export async function endSession(req: Request): Promise<void> {
  await destroySession(tokenFromHeader(req));
}

function tokenFromHeader(req: Request): string {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

export async function resolveSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = tokenFromHeader(req);
  if (!token) return next();
  try {
    const found = await SessionModel.findOne({ token });
    if (found && found.expiresAt.getTime() > Date.now())
      (req as any).sessionUser = {
        username: found.username,
        role: found.role,
      };
  } catch {
    // Un guasto del database non e' un rifiuto: la rotta trovera' l'utente
    // assente e rispondera' 401, come farebbe a un biglietto sconosciuto.
  }
  next();
}

export function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!(req as any).sessionUser)
    return res.status(401).json({ error: "Sessione assente o scaduta." });
  next();
}
