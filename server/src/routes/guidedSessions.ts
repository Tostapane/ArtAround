import { Router } from "express";
import { VisitModel } from "../models/visit";
import { ItemModel } from "../models/item";

/**
 * Sessioni di VISITA GUIDATA sincronizzata (modulo 18-27, "Fenice rossa").
 *
 * Backbone lato server: il navigator (docente e studenti) vi si aggancerà in
 * un secondo momento. Il ciclo di vita è:
 *  - il docente AVVIA una sessione per una sua visita con parola chiave
 *    (stato "attesa": sala d'attesa);
 *  - gli studenti ENTRANO digitando la parola chiave → finiscono nella lista
 *    d'attesa visibile al docente (accesso TEMPORANEO, non persistente);
 *  - il docente fa PARTIRE la visita quando i suoi studenti sono pronti;
 *  - durante la visita il docente avanza opera per opera (STEP): il timestamp
 *    di partenza consente ai dispositivi di far partire l'audio ~insieme;
 *  - il docente TERMINA: la sessione viene distrutta e non resta traccia.
 *
 * Lo stato vive SOLO in memoria (Map): è effimero per costruzione — quando il
 * docente termina o il server riavvia, sparisce (coerente con "nessuna traccia
 * per i visitatori"). Nessuna scrittura su MongoDB.
 *
 * Trasporto: POLLING REST. I client interrogano `GET /:id` (docente) o
 * `GET /:id/state` (studente) a intervalli brevi. Nessun WebSocket/SSE.
 * (Sicurezza non valutata: nessun token di sessione, controlli minimi.)
 */

const router = Router();

interface Partecipante {
  username: string;
  joinedAt: number;
  lastSeen: number; // ultimo "sono qui" (polling dello studente): vedi rimuoviAssenti
}

// Una domanda posta da uno studente durante la visita (monitoraggio docente,
// slide 18-27: "vedere chi si e' collegato e cosa ha chiesto").
interface Domanda {
  username: string; // chi l'ha posta
  question: string; // cosa ha chiesto (es. "Approfondisci", "Chi e' l'autore?")
  artwork: string; // opera a cui si riferiva (nome, se disponibile)
  at: number; // epoch ms
}

interface Sessione {
  id: string;
  visitId: string;
  visitName: string;
  accessKey: string;
  teacher: string;
  stato: "attesa" | "attiva" | "terminata";
  currentStep: number; // indice opera corrente (-1 = non ancora iniziata)
  stepStartAt: number | null; // epoch ms a cui far partire l'audio dello step
  partecipanti: Map<string, Partecipante>;
  // CODA di consegna (non uno storico): le domande poste dagli studenti restano
  // qui solo finche' il docente non fa il polling successivo, poi vengono
  // "drenate" e consegnate al suo client, che le conserva. Il server non tiene
  // l'elenco: lo tiene il client del docente (slide 18-27).
  domandeInSospeso: Domanda[];
  createdAt: number;
}

// Registro effimero: sessionId -> Sessione, e indice accessKey -> sessionId
// (solo per le sessioni vive).
const sessioni = new Map<string, Sessione>();
const perChiave = new Map<string, string>();

// Uno studente e' "presente" finche' continua a fare polling (ogni ~1.5s). Se non
// si fa vivo da piu' di TTL_MS (≈3 poll mancati: tab chiusa, rete caduta), lo si
// considera uscito e lo si toglie dalla lista che il docente vede.
const TTL_MS = 5000;

// Registra il "sono qui" di uno studente: aggiorna lastSeen e lo (re)inserisce se
// era stato rimosso (breve disconnessione). Usata da /join e dal polling /state.
function segnaPresente(s: Sessione, username: string) {
  const ora = Date.now();
  const esistente = s.partecipanti.get(username);
  s.partecipanti.set(username, {
    username,
    joinedAt: esistente ? esistente.joinedAt : ora,
    lastSeen: ora,
  });
}

// Rimuove gli studenti che non si fanno vivi da troppo tempo (usciti/disconnessi).
function rimuoviAssenti(s: Sessione) {
  const ora = Date.now();
  for (const [username, p] of s.partecipanti) {
    if (ora - p.lastSeen > TTL_MS) s.partecipanti.delete(username);
  }
}

// Vista per il DOCENTE: include la lista d'attesa completa e "drena" le domande
// in sospeso (consegna-una-volta): `nuoveDomande` sono le domande arrivate dopo
// l'ultima vista del docente; qui la coda si svuota — a conservarle e' il client.
function vistaDocente(s: Sessione) {
  const nuoveDomande = s.domandeInSospeso;
  s.domandeInSospeso = [];
  return {
    id: s.id,
    visitId: s.visitId,
    visitName: s.visitName,
    accessKey: s.accessKey,
    teacher: s.teacher,
    stato: s.stato,
    currentStep: s.currentStep,
    stepStartAt: s.stepStartAt,
    partecipanti: [...s.partecipanti.values()].map((p) => ({
      username: p.username,
    })),
    nuoveDomande,
  };
}

