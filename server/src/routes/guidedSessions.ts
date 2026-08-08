/**
 * Sessioni di VISITA GUIDATA sincronizzata (modulo 18-27, "Fenice rossa").
 *
 * Il ciclo di vita:
 *  - il docente avvia una sessione per una sua visita con parola chiave
 *    (stato "attesa": sala d'attesa);
 *  - gli studenti entrano digitando la parola chiave e finiscono nella lista
 *    d'attesa visibile al docente (accesso temporaneo, non persistente);
 *  - il docente fa partire la visita quando i suoi studenti sono pronti;
 *  - durante la visita il docente avanza opera per opera: il timestamp
 *    di partenza consente ai dispositivi di far partire l'audio ~insieme;
 *  - il docente termina: la sessione resta qualche secondo in "terminata", cosi'
 *    una chiusura VOLUTA non arriva ai client come un guasto, poi sparisce.
 *
 * Lo stato vive solo in memoria, dentro una Map: e' effimero per costruzione,
 * quindi quando il docente termina o il server riavvia non ne resta traccia, che
 * e' quel che chiede la specifica. Su MongoDB non si scrive niente.
 *
 * Trasporto: POLLING REST. I client interrogano `GET /:id` (docente) o
 * `GET /:id/state` (studente) a intervalli brevi. Nessun WebSocket/SSE.
 * (Sicurezza non valutata: nessun token di sessione, controlli minimi.)
 *
 * Tre meccanismi meritano una nota:
 * - la presenza degli studenti si deduce dall'interrogazione stessa, che vale come
 *   "sono ancora qui"; chi non si fa vivo entro il tempo limite sparisce dalla lista
 *   del docente;
 * - le domande sono una coda di consegna, non uno storico: il docente le ritira e
 *   poi le conserva il suo client. Il server non tiene l'elenco;
 * - la correzione del quiz e' sempre lato server: le risposte corrette non lasciano
 *   mai questa macchina.
 */
import { Router } from "express";
import { sessionUser } from "../session";
import { VisitModel } from "../models/visit";
import { ItemModel } from "../models/item";

const router = Router();

interface Participant {
  username: string;
  joinedAt: number;
  lastSeen: number; // l'ultima interrogazione: e' da qui che si deduce la presenza
}

interface StudentQuestion {
  username: string;
  question: string;
  artwork: string; // il qid dell'opera davanti a cui e' stata posta; vuoto se non c'era
  at: number;
}

interface RuntimeQuizQuestion {
  question: string;
  options: string[];
  correct: number; // non lascia mai il server: la correzione si fa qui
}

interface Session {
  id: string;
  visitId: string;
  visitName: string;
  hasQuiz: boolean; // la visita ha un quiz preparato dall'autore: solo un si' o un no
  accessKey: string;
  museum: string; // l'uri del museo, per rifiutare chi digita la parola giusta nel museo sbagliato
  teacher: string;
  stato: "attesa" | "attiva" | "quiz" | "terminata";
  currentStep: number; // la tappa corrente; -1 finche' il docente non fa partire
  stepStartAt: number | null; // quando far partire l'audio, cosi' i dispositivi vanno insieme
  partecipanti: Map<string, Participant>;
  pendingQuestions: StudentQuestion[]; // coda di consegna, non storico: il docente le ritira
  quizQuestions: RuntimeQuizQuestion[] | null; // copiate dalla visita all'avvio del quiz
  quizStartAt: number | null;
  quizEndsAt: number | null;
  quizClosed: boolean; // chiuso a mano dal docente, prima della scadenza
  quizAnswers: Map<string, { answers: number[]; score: number }>;
  createdAt: number;
}

function quizClosedNow(s: Session): boolean {
  return (
    s.quizClosed || (s.quizEndsAt != null && Date.now() >= s.quizEndsAt)
  );
}

function gradeQuiz(s: Session, answers: number[]): number {
  const qs = s.quizQuestions || [];
  let score = 0;
  for (let i = 0; i < qs.length; i++) {
    if (Number(answers[i]) === qs[i].correct) score++;
  }
  return score;
}

const sessions = new Map<string, Session>();
const byAccessKey = new Map<string, string>();

const PRESENZA_TTL_MS = 5000; // senza un'interrogazione entro questo tempo, lo studente sparisce

function markPresent(s: Session, username: string) {
  const now = Date.now();
  const existing = s.partecipanti.get(username);
  s.partecipanti.set(username, {
    username,
    joinedAt: existing ? existing.joinedAt : now,
    lastSeen: now,
  });
}

