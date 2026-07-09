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

// True se il ruolo passato dal client è uno dei due ammessi.
function ruoloValido(role: any): boolean {
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
    if (!username || !password || !ruoloValido(role))
      return res.status(400).json({ error: "Dati di registrazione non validi" });

    const esiste = await UserModel.findOne({ username, role });
    if (esiste)
      return res
        .status(409)
        .json({ error: `Esiste già un ${role} con questo username` });

    // Il wallet è solo da visitatore (budget iniziale 100); l'autore non ne ha.
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
 * POST /api/users/login  { username, password, role }
 * Verifica le credenziali per lo specifico account (username + password +
 * ruolo scelto al login) e lo restituisce. Un account autore e uno visitatore
 * con lo stesso username sono distinti: si accede a quello del ruolo indicato.
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!ruoloValido(role))
      return res.status(400).json({ error: "Ruolo non valido" });
    const user = await UserModel.findOne({ username, password, role });
    if (!user)
      return res.status(401).json({ error: "Credenziali non valide" });
    res.json(sanitize(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore in login" });
  }
});

/**
 * POST /api/users/:username/buy  { itemId }
 * Acquisto persistente: scala il wallet del compratore e aggiunge l'item alla
 * sua collezione. I ricavi dell'autore NON vengono accreditati su un wallet
 * (li mostra il report vendite/adozioni): account autore e visitatore sono
 * separati, nessun portafoglio condiviso. Solo i VISITATORI acquistano.
 */
router.post("/:username/buy", async (req, res) => {
  try {
    const { username } = req.params;
    const { itemId } = req.body;
    const user = await UserModel.findOne({ username, role: "visitatore" });
    if (!user) return res.status(404).json({ error: "Visitatore non trovato" });

    if (user.collezione.includes(itemId)) return res.json(sanitize(user)); // gia' posseduto

    // Prezzo autoritativo dal contenuto (Item oppure Visit), non dal client.
    const contenuto: any =
      (await ItemModel.findOne({ "@id": itemId })) ||
      (await VisitModel.findOne({ "@id": itemId }));
    const costo = contenuto
      ? Number(contenuto.price) || 0
      : Number(req.body.price) || 0;

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
