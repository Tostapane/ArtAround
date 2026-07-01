import { Router } from "express";
import { UserModel } from "../models/user";
import { ItemModel } from "../models/item";
import { VisitModel } from "../models/visit";

const router = Router();

// Rimuove la password dal documento prima di restituirlo al client.
function sanitize(u: any) {
  return {
    username: u.username,
    role: u.role,
    wallet: u.wallet,
    collezione: u.collezione,
  };
}

/**
 * POST /api/users/register  { username, password, role }
 * Crea un nuovo utente e lo restituisce (senza password).
 */
router.post("/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || (role !== "autore" && role !== "visitatore"))
      return res.status(400).json({ error: "Dati di registrazione non validi" });

    const esiste = await UserModel.findOne({ username });
    if (esiste)
      return res.status(409).json({ error: "Username gia' registrato" });

    const user = await UserModel.create({ username, password, role });
    res.status(201).json(sanitize(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore in registrazione" });
  }
});

/**
 * POST /api/users/login  { username, password, role }
 * Verifica le credenziali (username + password + ruolo del portale) e
 * restituisce l'utente (wallet e collezione inclusi).
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const user = await UserModel.findOne({ username, password, role });
    if (!user)
      return res.status(401).json({ error: "Credenziali non valide" });
    res.json(sanitize(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore in login" });
  }
});

/**
 * POST /api/users/:username/buy  { itemId, price }
 * Acquisto persistente: scala il wallet e aggiunge l'item alla collezione.
 * Il controllo del budget e' fatto lato server (fonte di verita').
 */
router.post("/:username/buy", async (req, res) => {
  try {
    const { username } = req.params;
    const { itemId, price } = req.body;
    const user = await UserModel.findOne({ username });
    if (!user) return res.status(404).json({ error: "Utente non trovato" });

    if (user.collezione.includes(itemId)) return res.json(sanitize(user)); // gia' posseduto

    const costo = Number(price) || 0;
    if (user.wallet < costo)
      return res.status(400).json({ error: "Budget insufficiente" });

    user.wallet -= costo;
    user.collezione.push(itemId);
    await user.save();
    res.json(sanitize(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore nell'acquisto" });
  }
});

/**
 * GET /api/users/:username/sales
 * "Gestione delle adozioni e delle vendite": per ogni contenuto pubblicato
 * dall'autore restituisce licenza, prezzo, numero di adozioni (utenti che lo
 * hanno in collezione) e ricavo (adozioni × prezzo). Le adozioni sono derivate
 * da User.collezione (unica fonte di verita', nessun dato duplicato).
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

    // Adozioni per ciascun contenuto (conteggio utenti che lo possiedono)
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