function dropAbsent(s: Session) {
  const now = Date.now();
  for (const [username, p] of s.partecipanti) {
    if (now - p.lastSeen > PRESENZA_TTL_MS) s.partecipanti.delete(username);
  }
}

function teacherView(s: Session) {
  const nuoveDomande = s.pendingQuestions;
  s.pendingQuestions = [];
  return {
    id: s.id,
    visitId: s.visitId,
    visitName: s.visitName,
    hasQuiz: s.hasQuiz,
    accessKey: s.accessKey,
    teacher: s.teacher,
    stato: s.stato,
    currentStep: s.currentStep,
    stepStartAt: s.stepStartAt,
    partecipanti: [...s.partecipanti.values()].map((p) => ({
      username: p.username,
    })),
    nuoveDomande,
    quiz: s.quizQuestions
      ? {
          total: s.quizQuestions.length,
          startAt: s.quizStartAt,
          endsAt: s.quizEndsAt,
          closed: quizClosedNow(s),
          risultati: [...s.partecipanti.keys()].map((username) => {
            const consegna = s.quizAnswers.get(username);
            let score = 0;
            if (consegna) score = consegna.score;
            return { username, consegnato: Boolean(consegna), score };
          }),
        }
      : null,
  };
}

function studentView(s: Session, username?: string) {
  let giaConsegnato = false;
  let punteggio: number | null = null;
  if (username) {
    const consegna = s.quizAnswers.get(username);
    if (consegna) {
      giaConsegnato = true;
      punteggio = consegna.score;
    }
  }
  return {
    id: s.id,
    visitId: s.visitId,
    visitName: s.visitName,
    stato: s.stato,
    currentStep: s.currentStep,
    stepStartAt: s.stepStartAt,
    partecipanti: s.partecipanti.size,
    quiz: s.quizQuestions
      ? {
          total: s.quizQuestions.length,
          endsAt: s.quizEndsAt,
          closed: quizClosedNow(s),
          domande: s.quizQuestions.map((q) => ({
            question: q.question,
            options: q.options,
          })),
          giaConsegnato,
          punteggio,
        }
      : null,
  };
}

/**
 * POST /api/guided-sessions  { visitId }
 * Ritorna: la vista del docente. Apre la sala d'attesa per una visita con parola
 * chiave; se ce n'era gia' una su quella parola la azzera invece di aprirne una
 * seconda. Solo l'autore della visita.
 */
router.post("/", async (req, res) => {
  try {
    const { visitId } = req.body;
    const teacher = sessionUser(req).username;
    if (!visitId)
      return res.status(400).json({ error: "visitId richiesto" });

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

    const hasQuiz = Array.isArray(visit.quiz) && visit.quiz.length > 0;

    const existing = byAccessKey.get(visit.accessKey);
    if (existing && sessions.has(existing)) {
      const s = sessions.get(existing)!;
      s.hasQuiz = hasQuiz;
      s.stato = "attesa";
      s.currentStep = -1;
      s.stepStartAt = null;
      s.teacher = teacher;
      s.museum = visit.ofMuseum || "";
      s.partecipanti.clear();
      s.pendingQuestions = [];
      s.quizQuestions = null;
      s.quizStartAt = null;
      s.quizEndsAt = null;
      s.quizClosed = false;
      s.quizAnswers.clear();
      return res.status(200).json(teacherView(s));
    }

    const id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const s: Session = {
      id,
      visitId,
      visitName: visit.name || "Visita guidata",
      hasQuiz,
      accessKey: visit.accessKey,
      museum: visit.ofMuseum || "",
      teacher,
      stato: "attesa",
      currentStep: -1,
      stepStartAt: null,
      partecipanti: new Map(),
      pendingQuestions: [],
      quizQuestions: null,
      quizStartAt: null,
      quizEndsAt: null,
      quizClosed: false,
      quizAnswers: new Map(),
      createdAt: Date.now(),
    };
    sessions.set(id, s);
    byAccessKey.set(visit.accessKey, id);
    res.status(201).json(teacherView(s));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore avvio sessione" });
  }
});

/**
 * POST /api/guided-sessions/join  { accessKey, museum }
 * Ritorna: la vista dello studente, che da questo momento risulta presente.
 * 409 se la visita esiste ma il docente non ha ancora aperto la sala, o se la
 * parola chiave e' di un altro museo; 404 se non esiste affatto.
 */
