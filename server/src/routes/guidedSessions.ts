/**
 * Sessioni di VISITA GUIDATA sincronizzata (modulo 18-27, "Fenice rossa").
 *
 * Il ciclo di vita:
 *  - il docente AVVIA una sessione per una sua visita con parola chiave
 *    (stato "attesa": sala d'attesa);
 *  - gli studenti ENTRANO digitando la parola chiave → finiscono nella lista
 *    d'attesa visibile al docente (accesso TEMPORANEO, non persistente);
 *  - il docente fa PARTIRE la visita quando i suoi studenti sono pronti;
 *  - durante la visita il docente avanza opera per opera (STEP): il timestamp
 *    di partenza consente ai dispositivi di far partire l'audio ~insieme;
 *  - il docente TERMINA: la sessione resta qualche secondo in "terminata", cosi'
 *    una chiusura VOLUTA non arriva ai client come un guasto, poi sparisce.
 *
 * Lo stato vive SOLO in memoria (Map): e' effimero per costruzione — quando il
 * docente termina o il server riavvia, non resta traccia, che e' esattamente
 * quel che chiede la specifica. Nessuna scrittura su MongoDB.
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
  lastSeen: number; 
}

interface StudentQuestion {
  username: string; 
  question: string; 
  artwork: string; 
  at: number; 
}

interface RuntimeQuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

interface Session {
  id: string;
  visitId: string;
  visitName: string;
  /** La visita ha un quiz preparato dall'autore: solo un sì o un no. */
  hasQuiz: boolean;
  accessKey: string;
  museum: string; 
  teacher: string;
  stato: "attesa" | "attiva" | "quiz" | "terminata";
  currentStep: number; 
  stepStartAt: number | null; 
  partecipanti: Map<string, Participant>;
  pendingQuestions: StudentQuestion[];
  // --- Quiz di fine visita (fase "quiz"), tutto effimero ---
  quizQuestions: RuntimeQuizQuestion[] | null; 
  quizStartAt: number | null; 
  quizEndsAt: number | null; 
  quizClosed: boolean; 
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
    if (Number(answers?.[i]) === qs[i].correct) score++;
  }
  return score;
}

const sessions = new Map<string, Session>();
const byAccessKey = new Map<string, string>();

const TTL_MS = 5000;

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
    if (now - p.lastSeen > TTL_MS) s.partecipanti.delete(username);
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
          risultati: [...s.partecipanti.keys()].map((username) => ({
            username,
            consegnato: s.quizAnswers.has(username),
            score: s.quizAnswers.get(username)?.score ?? 0,
          })),
        }
      : null,
  };
}

function studentView(s: Session, username?: string) {
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
          giaConsegnato: username ? s.quizAnswers.has(username) : false,
          punteggio: username
            ? s.quizAnswers.get(username)?.score ?? null
            : null,
        }
      : null,
  };
}

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

router.post("/:id/leave", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione non trovata" });
  s.partecipanti.delete(sessionUser(req).username);
  res.json({ ok: true });
});

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
 * la si cancellasse subito, ogni client riceverebbe un 410 — cioe' "la sessione
 * e' sparita sotto i piedi" — e una chiusura VOLUTA dal docente verrebbe
 * annunciata a tutti come un guasto.
 */
const CODA_CHIUSURA_MS = 30000;

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

router.get("/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione terminata o inesistente" });
  dropAbsent(s); 
  res.json(teacherView(s));
});

router.get("/:id/state", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s)
    return res.status(410).json({ error: "Visita guidata terminata", stato: "terminata" });
  const username = sessionUser(req).username;
  markPresent(s, username);
  dropAbsent(s);
  res.json(studentView(s, username));
});

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
