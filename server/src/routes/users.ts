/**
 * Rotte di account, sessione, acquisti e vendite. Le password diventano record
 * scrypt prima di entrare nel database; l'identita' arriva dal token e soltanto il
 * visitatore compra.
 */
import { Router } from "express";
import {
  createSession,
  destroySession,
  endSession,
  requireSession,
  sessionUser,
  TICKET_TTL_MS,
} from "../session";
import { UserModel } from "../models/user";
import { ItemModel } from "../models/item";
import { centesimi, conto } from "../pricing";
import { VisitModel } from "../models/visit";
import { SEED_AUTHOR } from "../../../shared/constants";
import { SaleRow } from "../../../shared/types";
import { hashPassword, verifyPassword } from "../password";

const router = Router();

function sanitize(u: any) {
  return {
    username: u.username,
    role: u.role,
    wallet: u.wallet,
    collezione: u.collezione,
  };
}

async function withSession(u: any) {
  return { ...sanitize(u), token: await createSession(u) };
}

function isValidRegistrationRole(role: unknown): boolean {
  return role === "autore" || role === "visitatore";
}

// --- Registrazione e accesso ------------------------------------------------

/**
 * POST /api/users/register  { username, password, role }
 * Accetta soltanto i ruoli autore e visitatore; i curatori sono predisposti dal seed.
 * Ritorna: account senza password e token; 409 se l'username e' gia' preso.
 */
router.post("/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (
      typeof username !== "string" ||
      username.trim() === "" ||
      typeof password !== "string" ||
      password === "" ||
      !isValidRegistrationRole(role)
    )
      return res.status(400).json({ error: "Dati di registrazione non validi" });

    if (String(username).trim().toLowerCase() === SEED_AUTHOR.toLowerCase())
      return res
        .status(409)
        .json({ error: `"${SEED_AUTHOR}" è riservato: scegli un altro username.` });

    const already = await UserModel.findOne({ username });
    if (already)
      return res
        .status(409)
        .json({ error: "Questo username è già preso. Scegline un altro." });

    const user = await UserModel.create({
      username,
      password: await hashPassword(password),
      role,
      ...(role === "visitatore" ? { wallet: 100 } : {}),
    });
    res.status(201).json(await withSession(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore in registrazione" });
  }
});

/**
 * POST /api/users/login  { username, password }
 * Ritorna: l'account senza password piu' il `token` di sessione.
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (
      typeof username !== "string" ||
      username.trim() === "" ||
      typeof password !== "string" ||
      password === ""
    )
      return res.status(400).json({ error: "Inserisci username e password" });

    const user = await UserModel.findOne({ username });
    if (!user || !(await verifyPassword(password, user.password)))
      return res.status(401).json({
        error: "Credenziali non valide. Controlla username e password.",
      });
    res.json(await withSession(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore in login" });
  }
});

/**
 * GET /api/users/me
 * Ritorna: l'account corrente, riletto per aggiornare portafoglio e collezione.
 */