router.post("/join", async (req, res) => {
  const { accessKey, museum } = req.body;
  const username = sessionUser(req).username;
  if (!accessKey)
    return res.status(400).json({ error: "accessKey richiesta" });

  const key = String(accessKey).trim();
  const id = byAccessKey.get(key);
  const s = id ? sessions.get(id) : undefined;

  if (s && s.stato !== "terminata" && museum && s.museum && s.museum !== museum)
    return res.status(409).json({
      error: "Questa visita guidata non esiste nel museo selezionato.",
    });

  if (!s || s.stato === "terminata") {
    const visitExists = await VisitModel.exists({ accessKey: key });
    if (visitExists)
      return res.status(409).json({
        error:
          "Il docente non ha ancora avviato la sala d'attesa. Riprova appena la visita è aperta.",
      });
    return res
      .status(404)
      .json({ error: "Nessuna visita guidata attiva con questa parola chiave" });
  }

  markPresent(s, username);
  res.json(studentView(s, username));
});

/**
 * POST /api/guided-sessions/:id/leave
 * Toglie chi chiama dalla lista dei presenti.
 */
router.post("/:id/leave", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione non trovata" });
  s.partecipanti.delete(sessionUser(req).username);
  res.json({ ok: true });
});

/**
 * POST /api/guided-sessions/:id/ask  { question, artwork }
 * Mette la domanda nella coda che il docente ritira alla prossima interrogazione.
 * Solo docente e partecipanti.
 */
router.post("/:id/ask", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione non trovata" });
  const { question, artwork } = req.body;
  const username = sessionUser(req).username;
  if (!question)
    return res.status(400).json({ error: "question richiesta" });
  if (username !== s.teacher && !s.partecipanti.has(username))
    return res.status(403).json({ error: "Non partecipi a questa visita guidata" });
  s.pendingQuestions.push({
    username,
    question: String(question),
    artwork: artwork ? String(artwork) : "",
    at: Date.now(),
  });
  res.json({ ok: true });
});

/**
 * POST /api/guided-sessions/:id/start
 * Fa partire la visita dalla prima tappa. Solo il docente.
 */
router.post("/:id/start", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione non trovata" });
  if (sessionUser(req).username !== s.teacher)
    return res.status(403).json({ error: "Solo il docente può avviare" });
  s.stato = "attiva";
  s.currentStep = 0;
  s.stepStartAt = Date.now();
  res.json(teacherView(s));
});

/**
 * POST /api/guided-sessions/:id/step  { index, ritardoMs }
 * Porta tutti sulla tappa `index`. `ritardoMs` sposta in avanti l'istante di
 * partenza, cosi' i dispositivi fanno partire l'audio insieme. Solo il docente.
 */
router.post("/:id/step", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione non trovata" });
  if (sessionUser(req).username !== s.teacher)
    return res.status(403).json({ error: "Solo il docente può avanzare" });
  const index = Number(req.body.index);
  if (!Number.isInteger(index) || index < 0)
    return res.status(400).json({ error: "index non valido" });
  const delay = Number(req.body.ritardoMs);
  s.currentStep = index;
  s.stepStartAt = Date.now() + (Number.isFinite(delay) ? delay : 0);
  res.json(teacherView(s));
});

/**
 * POST /api/guided-sessions/:id/quiz/start  { durationSec }
 * Copia il quiz della visita nella sessione e apre la fase a tempo (5-3600 s,
 * 60 s se non detto). Solo il docente; 400 se la visita non ha un quiz.
 */
router.post("/:id/quiz/start", async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione non trovata" });
  if (sessionUser(req).username !== s.teacher)
    return res.status(403).json({ error: "Solo il docente può avviare il quiz" });

  const visit = await VisitModel.findOne({ "@id": s.visitId });
  const quiz = (visit?.quiz as any[]) || [];
  if (!Array.isArray(quiz) || quiz.length === 0)
    return res.status(400).json({ error: "Questa visita non ha un quiz" });

  const durationSec = Math.max(
    5,
    Math.min(3600, Number(req.body.durationSec) || 60),
  );
  const RITARDO_MS = 500;
  s.quizQuestions = quiz.map((q) => ({
    question: String(q.question),
    options: (q.options || []).map((o: any) => String(o)),
    correct: Number(q.correct),
  }));
  s.quizAnswers.clear();
  s.quizClosed = false;
  s.stato = "quiz";
  s.quizStartAt = Date.now() + RITARDO_MS;
  s.quizEndsAt = s.quizStartAt + durationSec * 1000;
  res.json(teacherView(s));
});

