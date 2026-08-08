/**
 * Chi sta chiedendo: dall'intestazione `Authorization` all'account.
 *
 * L'identita' non sta nell'indirizzo, perche' un nome scritto a mano varrebbe
 * quanto quello vero: viaggia in un'intestazione e vale solo se e' il server ad
 * averla coniata, in `POST /users/login`, che con `register` e' l'unico punto in
 * cui una password si verifica.
 *
 * Due mestieri, separati apposta:
 *   resolveSession  guarda: montata su tutto /api, non rifiuta niente;
 *   requireSession  decide: sta sulle rotte che un utente lo pretendono.
 * Quattro rotte devono restare aperte (`index.ts` dice quali), e un rifiuto
 * montato su tutto le spegnerebbe senza dirlo.
 *
 * Il biglietto per il navigator e' una riga come le altre con una scadenza
 * corta e un `kind` diverso: il navigator sta su un'altra origine, quindi
 * l'identita' deve attraversare nell'indirizzo, ma un indirizzo finisce nella
 * cronologia e nei registri, percio' quel che attraversa dura dieci minuti,
 * `POST /users/redeem` lo cancella spendendolo, e `resolveSession` non lo
 * accetta come intestazione: senza quel `kind` il biglietto sarebbe una
 * credenziale piena, spendibile quante volte si vuole finche' non scade.
 *
 * L'utente si legge con `sessionUser` e mai da `req` a mano: aggiungere il campo
 * ai tipi di Express vorrebbe dire un `.d.ts` ambientale, e ts-node quelli non
 * li carica (il motivo sta in cima a `env.ts`). `sessionUser` solleva se l'utente
 * manca invece di tornare null: si chiama solo dietro `requireSession`, quindi
 * l'assenza e' una rotta montata senza guardia — un difetto nostro, da vedere
 * subito invece che diventare una richiesta anonima servita per sbaglio.
 *
 * `destroySession` copre due gesti che sono la stessa operazione, spendere un
 * biglietto e uscire: la riga sparisce. Il `kind` entra nell'interrogazione e non
 * in un controllo dopo, perche' `redeem` pretende un biglietto e cancellare prima
 * di guardare vorrebbe dire che mandargli una sessione qualunque la butta giu';
 * l'uscita non lo passa, perche' li' va bene qualunque riga sia.
 *
 * In `resolveSession` il filtro e' `kind: { $ne: "handoff" }` e non
 * `kind: "sessione"` perche' le righe scritte prima che il campo esistesse non ce
 * l'hanno, e sono sessioni vere. Un guasto del database non e' un rifiuto: si
 * lascia passare senza utente, e la rotta rispondera' 401 come farebbe a un
 * biglietto sconosciuto.
 */
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { SessionModel, SessionKind } from "./models/session";

export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
export const TICKET_TTL_MS = 10 * 60 * 1000;

export interface SessionUser {
  username: string;
  role: string;
}

export function sessionUser(req: Request): SessionUser {
  const found = (req as any).sessionUser;
  if (!found) throw new Error("Rotta senza requireSession");
  return found;
}

export async function createSession(
  user: SessionUser,
  ttlMs: number = SESSION_TTL_MS,
  kind: SessionKind = "sessione",
): Promise<string> {
  const token = randomUUID();
  await SessionModel.create({
    token,
    username: user.username,
    role: user.role,
    kind,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

export async function destroySession(
  token: string,
  kind?: SessionKind,
): Promise<SessionUser | null> {
  if (!token) return null;
  const filtro: Record<string, unknown> = { token };
  if (kind) filtro.kind = kind;
  const found = await SessionModel.findOneAndDelete(filtro);
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
    const found = await SessionModel.findOne({
      token,
      kind: { $ne: "handoff" },
    });
    if (found && found.expiresAt.getTime() > Date.now())
      (req as any).sessionUser = {
        username: found.username,
        role: found.role,
      };
  } catch {
    /* vedi in testa: un guasto del database non e' un rifiuto */
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