// Vista per lo STUDENTE: solo ciò che gli serve per sincronizzarsi.
function vistaStudente(s: Sessione) {
  return {
    id: s.id,
    visitId: s.visitId,
    visitName: s.visitName,
    stato: s.stato,
    currentStep: s.currentStep,
    stepStartAt: s.stepStartAt,
    partecipanti: s.partecipanti.size,
  };
}

/**
 * POST /api/guided-sessions  { visitId, teacher }
 * Il docente apre la sala d'attesa per una sua visita guidata.
 */
router.post("/", async (req, res) => {
  try {
    const { visitId, teacher } = req.body;
    if (!visitId || !teacher)
      return res.status(400).json({ error: "visitId e teacher richiesti" });

    const visit = await VisitModel.findOne({ "@id": visitId });
    if (!visit) return res.status(404).json({ error: "Visita non trovata" });
    if (!visit.accessKey)
      return res
        .status(400)
        .json({ error: "Questa visita non è una visita guidata (manca la parola chiave)" });
    if (visit.author !== teacher)
      return res
        .status(403)
        .json({ error: "Solo l'autore della visita può avviarla" });

    // Se esiste già una sessione per questa chiave (es. quella precedente non è
    // stata chiusa correttamente: tab chiusa, niente "Termina"), la si RIAVVIA
    // da capo con una sala d'attesa PULITA. Ogni avvio del docente = nuova
    // visita: così una visita guidata resta sempre riutilizzabile, senza restare
    // "incastrata" nello stato della sessione precedente.
    const esistente = perChiave.get(visit.accessKey);
    if (esistente && sessioni.has(esistente)) {
      const s = sessioni.get(esistente)!;
      s.stato = "attesa";
      s.currentStep = -1;
      s.stepStartAt = null;
      s.teacher = teacher;
      s.partecipanti.clear();
      s.domandeInSospeso = [];
      return res.status(200).json(vistaDocente(s));
    }

    const id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const s: Sessione = {
      id,
      visitId,
      visitName: visit.name || "Visita guidata",
      accessKey: visit.accessKey,
      teacher,
      stato: "attesa",
      currentStep: -1,
      stepStartAt: null,
      partecipanti: new Map(),
      domandeInSospeso: [],
      createdAt: Date.now(),
    };
    sessioni.set(id, s);
    perChiave.set(visit.accessKey, id);
    res.status(201).json(vistaDocente(s));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore avvio sessione" });
  }
});

/**
 * POST /api/guided-sessions/join  { accessKey, username }
 * Lo studente entra nella sala d'attesa digitando la parola chiave.
 */
router.post("/join", (req, res) => {
  const { accessKey, username } = req.body;
  if (!accessKey || !username)
    return res.status(400).json({ error: "accessKey e username richiesti" });

  const id = perChiave.get(String(accessKey).trim());
  const s = id ? sessioni.get(id) : undefined;
  if (!s || s.stato === "terminata")
    return res
      .status(404)
      .json({ error: "Nessuna visita guidata attiva con questa parola chiave" });

  segnaPresente(s, username);
  res.json(vistaStudente(s));
});

/**
 * POST /api/guided-sessions/:id/leave  { username }
 * Lo studente esce dalla sala d'attesa.
 */
router.post("/:id/leave", (req, res) => {
  const s = sessioni.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione non trovata" });
  s.partecipanti.delete(req.body.username);
  res.json({ ok: true });
});

/**
 * POST /api/guided-sessions/:id/ask  { username, question, artwork? }
 * Lo studente ha posto una domanda (la risposta LLM la ottiene per conto suo dal
 * normale endpoint /api/llm): qui inoltriamo SOLO la notifica al docente. La
 * mettiamo in coda; il client del docente la ritira al polling successivo e la
 * conserva. Il server non tiene l'elenco.
 */
router.post("/:id/ask", (req, res) => {
  const s = sessioni.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione non trovata" });
  const { username, question, artwork } = req.body;
  if (!username || !question)
    return res.status(400).json({ error: "username e question richiesti" });
  // solo chi partecipa alla visita (o il docente) puo' inviare domande
  if (username !== s.teacher && !s.partecipanti.has(username))
    return res.status(403).json({ error: "Non partecipi a questa visita guidata" });
  s.domandeInSospeso.push({
    username,
    question: String(question),
    artwork: artwork ? String(artwork) : "",
    at: Date.now(),
  });
  res.json({ ok: true });
});

