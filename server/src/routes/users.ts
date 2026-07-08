import { Router } from "express";
import { UserModel } from "../models/user";
import { ItemModel } from "../models/item";
import { VisitModel } from "../models/visit";

const router = Router();

// Rimuove la password dal documento prima di restituirlo al client.
function sanitize(u: any) {
  return {
    username: u.username,
    wallet: u.wallet,
    collezione: u.collezione,
  };
}

/**
 * POST /api/users/register  { username, password }
 * Crea un nuovo utente e lo restituisce (senza password). L'account è unico:
 * potrà poi operare sia da autore sia da visitatore (scelta nell'interfaccia).
 */
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Dati di registrazione non validi" });

    const esiste = await UserModel.findOne({ username });
    if (esiste)
      return res.status(409).json({ error: "Username gia' registrato" });

    const user = await UserModel.create({ username, password });
    res.status(201).json(sanitize(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore in registrazione" });
  }
});

/**
 * POST /api/users/login  { username, password }
 * Verifica le credenziali (username + password) e restituisce l'utente
 * (wallet e collezione inclusi). Nessun ruolo: l'account è unico.
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await UserModel.findOne({ username, password });
    if (!user)
      return res.status(401).json({ error: "Credenziali non valide" });
    res.json(sanitize(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore in login" });
  }
});

/**
 * POST /api/users/:username/buy  { itemId }
 * Acquisto persistente: scala il wallet del compratore, aggiunge l'item alla
 * sua collezione e ACCREDITA il wallet dell'autore che ha pubblicato il
 * contenuto. Prezzo e autore vengono ricavati dal documento (fonte di verità
 * server-side), non dal client.
 */
router.post("/:username/buy", async (req, res) => {
  try {
    const { username } = req.params;
    const { itemId } = req.body;
    const user = await UserModel.findOne({ username });
    if (!user) return res.status(404).json({ error: "Utente non trovato" });

    if (user.collezione.includes(itemId)) return res.json(sanitize(user)); // gia' posseduto

    // Prezzo e autore autoritativi dal contenuto (Item oppure Visit).
    const contenuto: any =
      (await ItemModel.findOne({ "@id": itemId })) ||
      (await VisitModel.findOne({ "@id": itemId }));
    const costo = contenuto
      ? Number(contenuto.price) || 0
      : Number(req.body.price) || 0;
    const autore: string | undefined = contenuto ? contenuto.author : undefined;

    // Un utente non "compra" i propri contenuti: sono già suoi per il fatto di
    // averli creati. Nessun addebito, nessuna modifica (possesso implicito).
    if (autore && autore === username) return res.json(sanitize(user));

    if (user.wallet < costo)
      return res.status(400).json({ error: "Budget insufficiente" });

    user.wallet -= costo;
    user.collezione.push(itemId);
    await user.save();

    // Accredita il venditore: solo se è un utente reale, diverso dal compratore
    // e il contenuto è a pagamento (i contenuti gratis o dei tour di sistema/AI
    // non generano ricavo su un account).
    if (costo > 0 && autore && autore !== username) {
      await UserModel.updateOne(
        { username: autore },
        { $inc: { wallet: costo } },
      );
    }

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
