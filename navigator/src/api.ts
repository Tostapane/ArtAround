/**
 * Chiamate al server.
 *
 * Nessun indirizzo scritto a mano: la base arriva dal file di configurazione del
 * curatore, o si ricava dall'host da cui e' stata aperta la pagina.
 *
 * Le rotte delle visite guidate usano l'interrogazione periodica; `GuidedEndedError`
 * distingue "la sessione non c'e' piu'" da un errore di rete, perche' le due cose
 * vogliono reazioni diverse.
 */
import type { Artwork, Item, Match, Museum, Visit } from "../../shared/types";
import { apiBase } from "./config";

const base = () => apiBase();

export async function getVisit(id: string): Promise<Visit> {
  const res = await fetch(`${base()}/visits/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch visit: ${res.statusText}`);
  return res.json();
}

export async function getVisitItems(id: string): Promise<Item[]> {
  const res = await fetch(`${base()}/visits/${encodeURIComponent(id)}/items`);
  if (!res.ok) throw new Error(`Failed to fetch visit items: ${res.statusText}`);
  return res.json();
}

export async function getArtworkPreview(
  qid: string,
  level: string,
  duration: number,
): Promise<Match> {
  const params = new URLSearchParams();
  if (level) params.set("level", level);
  if (duration) params.set("duration", String(duration));
  let url = `${base()}/artworks/${encodeURIComponent(qid)}/preview`;
  const query = params.toString();
  if (query) url += `?${query}`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to fetch artwork preview: ${res.statusText}`);
  return res.json();
}

export async function createCustomVisit(
  museumQid: string,
  request: string,
): Promise<{ visit: Visit; content: Match[] }> {
  const res = await fetch(`${base()}/visits/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ museumQid, request }),
  });
  if (!res.ok)
    throw new Error(`Failed to create custom visit: ${res.statusText}`);
  return res.json();
}

/**
 * Visite di un museo, filtrate per CHI STA GUARDANDO.
 * Senza `user` il server restituisce solo le visite gratuite (modalita' esempio);
 * con `user` aggiunge quelle che quella persona possiede. Le visite guidate non
 * compaiono mai: ci si entra con la parola chiave, non scegliendole da un elenco.
 */
export async function getVisitsByMuseum(
  qid: string,
  user?: string,
): Promise<Visit[]> {
  let url = `${base()}/museums/${encodeURIComponent(qid)}/visits`;
  if (user) url += `?user=${encodeURIComponent(user)}`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to fetch museum visits: ${res.statusText}`);
  return res.json();
}

/**
 * Tutte le opere del museo, tappe della visita o no. Servono alla
 * localizzazione: le opere fra cui scegliere sono quelle disegnate sulla pianta,
 * e la pianta non sa niente della visita in corso.
 */
export async function getMuseumArtworks(qid: string): Promise<Artwork[]> {
  const res = await fetch(
    `${base()}/museums/${encodeURIComponent(qid)}/artworks`,
  );
  if (!res.ok)
    throw new Error(`Failed to fetch museum artworks: ${res.statusText}`);
  return res.json();
}

export async function getMuseum(qid: string): Promise<Museum> {
  const res = await fetch(`${base()}/museums/${encodeURIComponent(qid)}/config`);
  if (!res.ok)
    throw new Error(`Failed to fetch the desired museum: ${res.statusText}`);
  return res.json();
}

export async function getInfo(
  previous: string,
  userReq: string,
  language: string,
): Promise<string> {
  const res = await fetch(`${base()}/llm/newInfo`, {
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
  const res = await fetch(`${base()}/wayfinding`, {
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
  const res = await fetch(`${base()}/speech`, {
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
  const res = await fetch(`${base()}/speech/tts`, {
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
  const res = await fetch(`${base()}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, target }),
  });
  if (!res.ok) throw new Error("Failed to translate text");
  const data = await res.json();
  return data.translations;
}

const gsBase = () => `${apiBase()}/guided-sessions`;

export class GuidedEndedError extends Error {
  constructor() {
    super("La visita guidata è terminata.");
    this.name = "GuidedEndedError";
  }
}

async function readGuidedError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data && data.error) return data.error;
  } catch {
  }
  return `Errore ${res.status}`;
}

export async function createGuidedSession(
  visitId: string,
  teacher: string,
): Promise<any> {
  const res = await fetch(gsBase(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitId, teacher }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function getGuidedTeacherView(id: string): Promise<any> {
  const res = await fetch(`${gsBase()}/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new GuidedEndedError();
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function getGuidedStudentState(
  id: string,
  username: string,
): Promise<any> {
  const res = await fetch(
    `${gsBase()}/${encodeURIComponent(id)}/state?username=${encodeURIComponent(username)}`,
  );
  if (res.status === 410) throw new GuidedEndedError();
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function getGuidedItems(
  id: string,
  username: string,
): Promise<Item[]> {
  const res = await fetch(
    `${gsBase()}/${encodeURIComponent(id)}/items?username=${encodeURIComponent(username)}`,
  );
  if (res.status === 410) throw new GuidedEndedError();
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function postGuidedStart(
  id: string,
  teacher: string,
): Promise<any> {
  const res = await fetch(`${gsBase()}/${encodeURIComponent(id)}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teacher }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function postGuidedStep(
  id: string,
  teacher: string,
  index: number,
): Promise<any> {
  const res = await fetch(`${gsBase()}/${encodeURIComponent(id)}/step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teacher, index }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function postGuidedEnd(
  id: string,
  teacher: string,
): Promise<void> {
  const res = await fetch(`${gsBase()}/${encodeURIComponent(id)}/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teacher }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
}

export async function postGuidedLeave(
  id: string,
  username: string,
): Promise<void> {
  const res = await fetch(`${gsBase()}/${encodeURIComponent(id)}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
}

/**
 * Quiz di fine visita (modulo 18-27). Le risposte corrette non lasciano mai il
 * server: qui si mandano solo gli indici scelti e si riceve il punteggio.
 */
export async function postGuidedQuizStart(
  id: string,
  teacher: string,
  durationSec: number,
): Promise<any> {
  const res = await fetch(`${gsBase()}/${encodeURIComponent(id)}/quiz/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teacher, durationSec }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function postGuidedQuizAnswer(
  id: string,
  username: string,
  answers: number[],
): Promise<{ score: number; total: number; giaConsegnato: boolean }> {
  const res = await fetch(`${gsBase()}/${encodeURIComponent(id)}/quiz/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, answers }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function postGuidedQuizEnd(
  id: string,
  teacher: string,
): Promise<any> {
  const res = await fetch(`${gsBase()}/${encodeURIComponent(id)}/quiz/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teacher }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

export async function postGuidedAsk(
  id: string,
  username: string,
  question: string,
  artwork: string,
): Promise<void> {
  try {
    await fetch(`${gsBase()}/${encodeURIComponent(id)}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, question, artwork }),
    });
  } catch {
  }
}