router.get("/me", requireSession, async (req, res) => {
  try {
    const who = sessionUser(req);
    const user = await UserModel.findOne({
      username: who.username,
      role: who.role,
    });
    if (!user) return res.status(404).json({ error: "Account non trovato" });
    res.json(sanitize(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nella lettura dell'account" });
  }
});

/**
 * POST /api/users/handoff
 * Ritorna: { handoff }, biglietto breve e monouso per aprire il navigator.
 */
router.post("/handoff", requireSession, async (req, res) => {
  try {
    const who = sessionUser(req);
    res.json({ handoff: await createSession(who, TICKET_TTL_MS, "handoff") });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nel biglietto" });
  }
});

/**
 * POST /api/users/redeem  { handoff }
 * Consuma l'handoff e ritorna account senza password e token del navigator.
 */
router.post("/redeem", async (req, res) => {
  try {
    const who = await destroySession(String(req.body.handoff || ""), "handoff");
    if (!who)
      return res
        .status(404)
        .json({ error: "Biglietto non valido o gia' usato." });

    const user = await UserModel.findOne({
      username: who.username,
      role: who.role,
    });
    if (!user) return res.status(404).json({ error: "Account non trovato" });
    res.json(await withSession(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nel rientro" });
  }
});

/**
 * POST /api/users/logout
 * Chiude la sessione corrente; l'operazione e' idempotente.
 */
router.post("/logout", async (req, res) => {
  try {
    await endSession(req);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nell'uscita" });
  }
});

// --- Acquisto e resoconto vendite -------------------------------------------

/**
 * POST /api/users/buy  { itemId }
 * Ritorna: account con portafoglio e collezione aggiornati; 404 per contenuti
 * inesistenti o non visibili e 400 se il credito non basta.
 */
router.post("/buy", requireSession, async (req, res) => {
  try {
    const who = sessionUser(req);
    const username = who.username;
    const { itemId } = req.body;

    if (who.role !== "visitatore")
      return res.status(403).json({
        error: `Il profilo con cui sei entrato e' un ${who.role}: i contenuti si comprano da un profilo visitatore, che e' l'unico ad avere un portafoglio.`,
      });

    if (typeof itemId !== "string" || itemId.trim() === "")
      return res.status(400).json({ error: "Contenuto non valido" });
    const contentId = itemId.trim();

    const user = await UserModel.findOne({ username, role: "visitatore" });
    if (!user) return res.status(404).json({ error: "Visitatore non trovato" });

    const content: any =
      (await ItemModel.findOne({ "@id": contentId })) ||
      (await VisitModel.findOne({ "@id": contentId }));
    if (!content)
      return res.status(404).json({ error: "Contenuto non trovato" });
    if (
      content.author !== username &&
      (content.visibility === "privato" || Boolean(content.accessKey))
    )
      return res.status(404).json({ error: "Contenuto non trovato" });

    const owned = new Set<string>(user.collezione || []);
    const itemsById = new Map<string, any>();
    if (content && Array.isArray(content.itemListElement)) {
      const tappe = await ItemModel.find({
        "@id": { $in: content.itemListElement },
      });
      for (const t of tappe) itemsById.set(t["@id"], t);
    }

    const { daPrendere, totale: cost } = conto(
      content,
      username,
      owned,
      itemsById,
    );
    if (daPrendere.length === 0) return res.json(sanitize(user));

    let credit = 0;
    if (typeof user.wallet === "number") credit = centesimi(user.wallet);

    if (credit < cost)
      return res.status(400).json({
        error: `Credito insufficiente: servono € ${cost.toFixed(2)}, ne hai € ${credit.toFixed(2)}.`,
      });

    user.wallet = centesimi(credit - cost);
    user.collezione = [...new Set([...user.collezione, ...daPrendere])];
    await user.save();

    res.json(sanitize(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nell'acquisto" });
  }
});

/**
 * GET /api/users/sales
 * Ritorna: una riga per contenuto pubblicato da chi chiede, con adozioni e ricavo.
 */
router.get("/sales", requireSession, async (req, res) => {
  try {
    const username = sessionUser(req).username;

    const items = await ItemModel.find({ author: username }).populate({
      path: "about",
      model: "Artwork",
      foreignField: "@id",
      localField: "about",
      justOne: true,
    });
    const visits = await VisitModel.find({ author: username });

    const rows: SaleRow[] = [];
    for (const it of items) {
      const about: any = it.about;
      let nome = it.subject || "Contenuto";
      if (about && typeof about === "object") nome = about.name;
      rows.push({
        id: it["@id"],
        type: "Item",
        name: nome,
        ofMuseum: it.ofMuseum,
        educationalLevel: it.educationalLevel,
        price: it.price || 0,
        license: it.license || "n/d",
        adozioni: 0,
        ricavo: 0,
      });
    }
    for (const v of visits) {
      rows.push({
        id: v["@id"],
        type: "Visita",
        name: v.name,
        ofMuseum: v.ofMuseum,
        price: v.price || 0,
        license: v.license || "n/d",
        adozioni: 0,
        ricavo: 0,
      });
    }

    const ids = rows.map((r) => r.id);
    const wanted = new Set(ids);
    const holders = await UserModel.find({ collezione: { $in: ids } })
      .select("collezione")
      .lean();

    const adoptions = new Map<string, number>();
    for (const u of holders) {
      for (const id of u.collezione || []) {
        if (!wanted.has(id)) continue;
        adoptions.set(id, (adoptions.get(id) || 0) + 1);
      }
    }
    for (const r of rows) {
      const n = adoptions.get(r.id) || 0;
      r.adozioni = n;
      r.ricavo = n * (r.price || 0);
    }

    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nel calcolo vendite" });
  }
});

export default router;
