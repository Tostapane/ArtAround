/**
 * Rotte degli account.
 *
 * E' qui che nasce la sessione, perche' `login` e `register` sono i due soli
 * punti in cui una password viene verificata: coniarla altrove vorrebbe dire
 * fabbricare un'identita' per un nome qualsiasi. Da qui in poi chi chiede lo
 * dice l'intestazione
 * `Authorization` e mai il percorso; il meccanismo sta in `session.ts`.
 *
 * Il ruolo non si chiede a chi entra: lo deduce il server dalle credenziali, e lo
 * domanda solo nel caso raro in cui le stesse credenziali valgano per piu' profili.
 * In registrazione invece il ruolo fa parte dell'identita' e va dichiarato: lo
 * stesso username puo' essere registrato una volta per ruolo, come account
 * distinti, quindi il conflitto (409) e' sulla coppia (username, role).
 * Il portafoglio nasce solo sul visitatore: autore e curatore non comprano.
 * L'acquisto legge il prezzo dal contenuto sul server, mai dal client.
 * I ricavi non vengono accreditati su un portafoglio: si vedono nel resoconto
 * vendite, perche' account autore e visitatore sono separati.
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
import { conto } from "../pricing";
import { VisitModel } from "../models/visit";

const router = Router();

function sanitize(u: any) {
  return {
    username: u.username,
    role: u.role,
    wallet: u.wallet,
    collezione: u.collezione,
  };
}

/** L'account piu' la stringa con cui d'ora in poi dira' di essere lui. */
async function withSession(u: any) {
  return { ...sanitize(u), token: await createSession(u) };
}

function isValidRole(role: any): boolean {
  return role === "autore" || role === "visitatore" || role === "curatore";
}

// --- Registrazione e accesso ------------------------------------------------

/**
 * POST /api/users/register  { username, password, role }
 * Ritorna: l'account creato senza password, piu' il `token` di sessione. 409 se
 * la coppia esiste gia'.
 */
router.post("/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !isValidRole(role))
      return res.status(400).json({ error: "Dati di registrazione non validi" });

    const already = await UserModel.findOne({ username, role });
    if (already)
      return res
        .status(409)
        .json({ error: `Esiste già un ${role} con questo username` });

    const user = await UserModel.create({
      username,
      password,
      role,
      ...(role === "visitatore" ? { wallet: 100 } : {}),
    });
    res.status(201).json(await withSession(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore in registrazione" });
  }
});

/**
 * POST /api/users/login  { username, password, role? }
 * Ritorna: l'account senza password piu' il `token` di sessione; 300
 * { scelta, ruoli } se le stesse credenziali valgono per piu' profili e il ruolo
 * non e' stato dichiarato.
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Inserisci username e password" });

    if (role) {
      if (!isValidRole(role))
        return res.status(400).json({ error: "Ruolo non valido" });
      const user = await UserModel.findOne({ username, password, role });
      if (!user)
        return res.status(401).json({
          error: "Credenziali non valide. Controlla username e password.",
        });
      return res.json(await withSession(user));
    }

    const candidates = (await UserModel.find({ username, password })).filter(
      (u) => isValidRole(u.role),
    );
    if (candidates.length === 0)
      return res.status(401).json({
        error: "Credenziali non valide. Controlla username e password.",
      });
    if (candidates.length === 1)
      return res.json(await withSession(candidates[0]));

    res.status(300).json({
      scelta: true,
      ruoli: candidates.map((u) => u.role),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore in login" });
  }
});

/**
 * GET /api/users/me
 * Ritorna: l'account di chi ha la sessione. Serve al ricaricamento della pagina:
 * il biglietto sopravvive nella memoria della scheda, il resto no, e portafoglio
 * e collezione vanno riletti com'e' adesso e non com'erano all'accesso.
 */
router.get("/me", requireSession, async (req, res) => {
  const who = sessionUser(req);
  const user = await UserModel.findOne({
    username: who.username,
    role: who.role,
  });
  if (!user) return res.status(404).json({ error: "Account non trovato" });
  res.json(sanitize(user));
});

