/**
 * Risolve Authorization in un account e separa osservazione da obbligo di sessione.
 * Gli handoff viaggiano nell'URL una volta, scadono presto e non valgono come
 * normali credenziali API.
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
  } catch {}
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