/**
 * POST /api/guided-sessions/:id/quiz/answer  { answers }
 * Ritorna: { score, total, giaConsegnato }. Si consegna una volta sola, e la
 * correzione avviene qui: le risposte giuste non lasciano mai il server.
 */
router.post("/:id/quiz/answer", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione non trovata" });
  if (s.stato !== "quiz" || !s.quizQuestions)
    return res.status(409).json({ error: "Il quiz non è in corso" });
  const username = sessionUser(req).username;
  if (!s.partecipanti.has(username))
    return res.status(403).json({ error: "Non partecipi a questa visita guidata" });
  if (quizClosedNow(s))
    return res.status(409).json({ error: "Tempo scaduto: quiz chiuso" });

  const total = s.quizQuestions.length;
  const existing = s.quizAnswers.get(username);
  if (existing)
    return res.json({ score: existing.score, total, giaConsegnato: true });

  const answers = Array.isArray(req.body.answers)
    ? req.body.answers.map((n: any) => Number(n))
    : [];
  const score = gradeQuiz(s, answers);
  s.quizAnswers.set(username, { answers, score });
  res.json({ score, total, giaConsegnato: false });
});

/**
 * POST /api/guided-sessions/:id/quiz/end
 * Chiude il quiz prima della scadenza. Solo il docente.
 */
router.post("/:id/quiz/end", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione non trovata" });
  if (sessionUser(req).username !== s.teacher)
    return res.status(403).json({ error: "Solo il docente può terminare il quiz" });
  s.quizClosed = true;
  res.json(teacherView(s));
});

/**
 * La sessione non sparisce di colpo: resta per una breve coda con stato
 * "terminata", il tempo che l'ultima interrogazione degli studenti la legga. Se
 * la si cancellasse subito ogni client riceverebbe un 410, cioe' "la sessione e'
 * sparita sotto i piedi", e una chiusura voluta dal docente arriverebbe a tutti
 * come un guasto.
 */
const CODA_CHIUSURA_MS = 30000;

/**
 * POST /api/guided-sessions/:id/end
 * Termina la visita. Solo il docente.
 */
router.post("/:id/end", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.json({ ok: true });
  if (sessionUser(req).username !== s.teacher)
    return res.status(403).json({ error: "Solo il docente può terminare" });
  s.stato = "terminata";
  byAccessKey.delete(s.accessKey);
  const t = setTimeout(() => sessions.delete(s.id), CODA_CHIUSURA_MS);
  if (typeof t.unref === "function") t.unref();
  res.json({ ok: true });
});

/**
 * GET /api/guided-sessions/:id
 * Ritorna: la vista del docente, e SVUOTA la coda delle domande. E' anche il
 * battito che fa sparire dalla lista chi non si e' piu' fatto vivo.
 */
router.get("/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione terminata o inesistente" });
  dropAbsent(s);
  res.json(teacherView(s));
});

/**
 * GET /api/guided-sessions/:id/state
 * Ritorna: la vista dello studente, e vale come "sono ancora qui". 410 quando la
 * sessione non c'e' piu', che il client distingue da un guasto.
 */
router.get("/:id/state", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s)
    return res.status(410).json({ error: "Visita guidata terminata", stato: "terminata" });
  const username = sessionUser(req).username;
  markPresent(s, username);
  dropAbsent(s);
  res.json(studentView(s, username));
});

/**
 * GET /api/guided-sessions/:id/items
 * Ritorna: le tappe della visita nell'ordine del percorso, con l'opera popolata.
 * Solo docente e partecipanti.
 */
router.get("/:id/items", async (req, res) => {
  try {
    const s = sessions.get(req.params.id);
    if (!s)
      return res.status(410).json({ error: "Visita guidata terminata" });
    const username = sessionUser(req).username;
    const allowed = username === s.teacher || s.partecipanti.has(username);
    if (!allowed)
      return res.status(403).json({ error: "Non partecipi a questa visita guidata" });

    const visit = await VisitModel.findOne({ "@id": s.visitId });
    if (!visit) return res.status(404).json({ error: "Visita non trovata" });

    const ids = visit.itemListElement || [];
    const items = await ItemModel.find({ "@id": { $in: ids } })
      .populate({
        path: "about",
        model: "Artwork",
        foreignField: "@id",
        localField: "about",
        justOne: true,
      })
      .lean();
    const byId = new Map(items.map((it: any) => [it["@id"], it]));
    const ordered = ids.map((itemId) => byId.get(itemId)).filter(Boolean);
    res.json(ordered);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Errore caricamento contenuti" });
  }
});

export default router;
