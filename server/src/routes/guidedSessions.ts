/**
 * Sessioni effimere delle visite sincronizzate. Il long polling consegna i cambi
 * di stato, mentre una vista periodica informa il docente su studenti e domande.
 */
import { Router, type Response } from "express";
import { sessionUser } from "../session";
import { VisitModel } from "../models/visit";
import { ItemModel } from "../models/item";
import { synthesizeSpeech } from "../services/tts";

const router = Router();

interface Participant {
  username: string;
  joinedAt: number;
  lastSeen: number;
  attentive: boolean;
  autoplay: boolean;
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
  hasQuiz: boolean;
  accessKey: string;
  museum: string;
  teacher: string;
  stato: "attesa" | "attiva" | "quiz" | "terminata";
  itemIds: string[];
  revision: number;
  commandId: number;
  currentStep: number;
  playAt: number | null;
  audioText: string;
  audioLanguage: string;
  partecipanti: Map<string, Participant>;
  questions: StudentQuestion[];
  waiters: Set<() => void>;
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
    if (Number(answers[i]) === qs[i].correct) score++;
  }
  return score;
}

const sessions = new Map<string, Session>();
const byAccessKey = new Map<string, string>();

function durationFromEnv(
  name: string,
  fallback: number,
  minimum = 0,
): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum ? value : fallback;
}

const LONG_POLL_MS = durationFromEnv("GUIDED_LONG_POLL_MS", 10_000, 1000);
const AUDIO_LEAD_MS = durationFromEnv("GUIDED_AUDIO_LEAD_MS", 3_000);
const OFFLINE_GRACE_MS = durationFromEnv("GUIDED_OFFLINE_GRACE_MS", 3_000);
const PRESENCE_TTL_MS = LONG_POLL_MS + OFFLINE_GRACE_MS;
const DEFAULT_GUIDED_AUDIO_LANGUAGE = "it-IT";

function markPresent(
  s: Session,
  username: string,
  status?: { attentive: boolean; autoplay: boolean },
) {
  const now = Date.now();
  const existing = s.partecipanti.get(username);
  s.partecipanti.set(username, {
    username,
    joinedAt: existing ? existing.joinedAt : now,
    lastSeen: now,
    attentive: status ? status.attentive : existing?.attentive || false,
    autoplay: status ? status.autoplay : existing?.autoplay || false,
  });
}

function isOnline(participant: Participant, now = Date.now()): boolean {
  return (
    participant.lastSeen > 0 &&
    now - participant.lastSeen <= PRESENCE_TTL_MS
  );
}

function onlineCount(s: Session): number {
  const now = Date.now();
  let count = 0;
  for (const participant of s.partecipanti.values()) {
    if (isOnline(participant, now)) count++;
  }
  return count;
}

function publish(s: Session): void {
  s.revision++;
  for (const wake of [...s.waiters]) wake();
}

function teacherView(s: Session) {
  const now = Date.now();
  return {
    id: s.id,
    visitId: s.visitId,
    visitName: s.visitName,
    hasQuiz: s.hasQuiz,
    accessKey: s.accessKey,
    teacher: s.teacher,
    stato: s.stato,
    revision: s.revision,
    currentStep: s.currentStep,
    playAt: s.playAt,
    audioText: s.audioText,
    audioLanguage: s.audioLanguage,
    partecipanti: [...s.partecipanti.values()].map((participant) => {
      const online = isOnline(participant, now);
      return {
        username: participant.username,
        online,
        attentive: online && participant.attentive,
        autoplay: participant.autoplay,
        testCompleted: s.quizAnswers.has(participant.username),
      };
    }),
    questions: s.questions,
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
    revision: s.revision,
    currentStep: s.currentStep,
    playAt: s.playAt,
    audioText: s.audioText,
    audioLanguage: s.audioLanguage,
    partecipanti: onlineCount(s),
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
 * Ritorna: la vista docente e apre o azzera la sala d'attesa. Solo l'autore della visita.
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
      s.itemIds = [...(visit.itemListElement || [])];
      s.commandId++;
      s.currentStep = -1;
      s.playAt = null;
      s.audioText = "";
      s.audioLanguage = DEFAULT_GUIDED_AUDIO_LANGUAGE;
      s.teacher = teacher;
      s.museum = visit.ofMuseum || "";
      s.partecipanti.clear();
      s.questions = [];
      s.quizQuestions = null;
      s.quizStartAt = null;
      s.quizEndsAt = null;
      s.quizClosed = false;
      s.quizAnswers.clear();
      publish(s);
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
      itemIds: [...(visit.itemListElement || [])],
      revision: 0,
      commandId: 0,
      currentStep: -1,
      playAt: null,
      audioText: "",
      audioLanguage: DEFAULT_GUIDED_AUDIO_LANGUAGE,
      partecipanti: new Map(),
      questions: [],
      waiters: new Set(),
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
 * Ritorna: la vista studente e registra la presenza. 409 se sala o museo non coincidono; 404 se la
 * parola non esiste.
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
  const participant = s.partecipanti.get(sessionUser(req).username);
  if (participant) {
    participant.lastSeen = 0;
    participant.attentive = false;
  }
  res.json({ ok: true });
});

