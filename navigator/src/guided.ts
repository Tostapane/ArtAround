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
  GuidedEndedError,
} from "./api";

// ============================================================================
// Visita guidata sincronizzata (modulo 18-27, "Fenice rossa"), lato navigator.
//
// Stato singleton (come useTTS/state.ts). Due ruoli, un'unica sessione:
//  - DOCENTE: crea la sala d'attesa, vede i partecipanti, avvia e conduce la
//    visita opera per opera (ogni "Prossimo" spinge lo step a tutti gli studenti);
//  - STUDENTE: si aggancia alla sessione (il join e' gia' avvenuto nel
//    marketplace) e SEGUE: la sua vista salta all'opera scelta dal docente e
//     Non puo' andare avanti/indietro.
//
// Trasporto: polling REST (nessun WebSocket). I contenuti si leggono
// dall'endpoint di sessione (accesso TEMPORANEO): quando la visita finisce
// tutto sparisce e nulla resta nella collezione dell'utente.
// ============================================================================

type Role = "docente" | "studente" | "";
type Stato = "attesa" | "attiva" | "terminata";

export const guidedActive = ref(false);
export const guidedRole = ref<Role>("");
export const guidedSessionId = ref("");
export const guidedUser = ref("");
export const guidedVisitName = ref("");
export const guidedStato = ref<Stato>("attesa");
// indice dell'opera corrente decisa dal docente (-1 = non ancora iniziata)
export const guidedCurrentStep = ref(-1);
// vista docente: elenco dei partecipanti collegati
export const guidedParticipants = ref<{ username: string }[]>([]);
// vista studente: solo il numero dei collegati
export const guidedParticipantsCount = ref(0);
// DOMANDE degli studenti (solo lato DOCENTE): il server ce le consegna una volta
// (le "drena" al polling) e le conserviamo QUI, nel client del docente.
export type GuidedQuestion = {
  username: string;
  question: string;
  artwork: string;
  at: number;
};
export const guidedQuestions = ref<GuidedQuestion[]>([]);

let pollTimer: number | null = null;
// evita di ricaricare piu' volte contenuti + museo della stessa visita
let contentLoaded = false;

// qid del museo dall'@id/URI wikidata (ultimo segmento)
function qidFromUri(uri: string): string {
  const parts = uri.split("/");
  const last = parts[parts.length - 1];
  if (last) return last;
  return "";
}

function applyTeacherView(v: any) {
  guidedSessionId.value = v.id;
  guidedStato.value = v.stato;
  guidedCurrentStep.value = v.currentStep;
  if (v.partecipanti) {
    guidedParticipants.value = v.partecipanti;
    guidedParticipantsCount.value = v.partecipanti.length;
  }
  // consegna-una-volta: accodiamo le nuove domande a quelle gia' conservate
  if (v.nuoveDomande && v.nuoveDomande.length) {
    guidedQuestions.value.push(...v.nuoveDomande);
  }
  if (v.visitName) guidedVisitName.value = v.visitName;
}

function applyStudentState(s: any) {
  guidedStato.value = s.stato;
  guidedCurrentStep.value = s.currentStep;
  guidedParticipantsCount.value = s.partecipanti;
  if (s.visitName) guidedVisitName.value = s.visitName;
}

// Carica UNA volta i contenuti della visita guidata e il suo museo, iniettandoli
// nello stato normale del navigator (setCustomVisit): da qui la visita viene
// "giocata" dal solito MainView. I testi arrivano dall'endpoint di sessione,
// cosi' l'accesso resta legato alla sessione viva (possesso temporaneo).
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
      applyStudentState(await getGuidedStudentState(guidedSessionId.value));
    }
  } catch (err) {
    // sessione finita: usciamo senza traccia. Altri errori (rete): si ritenta.
    if (err instanceof GuidedEndedError) endLocally();
  }
}

// La sessione non c'e' piu': fermiamo il polling e svuotiamo la visita (nessun
// possesso permanente). guidedActive resta true per mostrare la schermata di fine.
function endLocally() {
  stopPolling();
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
  const st = await getGuidedStudentState(sessionId);
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

// --- Azioni STUDENTE ---
export async function studentLeave() {
  try {
    await postGuidedLeave(guidedSessionId.value, guidedUser.value);
  } finally {
    endLocally();
  }
}

// Lo studente ha posto una domanda: la segnaliamo al docente (nome + testo +
// opera). Solo durante una visita guidata attiva; best-effort (non blocca).
export function studentAsk(question: string, artwork: string) {
  if (!guidedActive.value) return;
  if (guidedRole.value !== "studente") return;
  if (guidedStato.value !== "attiva") return;
  postGuidedAsk(guidedSessionId.value, guidedUser.value, question, artwork);
}

// Esce del tutto dalla modalita' guidata (torna al navigator normale).
export function resetGuided() {
  stopPolling();
  guidedActive.value = false;
  guidedRole.value = "";
  guidedSessionId.value = "";
  guidedUser.value = "";
  guidedVisitName.value = "";
  guidedStato.value = "attesa";
  guidedCurrentStep.value = -1;
  guidedParticipants.value = [];
  guidedParticipantsCount.value = 0;
  guidedQuestions.value = [];
  contentLoaded = false;
  clearVisit();
}
