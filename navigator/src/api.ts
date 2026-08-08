/**
 * Chiamate al server.
 *
 * Nessun indirizzo scritto a mano: la base arriva dal file di configurazione del
 * curatore, o si ricava dall'host da cui e' stata aperta la pagina.
 *
 * CHI CHIEDE NON STA NELL'INDIRIZZO: nessuna funzione qui sotto ha un parametro
 * `user` o `username`. Lo dice il biglietto che `call` attacca a ogni richiesta,
 * e il server lo traduce nell'account, quindi non c'e' nessun punto in cui
 * dimenticarsene, e nessun nome che si possa riscrivere a mano.
 *
 * IL BIGLIETTO ARRIVA DAL MARKETPLACE, una volta sola, nell'indirizzo con cui
 * questa pagina si apre: le due applicazioni stanno su origini diverse e questa
 * non vede la memoria dell'altra. Si spende subito in cambio di una sessione
 * propria, che sta in `sessionStorage`: chiusa la scheda non resta niente.
 * Aprire il navigator da solo non porta da nessuna parte, ed e' voluto: si entra
 * dal marketplace.
 *
 * Le rotte delle visite guidate usano l'interrogazione periodica; `GuidedEndedError`
 * distingue "la sessione non c'e' piu'" da un errore di rete, perche' le due cose
 * vogliono reazioni diverse.
 *
 * Il 401 si gestisce dentro `call` e non nelle chiamate una per una: durante una
 * visita ognuna sta nel suo `catch`, quindi una sessione scaduta arriverebbe a
 * schermo come un guasto diverso a seconda di quale bottone si e' premuto. Si
 * avvisa solo se un biglietto c'era: senza, il 401 e' l'ingresso mancato che
 * `App.vue` racconta gia' da se'.
 *
 * Le due letture della memoria sono avvolte in un `try`: un browser che la nega
 * non deve far cadere il modulo, o l'eccezione arriva mentre `api` si valuta —
 * cioe' prima che esista qualcosa in grado di dirlo — e l'applicazione resta
 * bianca. Senza memoria la sessione dura quanto la pagina, e a rompersi e' solo
 * il ricaricamento.
 */
import type { Artwork, Item, Museum, Visit } from "../../shared/types";
import { apiBase } from "./config";
import { t } from "./i18n";

const base = () => apiBase();

// --- Il biglietto -------------------------------------------------------------

const TOKEN_KEY = "artaround-sessione";
let onExpired: () => void = () => {};

function leggiToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function scriviToken(value: string) {
  token = value;
  try {
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* vedi in testa: senza memoria la sessione dura quanto la pagina */
  }
}

let token = leggiToken();

export function hasSession(): boolean {
  return token !== "";
}

export function onSessionExpired(handler: () => void): void {
  onExpired = handler;
}

export async function redeemHandoff(handoff: string): Promise<void> {
  const res = await fetch(`${base()}/users/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handoff }),
  });
  if (!res.ok) throw new Error(t("Il collegamento non vale più."));
  const data = await res.json();
  scriviToken(data.token || "");
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 && token) {
    scriviToken("");
    onExpired();
  }
  return res;
}

export async function getVisit(id: string): Promise<Visit> {
  const res = await call(`${base()}/visits/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch visit: ${res.statusText}`);
  return res.json();
}

export async function getVisitItems(id: string): Promise<Item[]> {
  const res = await call(`${base()}/visits/${encodeURIComponent(id)}/items`);
  if (!res.ok) throw new Error(`Failed to fetch visit items: ${res.statusText}`);
  return res.json();
}

export async function getArtworkPreview(
  qid: string,
  level: string,
  duration: number,
): Promise<{ artwork: Artwork; item: Item }> {
  const params = new URLSearchParams();
  if (level) params.set("level", level);
  if (duration) params.set("duration", String(duration));
  let url = `${base()}/artworks/${encodeURIComponent(qid)}/preview`;
  const query = params.toString();
  if (query) url += `?${query}`;
  const res = await call(url);
  if (!res.ok)
    throw new Error(`Failed to fetch artwork preview: ${res.statusText}`);
  return res.json();
}

export async function createCustomVisit(
  museumQid: string,
  request: string,
): Promise<{ visit: Visit; content: { artwork: Artwork; item: Item }[] }> {
  const res = await call(`${base()}/visits/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ museumQid, request }),
  });
  if (!res.ok)
    throw new Error(`Failed to create custom visit: ${res.statusText}`);
  return res.json();
}

export async function getVisitsByMuseum(qid: string): Promise<Visit[]> {
  const res = await call(
    `${base()}/museums/${encodeURIComponent(qid)}/visits`,
  );
  if (!res.ok)
    throw new Error(`Failed to fetch museum visits: ${res.statusText}`);
  return res.json();
}

