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
 * POST /api/users/login  { username, password, role? }
 *
 * Il RUOLO NON SI CHIEDE all'utente: "sei un autore o un visitatore?" e' una
 * domanda sul nostro modello dati, posta prima che la persona abbia modo di
 * rispondere. Lo risolve il server dalle credenziali:
 *   - un solo account corrisponde  -> si entra, e il ruolo torna nella risposta;
 *   - nessuno                      -> 401;
 *   - due (stesso username E stessa password, creati apposta uno per ruolo)
 *                                  -> 300 con l'elenco, e SOLO allora il client
 *                                     chiede quale profilo aprire.
 * Il modello dati non cambia: l'identita' resta la coppia (username, role).
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Inserisci username e password" });

    // Secondo passo: il client ha gia' scelto il profilo fra quelli proposti.
    if (role) {
      if (!ruoloValido(role))
        return res.status(400).json({ error: "Ruolo non valido" });
      const user = await UserModel.findOne({ username, password, role });
      if (!user)
        return res.status(401).json({
          error: "Credenziali non valide. Controlla username e password.",
        });
      return res.json(sanitize(user));
    }

    // Solo account con un ruolo VALIDO: nel database possono esserci documenti
    // senza ruolo, rimasti dal vecchio modello "account unico". Prima non
    // potevano entrare (il login esigeva la corrispondenza del ruolo); ora che
    // il ruolo lo deduciamo noi, entrerebbero con role=undefined e si
    // troverebbero davanti un'interfaccia vuota — né autore né visitatore.
    const candidati = (await UserModel.find({ username, password })).filter(
      (u) => ruoloValido(u.role),
    );
    if (candidati.length === 0)
      return res.status(401).json({
        error: "Credenziali non valide. Controlla username e password.",
      });
    if (candidati.length === 1) return res.json(sanitize(candidati[0]));

    res.status(300).json({
      scelta: true,
      ruoli: candidati.map((u) => u.role),
    });
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

    // Il wallet esiste solo sui visitatori e lo schema non gli dà un default:
    // un documento vecchio potrebbe non averlo. Si tratta come credito zero.
    let credito = 0;
    if (typeof user.wallet === "number") credito = user.wallet;

    if (credito < costo)
      return res.status(400).json({
        error: `Credito insufficiente: servono € ${costo.toFixed(2)}, ne hai € ${credito.toFixed(2)}.`,
      });

    user.wallet = credito - costo;
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
