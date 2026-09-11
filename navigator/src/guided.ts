/**
 * Stato client delle visite guidate. Il docente aggiorna la propria vista con un
 * polling leggero; lo studente mantiene una richiesta in attesa dei cambiamenti.
 */
import { ref, watch } from "vue";
import type { Visit } from "../../shared/types";
import { buildStops, loadMuseum, setCustomVisit, clearVisit } from "./state";
import {
  getVisit,
  createGuidedSession,
  getGuidedTeacherView,
  getGuidedStudentState,
  waitForGuidedState,
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
import {
  guidedAutoplayEnabled,
  stopGuidedAudio,
} from "./components/visita/guidedAudio";

type Role = "docente" | "studente" | "";
type Stato = "attesa" | "attiva" | "quiz" | "terminata";

export interface GuidedParticipant {
  username: string;
  online: boolean;
  attentive: boolean;
  autoplay: boolean;
  testCompleted: boolean;
}

export interface GuidedQuestion {
  username: string;
  question: string;
  artwork: string;
  at: number;
}

export const guidedActive = ref(false);
export const guidedRole = ref<Role>("");
export const guidedSessionId = ref("");
export const guidedVisitName = ref("");
export const guidedAccessKey = ref("");
export const guidedStato = ref<Stato>("attesa");
export const guidedRevision = ref(0);
export const guidedCurrentStep = ref(-1);
export const guidedPlayAt = ref<number | null>(null);
export const guidedAudioText = ref("");
export const guidedAudioLanguage = ref("it-IT");
export const guidedParticipants = ref<GuidedParticipant[]>([]);
export const guidedParticipantsCount = ref(0);
export const guidedQuestions = ref<GuidedQuestion[]>([]);
export const guidedError = ref("");

export type QuizDocente = {
  total: number;
  startAt: number | null;
  endsAt: number | null;
  closed: boolean;
  risultati: { username: string; consegnato: boolean; score: number }[];
};

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
export const guidedQuizPunteggio = ref<number | null>(null);
export const guidedHasQuiz = ref(false);
export const guidedPlannedEnd = ref(true);

const TEACHER_POLL_MS = 1500;
const RETRY_MIN_MS = 500;
const RETRY_MAX_MS = 5000;

let teacherPollTimer: number | null = null;
let studentWaitController: AbortController | null = null;
let studentWaitGeneration = 0;
let teacherCommandId = 0;
let contentLoaded = false;

function qidFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1] || "";
}

function applyPlayback(view: Record<string, unknown>) {
  const revision = Number(view.revision);
  if (Number.isInteger(revision)) guidedRevision.value = revision;
  const playAt = Number(view.playAt);
  guidedPlayAt.value = Number.isFinite(playAt) && playAt > 0 ? playAt : null;
  guidedAudioText.value =
    typeof view.audioText === "string" ? view.audioText : "";
  guidedAudioLanguage.value =
    typeof view.audioLanguage === "string" ? view.audioLanguage : "it-IT";
}

function applyTeacherView(view: any) {
  guidedSessionId.value = view.id;
  guidedCurrentStep.value = view.currentStep;
  applyPlayback(view);
  if (view.accessKey) guidedAccessKey.value = view.accessKey;
  if (Array.isArray(view.partecipanti)) {
    guidedParticipants.value = view.partecipanti;
    guidedParticipantsCount.value = view.partecipanti.filter(
      (participant: GuidedParticipant) => participant.online,
    ).length;
  }
  if (Array.isArray(view.questions)) guidedQuestions.value = view.questions;
  if (view.visitName) guidedVisitName.value = view.visitName;
  guidedHasQuiz.value = Boolean(view.hasQuiz);
  guidedQuizDocente.value = view.quiz || null;
  applyStato(view.stato);
}

function applyStudentState(state: any) {
  guidedCurrentStep.value = state.currentStep;
  applyPlayback(state);
  guidedParticipantsCount.value = state.partecipanti;
  if (state.visitName) guidedVisitName.value = state.visitName;
  if (state.quiz) {
    guidedQuizStudente.value = state.quiz;
    if (typeof state.quiz.punteggio === "number")
      guidedQuizPunteggio.value = state.quiz.punteggio;
  } else {
    guidedQuizStudente.value = null;
  }
  applyStato(state.stato);
}

function applyStato(stato: Stato) {
  if (stato === "terminata") {
    if (guidedStato.value !== "terminata") endLocally(true);
    return;
  }
  guidedStato.value = stato;
}

async function ensureContent(visitId: string) {
  if (contentLoaded) return;
  const currentVisit: Visit = await getVisit(visitId);
  const items = await getGuidedItems(guidedSessionId.value);
  if (currentVisit.ofMuseum)
    await loadMuseum(qidFromUri(currentVisit.ofMuseum));
  setCustomVisit(currentVisit, buildStops(items));
  guidedVisitName.value = currentVisit.name;
  contentLoaded = true;
}

function studentStatus() {
  return {
    attentive: document.visibilityState === "visible",
    autoplay: guidedAutoplayEnabled.value,
  };
}

function restartStudentWait() {
  if (guidedRole.value === "studente") studentWaitController?.abort();
}