/**
 * POST /api/guided-sessions/:id/start  { teacher }
 * Il docente dà il via: la visita passa in stato "attiva".
 */
router.post("/:id/start", (req, res) => {
  const s = sessioni.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione non trovata" });
  if (req.body.teacher && req.body.teacher !== s.teacher)
    return res.status(403).json({ error: "Solo il docente può avviare" });
  s.stato = "attiva";
  s.currentStep = 0;
  s.stepStartAt = Date.now();
  res.json(vistaDocente(s));
});

/**
 * POST /api/guided-sessions/:id/step  { index, ritardoMs? }
 * Il docente porta tutti sull'opera `index` e fa partire l'audio. `stepStartAt`
 * è il momento comune di partenza (default: adesso + un piccolo margine), così
 * i dispositivi partono ~insieme nonostante il polling.
 */
router.post("/:id/step", (req, res) => {
  const s = sessioni.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione non trovata" });
  if (req.body.teacher && req.body.teacher !== s.teacher)
    return res.status(403).json({ error: "Solo il docente può avanzare" });
  const index = Number(req.body.index);
  if (!Number.isInteger(index) || index < 0)
    return res.status(400).json({ error: "index non valido" });
  const ritardo = Number(req.body.ritardoMs);
  s.currentStep = index;
  s.stepStartAt = Date.now() + (Number.isFinite(ritardo) ? ritardo : 0);
  res.json(vistaDocente(s));
});

/**
 * POST /api/guided-sessions/:id/end  { teacher }
 * Il docente termina: la sessione viene distrutta (nessuna traccia).
 */
router.post("/:id/end", (req, res) => {
  const s = sessioni.get(req.params.id);
  if (!s) return res.json({ ok: true }); // già terminata
  if (req.body.teacher && req.body.teacher !== s.teacher)
    return res.status(403).json({ error: "Solo il docente può terminare" });
  perChiave.delete(s.accessKey);
  sessioni.delete(s.id);
  res.json({ ok: true });
});

/**
 * GET /api/guided-sessions/:id   → vista DOCENTE (lista d'attesa, stato, step).
 * Polling del docente sulla propria sala.
 */
router.get("/:id", (req, res) => {
  const s = sessioni.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione terminata o inesistente" });
  rimuoviAssenti(s); // il docente vede solo chi e' ancora collegato
  res.json(vistaDocente(s));
});

/**
 * GET /api/guided-sessions/:id/state   → vista STUDENTE (stato, step corrente).
 * Polling dello studente. Se la sessione non c'è più (docente ha terminato),
 * risponde 410 così il client sa che deve uscire senza lasciare traccia.
 */
router.get("/:id/state", (req, res) => {
  const s = sessioni.get(req.params.id);
  if (!s)
    return res.status(410).json({ error: "Visita guidata terminata", stato: "terminata" });
  // Il polling dello studente e' il suo "sono qui": aggiorna prima la sua
  // presenza, poi rimuove gli altri assenti (cosi' non rimuove mai il chiamante).
  const username = String(req.query.username || "");
  if (username) segnaPresente(s, username);
  rimuoviAssenti(s);
  res.json(vistaStudente(s));
});

/**
 * GET /api/guided-sessions/:id/items?username=...
 * Contenuto della visita per un PARTECIPANTE di una sessione viva: è l'accesso
 * TEMPORANEO ai testi (anche degli item privati o a pagamento del docente),
 * valido solo finché la sessione esiste. Ritorna gli item con `about` popolato,
 * ordinati come `itemListElement`.
 */
router.get("/:id/items", async (req, res) => {
  try {
    const s = sessioni.get(req.params.id);
    if (!s)
      return res.status(410).json({ error: "Visita guidata terminata" });
    const username = String(req.query.username || "");
    const autorizzato = username === s.teacher || s.partecipanti.has(username);
    if (!autorizzato)
      return res.status(403).json({ error: "Non partecipi a questa visita guidata" });

    const visit = await VisitModel.findOne({ "@id": s.visitId });
    if (!visit) return res.status(404).json({ error: "Visita non trovata" });

    const ids = visit.itemListElement || [];
    const items = await ItemModel.find({ "@id": { $in: ids } }).populate({
      path: "about",
      model: "Artwork",
      foreignField: "@id",
      localField: "about",
      justOne: true,
    });
    const byId = new Map(items.map((it: any) => [it["@id"], it]));
    const ordered = ids.map((itemId) => byId.get(itemId)).filter(Boolean);
    res.json(ordered);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore caricamento contenuti" });
  }
});

export default router;
