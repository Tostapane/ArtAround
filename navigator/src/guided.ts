/**
 * Visita guidata sincronizzata, lato navigator.
 *
 * Stato unico condiviso, due ruoli. Il DOCENTE apre la sala, vede chi e'
 * collegato e conduce: ogni avanzamento spinge la tappa a tutti. Lo STUDENTE
 * segue, puo' chiedere approfondimenti ma non spostarsi.
 *
 * I contenuti si leggono dalla rotta di sessione, non dal catalogo: il possesso e'
 * temporaneo e finisce con la visita.
 *
 * `guidedPlannedEnd` distingue una chiusura voluta dal docente da una sessione
 * sparita sotto i piedi: riusare la stessa schermata per entrambe e' il modo in
 * cui un guasto diventa invisibile.
 */
import { ref } from "vue";
import type { Artwork, Match, Visit } from "../../shared/types";
import { loadMuseum, setCustomVisit, clearVisit } from "./state";
import {
  getVisit,
  createGuidedSession,
  getGuidedTeacherView,
  getGuidedStudentState,
  getGuidedItems,
  postGuidedStart,
  postGuidedStep,
  postGuidedEnd,
  postGuidedLeave,
  postGuidedAsk,
  postGuidedQuizStart,
  postGuidedQuizAnswer,
  postGuidedQuizEnd,
  GuidedEndedError,
} from "./api";

type Role = "docente" | "studente" | "";
type Stato = "attesa" | "attiva" | "quiz" | "terminata";

export const guidedActive = ref(false);
export const guidedRole = ref<Role>("");
export const guidedSessionId = ref("");
export const guidedUser = ref("");
export const guidedVisitName = ref("");
export const guidedAccessKey = ref("");
export const guidedStato = ref<Stato>("attesa");
export const guidedCurrentStep = ref(-1);
export const guidedParticipants = ref<{ username: string }[]>([]);
export const guidedParticipantsCount = ref(0);
export type GuidedQuestion = {
  username: string;
  question: string;
  artwork: string;
  at: number;
};
export const guidedQuestions = ref<GuidedQuestion[]>([]);

// --- Quiz di fine visita ----------------------------------------------------

/** Come il docente vede il quiz: quanti hanno consegnato e con che punteggio. */
export type QuizDocente = {
  total: number;
  startAt: number | null;
  endsAt: number | null;
  closed: boolean;
  risultati: { username: string; consegnato: boolean; score: number }[];
};

/** Come lo studente vede il quiz: le domande SENZA la risposta corretta. */
export type QuizStudente = {
  total: number;
  endsAt: number | null;
  closed: boolean;
  domande: { question: string; options: string[] }[];
  giaConsegnato: boolean;
  punteggio: number | null;
};

export const guidedQuizDocente = ref<QuizDocente | null>(null);
export const guidedQuizStudente = ref<QuizStudente | null>(null);
/** Il voto appena ricevuto dal server: il client non corregge nulla da solo. */
export const guidedQuizPunteggio = ref<number | null>(null);
/** La visita ha un quiz preparato dall'autore? Lo sa solo il docente. */
export const guidedHasQuiz = ref(false);

let pollTimer: number | null = null;
let contentLoaded = false;

function qidFromUri(uri: string): string {
  const parts = uri.split("/");
  const last = parts[parts.length - 1];
  if (last) return last;
  return "";
}

function applyTeacherView(v: any) {
  guidedSessionId.value = v.id;
  guidedCurrentStep.value = v.currentStep;
  if (v.accessKey) guidedAccessKey.value = v.accessKey;
  if (v.partecipanti) {
    guidedParticipants.value = v.partecipanti;
    guidedParticipantsCount.value = v.partecipanti.length;
  }
  if (v.nuoveDomande && v.nuoveDomande.length) {
    guidedQuestions.value.push(...v.nuoveDomande);
  }
  if (v.visitName) guidedVisitName.value = v.visitName;
  guidedHasQuiz.value = !!v.hasQuiz;
  if (v.quiz) guidedQuizDocente.value = v.quiz;
  else guidedQuizDocente.value = null;
  applyStato(v.stato);
}

function applyStudentState(s: any) {
  guidedCurrentStep.value = s.currentStep;
  guidedParticipantsCount.value = s.partecipanti;
  if (s.visitName) guidedVisitName.value = s.visitName;
  if (s.quiz) {
    guidedQuizStudente.value = s.quiz;
    if (typeof s.quiz.punteggio === "number")
      guidedQuizPunteggio.value = s.quiz.punteggio;
  } else {
    guidedQuizStudente.value = null;
  }
  applyStato(s.stato);
}

/**
 * Il server tiene la sessione ancora un momento dopo il "Termina", con stato
 * "terminata", proprio perche' i client possano leggerlo: e' una chiusura
 * VOLUTA, non la sessione sparita sotto i piedi.
 */
function applyStato(stato: Stato) {
  if (stato === "terminata") {
    if (guidedStato.value !== "terminata") endLocally(true);
    return;
  }
  guidedStato.value = stato;
}