async function waitForStudentChanges(generation: number) {
  let retryMs = RETRY_MIN_MS;
  while (
    generation === studentWaitGeneration &&
    guidedRole.value === "studente" &&
    guidedStato.value !== "terminata"
  ) {
    const controller = new AbortController();
    studentWaitController = controller;
    try {
      const state = await waitForGuidedState(
        guidedSessionId.value,
        guidedRevision.value,
        studentStatus(),
        controller.signal,
      );
      if (generation !== studentWaitGeneration) return;
      if (state) applyStudentState(state);
      retryMs = RETRY_MIN_MS;
    } catch (err) {
      if (generation !== studentWaitGeneration) return;
      if ((err as DOMException)?.name === "AbortError") continue;
      if (err instanceof GuidedEndedError) {
        endLocally(false);
        return;
      }
      await new Promise((resolve) =>
        window.setTimeout(resolve, retryMs + Math.random() * 250),
      );
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    } finally {
      if (studentWaitController === controller) studentWaitController = null;
    }
  }
}

async function pollTeacher() {
  try {
    applyTeacherView(await getGuidedTeacherView(guidedSessionId.value));
  } catch (err) {
    if (err instanceof GuidedEndedError) endLocally(false);
  }
}

function startPolling() {
  stopPolling();
  if (guidedRole.value === "docente") {
    teacherPollTimer = window.setInterval(pollTeacher, TEACHER_POLL_MS);
    return;
  }
  document.addEventListener("visibilitychange", restartStudentWait);
  const generation = studentWaitGeneration;
  void waitForStudentChanges(generation);
}

function stopPolling() {
  if (teacherPollTimer !== null) {
    window.clearInterval(teacherPollTimer);
    teacherPollTimer = null;
  }
  studentWaitGeneration++;
  studentWaitController?.abort();
  studentWaitController = null;
  document.removeEventListener("visibilitychange", restartStudentWait);
}

watch(guidedAutoplayEnabled, restartStudentWait);

function endLocally(planned = true) {
  stopPolling();
  stopGuidedAudio();
  guidedPlannedEnd.value = planned;
  guidedStato.value = "terminata";
  guidedPlayAt.value = null;
  guidedAudioText.value = "";
  clearVisit();
  contentLoaded = false;
}

export async function startAsTeacher(visitId: string) {
  guidedActive.value = true;
  guidedRole.value = "docente";
  guidedError.value = "";
  const view = await createGuidedSession(visitId);
  applyTeacherView(view);
  await ensureContent(visitId);
  startPolling();
}

export async function attachAsStudent(sessionId: string) {
  guidedActive.value = true;
  guidedRole.value = "studente";
  guidedSessionId.value = sessionId;
  const state = await getGuidedStudentState(sessionId);
  applyStudentState(state);
  await ensureContent(state.visitId);
  startPolling();
}

export async function teacherStart() {
  guidedError.value = "";
  try {
    applyTeacherView(await postGuidedStart(guidedSessionId.value));
  } catch (err) {
    guidedError.value = (err as Error).message;
    throw err;
  }
}

export async function teacherGoToStep(index: number): Promise<boolean> {
  const commandId = ++teacherCommandId;
  guidedError.value = "";
  try {
    const view = await postGuidedStep(guidedSessionId.value, index);
    if (commandId !== teacherCommandId) return false;
    applyTeacherView(view);
    return view.currentStep === index;
  } catch (err) {
    if (commandId === teacherCommandId)
      guidedError.value = (err as Error).message;
    return false;
  }
}

export async function teacherEnd() {
  teacherCommandId++;
  try {
    await postGuidedEnd(guidedSessionId.value);
  } finally {
    endLocally();
  }
}

export async function teacherStartQuiz(durationSec: number) {
  teacherCommandId++;
  applyTeacherView(
    await postGuidedQuizStart(guidedSessionId.value, durationSec),
  );
}

export async function teacherEndQuiz() {
  applyTeacherView(await postGuidedQuizEnd(guidedSessionId.value));
}

export async function studentSubmitQuiz(answers: number[]) {
  const result = await postGuidedQuizAnswer(guidedSessionId.value, answers);
  guidedQuizPunteggio.value = result.score;
  const quiz = guidedQuizStudente.value;
  if (quiz) quiz.giaConsegnato = true;
  return result;
}

export async function studentLeave() {
  stopPolling();
  try {
    await postGuidedLeave(guidedSessionId.value);
  } finally {
    endLocally();
  }
}

export function studentAsk(question: string, artwork: string) {
  if (!guidedActive.value) return;
  if (guidedRole.value !== "studente") return;
  if (guidedStato.value !== "attiva") return;
  void postGuidedAsk(guidedSessionId.value, question, artwork);
}

export function resetGuided() {
  stopPolling();
  stopGuidedAudio();
  guidedActive.value = false;
  guidedRole.value = "";
  guidedSessionId.value = "";
  guidedVisitName.value = "";
  guidedAccessKey.value = "";
  guidedStato.value = "attesa";
  guidedRevision.value = 0;
  guidedCurrentStep.value = -1;
  guidedPlayAt.value = null;
  guidedAudioText.value = "";
  guidedAudioLanguage.value = "it-IT";
  guidedParticipants.value = [];
  guidedParticipantsCount.value = 0;
  guidedQuestions.value = [];
  guidedQuizDocente.value = null;
  guidedQuizStudente.value = null;
  guidedQuizPunteggio.value = null;
  guidedHasQuiz.value = false;
  guidedPlannedEnd.value = true;
  guidedError.value = "";
  contentLoaded = false;
  clearVisit();
}
