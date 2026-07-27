/**
 * Rotte degli account.
 *
 * Il ruolo non si chiede a chi entra: lo deduce il server dalle credenziali, e lo
 * domanda solo nel caso raro in cui le stesse credenziali valgano per due profili.
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
  return role === "autore" || role === "visitatore";
}

/**
 * POST /api/users/register  { username, password, role }
 * Crea un nuovo account con un ruolo (autore o visitatore) e lo restituisce
 * (senza password). Il ruolo fa parte dell'identità: lo stesso username può
 * essere registrato una volta come autore e una come visitatore (account
 * distinti). Il conflitto è quindi sulla coppia (username, role).
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

    for (const r of rows) {
      const adozioni = await UserModel.countDocuments({ collezione: r.id });
      r.adozioni = adozioni;
      r.ricavo = adozioni * (r.price || 0);
    }

    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nel calcolo vendite" });
  }
});

export default router;