export async function getMuseumArtworks(qid: string): Promise<Artwork[]> {
  const res = await call(
    `${base()}/museums/${encodeURIComponent(qid)}/artworks`,
  );
  if (!res.ok)
    throw new Error(`Failed to fetch museum artworks: ${res.statusText}`);
  return res.json();
}

export async function getMuseum(qid: string): Promise<Museum> {
  const res = await call(`${base()}/museums/${encodeURIComponent(qid)}/config`);
  if (!res.ok)
    throw new Error(`Failed to fetch the desired museum: ${res.statusText}`);
  return res.json();
}

export async function getInfo(
  previous: string,
  userReq: string,
  language: string,
): Promise<string> {
  const res = await call(`${base()}/llm/newInfo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ previous, userReq, language }),
  });
  if (!res.ok)
    throw new Error(`Failed to fetch new description: ${res.statusText}`);
  return res.json();
}

export async function getDirections(
  museumQid: string,
  from: string,
  target: string,
  language: string,
  detailed = false,
): Promise<string> {
  const res = await call(`${base()}/wayfinding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ museumQid, from, target, language, detailed }),
  });
  if (!res.ok) throw new Error(`Failed to fetch directions: ${res.statusText}`);
  const data = await res.json();
  return data.directions;
}

export async function sendAudioToBackend(
  audioBlob: Blob,
  lang: string,
): Promise<any> {
  const formData = new FormData();
  formData.append("audioFile", audioBlob, "recording.wav");
  formData.append("lang", lang);
  const res = await call(`${base()}/speech`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to send Audio");
  return res.json();
}

export async function getSpeechAudio(
  text: string,
  lang: string,
): Promise<Blob> {
  const res = await call(`${base()}/speech/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang }),
  });
  if (!res.ok) throw new Error("Failed to synthesize speech");
  return res.blob();
}

export async function translateTexts(
  texts: string[],
  target: string,
): Promise<string[]> {
  const res = await call(`${base()}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, target }),
  });
  if (!res.ok) throw new Error("Failed to translate text");
  const data = await res.json();
  return data.translations;
}

const gsBase = () => `${base()}/guided-sessions`;

export class GuidedEndedError extends Error {
  constructor() {
    super(t("La visita guidata è terminata."));
    this.name = "GuidedEndedError";
  }
}

async function readGuidedError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data && data.error) return data.error;
  } catch {
    /* risposta non JSON: resta il codice di stato */
  }
  return `Errore ${res.status}`;
}

export async function createGuidedSession(visitId: string): Promise<any> {
  const res = await call(gsBase(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitId }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function getGuidedTeacherView(id: string): Promise<any> {
  const res = await call(`${gsBase()}/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new GuidedEndedError();
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function getGuidedStudentState(id: string): Promise<any> {
  const res = await call(`${gsBase()}/${encodeURIComponent(id)}/state`);
  if (res.status === 410) throw new GuidedEndedError();
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function getGuidedItems(id: string): Promise<Item[]> {
  const res = await call(`${gsBase()}/${encodeURIComponent(id)}/items`);
  if (res.status === 410) throw new GuidedEndedError();
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function postGuidedStart(id: string): Promise<any> {
  const res = await call(`${gsBase()}/${encodeURIComponent(id)}/start`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function postGuidedStep(id: string, index: number): Promise<any> {
  const res = await call(`${gsBase()}/${encodeURIComponent(id)}/step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function postGuidedEnd(id: string): Promise<void> {
  const res = await call(`${gsBase()}/${encodeURIComponent(id)}/end`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
}

export async function postGuidedLeave(id: string): Promise<void> {
  const res = await call(`${gsBase()}/${encodeURIComponent(id)}/leave`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
}

export async function postGuidedQuizStart(
  id: string,
  durationSec: number,
): Promise<any> {
  const res = await call(`${gsBase()}/${encodeURIComponent(id)}/quiz/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ durationSec }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function postGuidedQuizAnswer(
  id: string,
  answers: number[],
): Promise<{ score: number; total: number; giaConsegnato: boolean }> {
  const res = await call(`${gsBase()}/${encodeURIComponent(id)}/quiz/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function postGuidedQuizEnd(id: string): Promise<any> {
  const res = await call(`${gsBase()}/${encodeURIComponent(id)}/quiz/end`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function postGuidedAsk(
  id: string,
  question: string,
  artwork: string,
): Promise<void> {
  try {
    await call(`${gsBase()}/${encodeURIComponent(id)}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, artwork }),
    });
  } catch {
    /* una domanda persa non ferma la visita: non si riprova e non si avvisa */
  }
}
