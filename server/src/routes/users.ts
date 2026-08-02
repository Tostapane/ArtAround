/**
 * Rotte degli account.
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
import { randomUUID } from "crypto";
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

/*
  BIGLIETTO DI RIENTRO. Il navigator sta su un'altra origine, quindi tornando al
  marketplace la pagina si ricarica e nessuno si ricorda chi eravamo; e la
  sessione non si conserva, per scelta. Cio' che attraversa e' allora un
  biglietto: si conia QUI DENTRO, al login, che e' l'unico punto in cui la
  password viene davvero verificata — coniarlo altrove vorrebbe dire fabbricarlo
  per un nome qualsiasi. Vale una volta sola e poche ore, sta in memoria e muore
  col processo, come le sale guidate.
*/
const HANDOFF_TTL_MS = 6 * 60 * 60 * 1000;
const handoffs = new Map<
  string,
  { username: string; role: string; expires: number }
>();

function issueHandoff(u: any): string {
  const ticket = randomUUID();
  handoffs.set(ticket, {
    username: u.username,
    role: u.role,
    expires: Date.now() + HANDOFF_TTL_MS,
  });
  return ticket;
}

function withHandoff(u: any) {
  return { ...sanitize(u), handoff: issueHandoff(u) };
}

function isValidRole(role: any): boolean {
  return role === "autore" || role === "visitatore" || role === "curatore";
}

// --- Registrazione e accesso ------------------------------------------------

/**
 * POST /api/users/register  { username, password, role }
 * Ritorna: l'account creato senza password. 409 se la coppia esiste gia'.
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
    res.status(201).json(sanitize(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore in registrazione" });
  }
});

/**
 * POST /api/users/login  { username, password, role? }
 * Ritorna: l'account senza password; 300 { scelta, ruoli } se le stesse
 * credenziali valgono per piu' profili e il ruolo non e' stato dichiarato.
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
      return res.json(withHandoff(user));
    }

    const candidates = (await UserModel.find({ username, password })).filter(
      (u) => isValidRole(u.role),
    );
    if (candidates.length === 0)
      return res.status(401).json({
        error: "Credenziali non valide. Controlla username e password.",
      });
    if (candidates.length === 1) return res.json(withHandoff(candidates[0]));

    res.status(300).json({
      scelta: true,
      ruoli: candidates.map((u) => u.role),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore in login" });
  }
});

/**
 * POST /api/users/redeem  { handoff }
 * Ritorna: l'account senza password. Il biglietto vale UNA volta sola: si
 * cancella prima ancora di guardare se e' scaduto, cosi' non resta in giro.
 */
router.post("/redeem", async (req, res) => {
  try {
    const ticket = String(req.body.handoff || "");
    const entry = handoffs.get(ticket);
    if (!entry)
      return res
        .status(404)
        .json({ error: "Biglietto non valido o gia' usato." });
    handoffs.delete(ticket);
    if (Date.now() > entry.expires)
      return res.status(410).json({ error: "Biglietto scaduto." });

    const user = await UserModel.findOne({
      username: entry.username,
      role: entry.role,
    });
    if (!user) return res.status(404).json({ error: "Account non trovato" });
    res.json(sanitize(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nel rientro" });
  }
});

// --- Acquisto e resoconto vendite -------------------------------------------

/**
 * POST /api/users/:username/buy  { itemId }
 * Ritorna: l'account aggiornato (portafoglio e collezione). 400 se il credito
 * non basta; il prezzo lo legge il server dal contenuto, mai dal client.
 *
 * COMPRARE UNA VISITA COMPRA LE SUE TAPPE: senza le descrizioni non e'
 * percorribile, quindi pagarla e poi vedersi chiedere altri soldi per il suo
 * contenuto e' comprarla due volte. Il conto lo fa `pricing.ts`, che e' lo
 * stesso che `GET /visits` usa per dirlo in anticipo.
 *
 * NON SI COMPRA A RATE: se il credito non basta per il totale non si prende
 * niente. Mezza visita non e' una visita.
 */
router.post("/:username/buy", async (req, res) => {
  try {
    const { username } = req.params;
    const { itemId } = req.body;
    const user = await UserModel.findOne({ username, role: "visitatore" });
    if (!user) {
      // Lo stesso nome puo' esistere con un altro ruolo, ed e' un ALTRO account:
      // il portafoglio sta solo sul visitatore. Dire "visitatore non trovato" a
      // chi e' entrato come autore descrive la query, non quel che gli succede.
      const altro = await UserModel.findOne({ username });
      if (altro) {
        return res.status(404).json({
          error: `Il profilo "${username}" con cui sei entrato e' un ${altro.role}: i contenuti si comprano da un profilo visitatore, che e' l'unico ad avere un portafoglio.`,
        });
      }
      return res.status(404).json({ error: "Visitatore non trovato" });
    }

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
 * GET /api/users/:username/sales
 * Ritorna: una riga per contenuto pubblicato, con adozioni e ricavo.
 *
 * Le adozioni si contano con UNA query e un conteggio in memoria. Una query per
 * riga sarebbe piu' breve da scrivere ma il numero di richieste crescerebbe col
 * catalogo dell'autore, e ognuna sarebbe a sua volta una scansione di `users`.
 */
router.get("/:username/sales", async (req, res) => {
  try {
    const { username } = req.params;

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
      rows.push({
        id: it["@id"],
        type: "Item",
        name: about && typeof about === "object" ? about.name : "Opera",
        ofMuseum: about && typeof about === "object" ? about.ofMuseum : undefined,
        educationalLevel: it.educationalLevel,
        price: it.price || 0,
        license: it.license || "—",
      });
    }
    for (const v of visits) {
      rows.push({
        id: v["@id"],
        type: "Visita",
        name: v.name,
        ofMuseum: v.ofMuseum,
        price: v.price || 0,
        license: v.license || "—",
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