async function ensureContent(visitId: string) {
  if (contentLoaded) return;
  const v: Visit = await getVisit(visitId);
  const items = await getGuidedItems(guidedSessionId.value, guidedUser.value);
  const content: Match[] = [];
  for (const it of items) {
    if (it.about && typeof it.about === "object") {
      content.push({ artwork: it.about as Artwork, item: it });
    }
  }
  if (v.ofMuseum) await loadMuseum(qidFromUri(v.ofMuseum));
  setCustomVisit(v, content);
  guidedVisitName.value = v.name;
  contentLoaded = true;
}

function startPolling() {
  stopPolling();
  pollTimer = window.setInterval(pollOnce, 1500);
}

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollOnce() {
  try {
    if (guidedRole.value === "docente") {
      applyTeacherView(await getGuidedTeacherView(guidedSessionId.value));
    } else {
      applyStudentState(
        await getGuidedStudentState(guidedSessionId.value, guidedUser.value),
      );
    }
  } catch (err) {
    if (err instanceof GuidedEndedError) endLocally(false);
  }
}

/**
 * La visita e' finita in modo ATTESO (il docente ha premuto Termina, o lo
 * studente e' uscito) oppure la sessione e' semplicemente sparita sotto i piedi
 * (server riavviato, rete caduta). Sono due cose diverse e vanno dette in modo
 * diverso: riusare "terminata" per "non sappiamo cos'e' successo" e' il modo in
 * cui un guasto diventa invisibile.
 */
export const guidedPlannedEnd = ref(true);

function endLocally(prevista = true) {
  stopPolling();
  guidedPlannedEnd.value = prevista;
  guidedStato.value = "terminata";
  clearVisit();
  contentLoaded = false;
}

// --- Ingresso DOCENTE: crea/riusa la sessione e avvia il polling della sala ---
export async function startAsTeacher(visitId: string, user: string) {
  guidedActive.value = true;
  guidedRole.value = "docente";
  guidedUser.value = user;
  const view = await createGuidedSession(visitId, user);
  applyTeacherView(view);
  await ensureContent(visitId);
  startPolling();
}

// --- Ingresso STUDENTE: si aggancia alla sessione gia' raggiunta (marketplace) ---
export async function attachAsStudent(sessionId: string, user: string) {
  guidedActive.value = true;
  guidedRole.value = "studente";
  guidedSessionId.value = sessionId;
  guidedUser.value = user;
  const st = await getGuidedStudentState(sessionId, user);
  applyStudentState(st);
  await ensureContent(st.visitId);
  startPolling();
}

// --- Azioni DOCENTE ---
export async function teacherStart() {
  applyTeacherView(
    await postGuidedStart(guidedSessionId.value, guidedUser.value),
  );
}

export async function teacherGoToStep(index: number) {
  applyTeacherView(
    await postGuidedStep(guidedSessionId.value, guidedUser.value, index),
  );
}

export async function teacherEnd() {
  try {
    await postGuidedEnd(guidedSessionId.value, guidedUser.value);
  } finally {
    endLocally();
  }
}

export async function teacherStartQuiz(durationSec: number) {
  applyTeacherView(
    await postGuidedQuizStart(
      guidedSessionId.value,
      guidedUser.value,
      durationSec,
    ),
  );
}

export async function teacherEndQuiz() {
  applyTeacherView(
    await postGuidedQuizEnd(guidedSessionId.value, guidedUser.value),
  );
}

// --- Azioni STUDENTE ---
export async function studentSubmitQuiz(answers: number[]) {
  const esito = await postGuidedQuizAnswer(
    guidedSessionId.value,
    guidedUser.value,
    answers,
  );
  guidedQuizPunteggio.value = esito.score;
  const q = guidedQuizStudente.value;
  if (q) q.giaConsegnato = true;
  return esito;
}

export async function studentLeave() {
  try {
    await postGuidedLeave(guidedSessionId.value, guidedUser.value);
  } finally {
    endLocally();
  }
}

export function studentAsk(question: string, artwork: string) {
  if (!guidedActive.value) return;
  if (guidedRole.value !== "studente") return;
  if (guidedStato.value !== "attiva") return;
  postGuidedAsk(guidedSessionId.value, guidedUser.value, question, artwork);
}

export function resetGuided() {
  stopPolling();
  guidedActive.value = false;
  guidedRole.value = "";
  guidedSessionId.value = "";
  guidedUser.value = "";
  guidedVisitName.value = "";
  guidedAccessKey.value = "";
  guidedStato.value = "attesa";
  guidedCurrentStep.value = -1;
  guidedParticipants.value = [];
  guidedParticipantsCount.value = 0;
  guidedQuestions.value = [];
  guidedQuizDocente.value = null;
  guidedQuizStudente.value = null;
  guidedQuizPunteggio.value = null;
  guidedHasQuiz.value = false;
  guidedPlannedEnd.value = true;
  contentLoaded = false;
  clearVisit();
}