/**
 * POST /api/guided-sessions/:id/ask  { question, artwork }
 * Accoda la domanda per il docente. Solo docente e partecipanti.
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
  s.questions.push({
    username,
    question: String(question),
    artwork: artwork ? String(artwork) : "",
    at: Date.now(),
  });
  res.json({ ok: true });
});

async function prepareAudio(s: Session, index: number) {
  const itemId = s.itemIds[index];
  if (!itemId) throw new Error("Tappa non trovata");
  const item = await ItemModel.findOne({ "@id": itemId }).select("text").lean();
  const text = String(item?.text || "").trim();
  if (!text) throw new Error("La tappa non contiene una descrizione audio");
  await synthesizeSpeech(text, DEFAULT_GUIDED_AUDIO_LANGUAGE);
  return { text, language: DEFAULT_GUIDED_AUDIO_LANGUAGE };
}

async function moveToStep(s: Session, index: number): Promise<boolean> {
  const commandId = ++s.commandId;
  const audio = await prepareAudio(s, index);
  if (commandId !== s.commandId) return false;
  s.stato = "attiva";
  s.currentStep = index;
  s.playAt = Date.now() + AUDIO_LEAD_MS;
  s.audioText = audio.text;
  s.audioLanguage = audio.language;
  publish(s);
  return true;
}

function sendAudioPreparationError(res: Response, err: unknown): void {
  console.error("Guided audio preparation failed", err);
  res.status(502).json({ error: "Preparazione audio non riuscita" });
}

/**
 * POST /api/guided-sessions/:id/start
 * Fa partire la visita dalla prima tappa. Solo il docente.
 */
router.post("/:id/start", async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione non trovata" });
  if (sessionUser(req).username !== s.teacher)
    return res.status(403).json({ error: "Solo il docente può avviare" });
  try {
    await moveToStep(s, 0);
    res.json(teacherView(s));
  } catch (err: unknown) {
    sendAudioPreparationError(res, err);
  }
});

/**
 * POST /api/guided-sessions/:id/step  { index }
 * Prepara l'audio, poi porta tutti su `index`. Solo il docente.
 */
router.post("/:id/step", async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione non trovata" });
  if (sessionUser(req).username !== s.teacher)
    return res.status(403).json({ error: "Solo il docente può avanzare" });
  const index = Number(req.body.index);
  if (!Number.isInteger(index) || index < 0 || index >= s.itemIds.length)
    return res.status(400).json({ error: "index non valido" });
  try {
    await moveToStep(s, index);
    res.json(teacherView(s));
  } catch (err: unknown) {
    sendAudioPreparationError(res, err);
  }
});

/**
 * POST /api/guided-sessions/:id/quiz/start  { durationSec }
 * Avvia il quiz per 5-3600 secondi, 60 se omesso. Solo il docente; 400 se il quiz manca.
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
  s.commandId++;
  s.stato = "quiz";
  s.playAt = null;
  s.audioText = "";
  s.quizStartAt = Date.now() + RITARDO_MS;
  s.quizEndsAt = s.quizStartAt + durationSec * 1000;
  publish(s);
  res.json(teacherView(s));
});

/**
 * POST /api/guided-sessions/:id/quiz/answer  { answers }
 * Ritorna: { score, total, giaConsegnato }; corregge sul server una sola consegna.
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
  publish(s);
  res.json(teacherView(s));
});

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
  s.commandId++;
  s.stato = "terminata";
  s.playAt = null;
  s.audioText = "";
  publish(s);
  byAccessKey.delete(s.accessKey);
  const t = setTimeout(() => sessions.delete(s.id), CODA_CHIUSURA_MS);
  if (typeof t.unref === "function") t.unref();
  res.json({ ok: true });
});

/**
 * GET /api/guided-sessions/:id
 * Ritorna la vista docente senza consumare la cronologia delle domande.
 */
router.get("/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sessione terminata o inesistente" });
  if (sessionUser(req).username !== s.teacher)
    return res.status(403).json({ error: "Solo il docente può vedere la sessione" });
  res.json(teacherView(s));
});

/**
 * GET /api/guided-sessions/:id/state
 * Ritorna: la vista studente e rinnova la presenza; 410 se la sessione e' terminata.
 */
router.get("/:id/state", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s)
    return res.status(410).json({ error: "Visita guidata terminata", stato: "terminata" });
  const username = sessionUser(req).username;
  if (!s.partecipanti.has(username))
    return res.status(403).json({ error: "Non partecipi a questa visita guidata" });
  markPresent(s, username);
  res.json(studentView(s, username));
});

/**
 * POST /api/guided-sessions/:id/wait
 * Mantiene una sola richiesta studente in attesa finche' cambia la revisione.
 */
router.post("/:id/wait", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s)
    return res.status(410).json({ error: "Visita guidata terminata", stato: "terminata" });

  const username = sessionUser(req).username;
  if (!s.partecipanti.has(username))
    return res.status(403).json({ error: "Non partecipi a questa visita guidata" });
  markPresent(s, username, {
    attentive: req.body.attentive === true,
    autoplay: req.body.autoplay === true,
  });

  const knownRevision = Number(req.body.knownRevision);
  if (!Number.isInteger(knownRevision) || knownRevision !== s.revision)
    return res.json(studentView(s, username));

  let settled = false;
  let timer: NodeJS.Timeout;

  const cleanup = () => {
    clearTimeout(timer);
    s.waiters.delete(wake);
    res.off("close", disconnected);
  };
  const wake = () => {
    if (settled) return;
    settled = true;
    cleanup();
    res.json(studentView(s, username));
  };
  const disconnected = () => {
    if (settled) return;
    settled = true;
    cleanup();
  };

  timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    cleanup();
    res.status(204).end();
  }, LONG_POLL_MS);
  if (typeof timer.unref === "function") timer.unref();
  s.waiters.add(wake);
  res.on("close", disconnected);
});

/**
 * GET /api/guided-sessions/:id/items
 * Ritorna: le tappe ordinate con l'opera popolata. Solo docente e partecipanti.
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