/**
 * POST /api/users/handoff
 * Ritorna: { handoff }, da mettere nel collegamento al navigator.
 * Se ne conia uno per ogni viaggio, non uno per accesso: un biglietto vale una
 * volta sola, e uno per accesso lascerebbe senza il secondo viaggio.
 * Nasce di tipo `handoff`, quindi si spende qui sotto e non vale come
 * intestazione: viaggia in un indirizzo, e un indirizzo lo leggono in troppi.
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
 * Ritorna: l'account senza password piu' il `token` con cui il navigator parlera'
 * da qui in avanti. Spendere il biglietto lo cancella, quindi un ricaricamento
 * non lo rigioca.
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
 * Chiude la sessione di chi chiama. Idempotente: senza biglietto non c'e' niente
 * da chiudere, e la risposta e' la stessa.
 */
router.post("/logout", async (req, res) => {
  await endSession(req);
  res.json({ ok: true });
});

// --- Acquisto e resoconto vendite -------------------------------------------

/**
 * POST /api/users/buy  { itemId }
 * Ritorna: l'account aggiornato (portafoglio e collezione). 400 se il credito
 * non basta; il prezzo lo legge il server dal contenuto, mai dal client.
 *
 * A comprare e' chi ha la sessione, non un nome nell'indirizzo: quando il nome
 * stava nel percorso, scriverne un altro spendeva il portafoglio di un altro.
 *
 * COMPRARE UNA VISITA COMPRA LE SUE TAPPE: senza le descrizioni non e'
 * percorribile, quindi pagarla e poi vedersi chiedere altri soldi per il suo
 * contenuto e' comprarla due volte. Il conto lo fa `pricing.ts`, che e' lo
 * stesso che `GET /visits` usa per dirlo in anticipo.
 *
 * NON SI COMPRA A RATE: se il credito non basta per il totale non si prende
 * niente. Mezza visita non e' una visita.
 */
router.post("/buy", requireSession, async (req, res) => {
  try {
    const who = sessionUser(req);
    const username = who.username;
    const { itemId } = req.body;

    // Il portafoglio sta solo sul visitatore, e lo stesso nome puo' esistere con
    // un altro ruolo come account distinto. La sessione dice gia' quale dei due
    // e', quindi non serve chiederlo al database per poterlo dire.
    if (who.role !== "visitatore")
      return res.status(403).json({
        error: `Il profilo con cui sei entrato e' un ${who.role}: i contenuti si comprano da un profilo visitatore, che e' l'unico ad avere un portafoglio.`,
      });

    const user = await UserModel.findOne({ username, role: "visitatore" });
    if (!user) return res.status(404).json({ error: "Visitatore non trovato" });

    const content: any =
      (await ItemModel.findOne({ "@id": itemId })) ||
      (await VisitModel.findOne({ "@id": itemId }));

    const owned = new Set<string>(user.collezione || []);
    let itemsById = new Map<string, any>();
    if (content && Array.isArray(content.itemListElement)) {
      const tappe = await ItemModel.find({
        "@id": { $in: content.itemListElement },
      });
      for (const t of tappe) itemsById.set(t["@id"], t);
    }

    const { daPrendere, totale: cost } = conto(
      content || { "@id": itemId, price: 0 },
      username,
      owned,
      itemsById,
    );
    if (daPrendere.length === 0) return res.json(sanitize(user));

    let credit = 0;
    if (typeof user.wallet === "number") credit = user.wallet;

    if (credit < cost)
      return res.status(400).json({
        error: `Credito insufficiente: servono € ${cost.toFixed(2)}, ne hai € ${credit.toFixed(2)}.`,
      });

    user.wallet = credit - cost;
    for (const id of daPrendere) user.collezione.push(id);
    await user.save();

    res.json(sanitize(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nell'acquisto" });
  }
});

/**
 * GET /api/users/sales
 * Ritorna: una riga per contenuto pubblicato da chi chiede, con adozioni e ricavo.
 *
 * Le adozioni si contano con UNA query e un conteggio in memoria. Una query per
 * riga sarebbe piu' breve da scrivere ma il numero di richieste crescerebbe col
 * catalogo dell'autore, e ognuna sarebbe a sua volta una scansione di `users`.
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

    const rows: any[] = [];
    for (const it of items) {
      const about: any = it.about;
      // Il nome della riga e' quello del soggetto: l'opera dove c'e', altrimenti
      // il nome che l'autore ha scritto.
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
