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
import { UserModel } from "../models/user";
import { ItemModel } from "../models/item";
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
      return res.json(sanitize(user));
    }

    const candidates = (await UserModel.find({ username, password })).filter(
      (u) => isValidRole(u.role),
    );
    if (candidates.length === 0)
      return res.status(401).json({
        error: "Credenziali non valide. Controlla username e password.",
      });
    if (candidates.length === 1) return res.json(sanitize(candidates[0]));

    res.status(300).json({
      scelta: true,
      ruoli: candidates.map((u) => u.role),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore in login" });
  }
});

// --- Acquisto e resoconto vendite -------------------------------------------

/**
 * POST /api/users/:username/buy  { itemId }
 * Ritorna: l'account aggiornato (portafoglio e collezione). 400 se il credito
 * non basta; il prezzo lo legge il server dal contenuto, mai dal client.
 */
router.post("/:username/buy", async (req, res) => {
  try {
    const { username } = req.params;
    const { itemId } = req.body;
    const user = await UserModel.findOne({ username, role: "visitatore" });
    if (!user) return res.status(404).json({ error: "Visitatore non trovato" });

    if (user.collezione.includes(itemId)) return res.json(sanitize(user)); 

    const content: any =
      (await ItemModel.findOne({ "@id": itemId })) ||
      (await VisitModel.findOne({ "@id": itemId }));
    const cost = content
      ? Number(content.price) || 0
      : Number(req.body.price) || 0;

    let credit = 0;
    if (typeof user.wallet === "number") credit = user.wallet;

    if (credit < cost)
      return res.status(400).json({
        error: `Credito insufficiente: servono € ${cost.toFixed(2)}, ne hai € ${credit.toFixed(2)}.`,
      });

    user.wallet = credit - cost;
    user.collezione.push(itemId);
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
