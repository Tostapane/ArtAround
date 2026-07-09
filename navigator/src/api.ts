import type { Item, Match, Museum, Visit } from "../../shared/types";

const API_BASE = "http://localhost:8000/api";

// ============================================================================
//                                 Visits
// ============================================================================

// ritorna una singola visita (usata dal deep link ?visit=<id> dal marketplace)
export async function getVisit(id: string): Promise<Visit> {
  const res = await fetch(`${API_BASE}/visits/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch visit: ${res.statusText}`);
  return res.json();
}

// ritorna gli item della visita, gia' uniti al rispettivo artwork (`about` popolato)
export async function getVisitItems(id: string): Promise<Item[]> {
  const res = await fetch(`${API_BASE}/visits/${encodeURIComponent(id)}/items`);
  if (!res.ok) throw new Error(`Failed to fetch visit items: ${res.statusText}`);
  return res.json();
}

// ritorna il Match { artwork, item } di una singola opera anche se NON fa parte
// della visita corrente (usato dallo scanner QR). `level` e `duration` (secondi)
// selezionano l'item giusto; se l'opera non ha item, il server lo genera per
// quel livello e quella durata.
export async function getArtworkPreview(
  qid: string,
  level: string,
  duration: number,
): Promise<Match> {
  const params = new URLSearchParams();
  if (level) params.set("level", level);
  if (duration) params.set("duration", String(duration));
  let url = `${API_BASE}/artworks/${encodeURIComponent(qid)}/preview`;
  const query = params.toString();
  if (query) url += `?${query}`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to fetch artwork preview: ${res.statusText}`);
  return res.json();
}

// crea una visita SU MISURA dai vincoli espressi in linguaggio naturale.
// La visita NON viene persistita: il server risponde con la visita e il suo
// contenuto ({ artwork, item } gia' uniti), che vivono solo nel client.
export async function createCustomVisit(
  museumQid: string,
  request: string,
): Promise<{ visit: Visit; content: Match[] }> {
  const res = await fetch(`${API_BASE}/visits/custom`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ museumQid, request }),
  });
  if (!res.ok)
    throw new Error(`Failed to create custom visit: ${res.statusText}`);
  return res.json();
}

// ritorna tutte le visite di uno specifico museo
export async function getVisitsByMuseum(qid: string): Promise<Visit[]> {
  const res = await fetch(
    `${API_BASE}/museums/${encodeURIComponent(qid)}/visits`,
  );
  if (!res.ok)
    throw new Error(`Failed to fetch museum visits: ${res.statusText}`);
  return res.json();
}

// ============================================================================
//                                 Museum
// ============================================================================

// ritorna uno specifico museo in base al suo qid, letto dal suo FILE DI
// CONFIGURAZIONE sul server (server/src/data/museums/<nome>.json): e' il file
// che il curatore modifica per adattare il navigator al proprio museo.
export async function getMuseum(qid: string): Promise<Museum> {
  const res = await fetch(
    `${API_BASE}/museums/${encodeURIComponent(qid)}/config`,
  );
  if (!res.ok)
    throw new Error(`Failed to fetch the desired museum: ${res.statusText}`);
  return res.json();
}

// ============================================================================
//                                   LLM
// ============================================================================

// ritorna una nuova descrizione a partire da quella attuale, secondo la richiesta userReq.
// `language` e' il nome della lingua in cui l'LLM deve rispondere (es. "English").
export async function getInfo(
  previous: string,
  userReq: string,
  language: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/llm/newInfo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ previous, userReq, language }),
  });
  if (!res.ok)
    throw new Error(`Failed to fetch new description: ${res.statusText}`);
  return res.json();
}

// ============================================================================
//                                 Wayfinding
// ============================================================================

// ritorna le indicazioni logistiche dalla posizione `from` (qid dell'opera
// corrente) verso `target`: un tipo di POI ("toilet"|"exit"|"bar"|"shop"|...),
// "obstacles", o il qid di un'altra opera.
// Con `detailed=false` (default) ritorna la risposta SEMPLICE: solo la zona
// (nome della sala dall'SVG, es. "Ala Nord"). Con `detailed=true` ritorna il
// percorso passo-passo calcolato sul grafo e verbalizzato dall'LLM.
export async function getDirections(
  museumQid: string,
  from: string,
  target: string,
  language: string,
  detailed = false,
): Promise<string> {
  const res = await fetch(`${API_BASE}/wayfinding`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ museumQid, from, target, language, detailed }),
  });
  if (!res.ok) throw new Error(`Failed to fetch directions: ${res.statusText}`);
  const data = await res.json();
  return data.directions;
}

// ============================================================================
//                                   Speech To Text
// ============================================================================

// invia l'audio registrato al server per ottenere la sua trascrizione.
// `lang` e' il codice BCP-47 della lingua in cui parla l'utente (per lo STT).
export async function sendAudioToBackend(
  audioBlob: Blob,
  lang: string,
): Promise<any> {
  const formData = new FormData();
  formData.append("audioFile", audioBlob, "recording.webm");
  formData.append("lang", lang);
  const res = await fetch(`${API_BASE}/speech`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to send Audio");
  return res.json();
}

// ============================================================================
//                                   Text To Speech
// ============================================================================

// ritorna l'audio (MP3) della sintesi vocale del testo fornito.
// `lang` e' il codice BCP-47 della lingua in cui sintetizzare la voce.
export async function getSpeechAudio(
  text: string,
  lang: string,
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/speech/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, lang }),
  });
  if (!res.ok) throw new Error("Failed to synthesize speech");
  return res.blob();
}

// ============================================================================
//                                 Translation
// ============================================================================

// traduce una lista di testi (dall'italiano) nella lingua `target`.
// `target` e' il codice per Google Translate (es. "fr", "zh-CN").
export async function translateTexts(
  texts: string[],
  target: string,
): Promise<string[]> {
  const res = await fetch(`${API_BASE}/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ texts, target }),
  });
  if (!res.ok) throw new Error("Failed to translate text");
  const data = await res.json();
  return data.translations;
}

// ============================================================================
//                        Guided sessions (modulo 18-27)
// ============================================================================
// Wrapper REST per il backbone effimero delle visite guidate sincronizzate
// (server: routes/guidedSessions.ts). Trasporto a POLLING: i componenti del
// navigator interrogano le GET a intervalli brevi. La sessione vive solo in
// memoria sul server: quando finisce, le GET rispondono 404/410 (studente).

const GS_BASE = `${API_BASE}/guided-sessions`;

// Errore dedicato: la sessione non esiste piu' (docente ha terminato o il
// server e' ripartito). Il chiamante deve uscire senza lasciare traccia.
export class GuidedEndedError extends Error {
  constructor() {
    super("La visita guidata è terminata.");
    this.name = "GuidedEndedError";
  }
}

// estrae il messaggio d'errore dal corpo JSON, con un fallback generico.
async function readGuidedError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data && data.error) return data.error;
  } catch {
    // corpo non-JSON: si usa il fallback
  }
  return `Errore ${res.status}`;
}

// DOCENTE: apre (o riusa) la sala d'attesa per una sua visita guidata.
export async function createGuidedSession(
  visitId: string,
  teacher: string,
): Promise<any> {
  const res = await fetch(GS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitId, teacher }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

// DOCENTE: vista con la lista partecipanti (polling della sala d'attesa).
export async function getGuidedTeacherView(id: string): Promise<any> {
  const res = await fetch(`${GS_BASE}/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new GuidedEndedError();
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

// STUDENTE: stato corrente (step, momento di partenza audio). 410 = terminata.
export async function getGuidedStudentState(id: string): Promise<any> {
  const res = await fetch(`${GS_BASE}/${encodeURIComponent(id)}/state`);
  if (res.status === 410) throw new GuidedEndedError();
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

// Contenuti della visita (accesso TEMPORANEO legato alla sessione viva): item
// con `about` gia' popolato, ordinati come nella visita.
export async function getGuidedItems(
  id: string,
  username: string,
): Promise<Item[]> {
  const res = await fetch(
    `${GS_BASE}/${encodeURIComponent(id)}/items?username=${encodeURIComponent(username)}`,
  );
  if (res.status === 410) throw new GuidedEndedError();
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

// DOCENTE: da' il via (stato "attiva", step 0).
export async function postGuidedStart(id: string, teacher: string): Promise<any> {
  const res = await fetch(`${GS_BASE}/${encodeURIComponent(id)}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teacher }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

// DOCENTE: porta tutti sull'opera `index` (la vista degli studenti lo segue).
export async function postGuidedStep(
  id: string,
  teacher: string,
  index: number,
): Promise<any> {
  const res = await fetch(`${GS_BASE}/${encodeURIComponent(id)}/step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teacher, index }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
  return res.json();
}

// DOCENTE: termina la sessione (sparisce per tutti).
export async function postGuidedEnd(id: string, teacher: string): Promise<void> {
  const res = await fetch(`${GS_BASE}/${encodeURIComponent(id)}/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teacher }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
}

// STUDENTE: esce dalla sala d'attesa.
export async function postGuidedLeave(
  id: string,
  username: string,
): Promise<void> {
  const res = await fetch(`${GS_BASE}/${encodeURIComponent(id)}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) throw new Error(await readGuidedError(res));
}

// STUDENTE: notifica al docente una domanda posta (nome + testo + opera). E'
// "fire-and-forget": la risposta LLM la ottiene per conto suo, questa e' solo la
// segnalazione per il monitoraggio del docente, quindi un errore non deve
// disturbare l'esperienza dello studente.
export async function postGuidedAsk(
  id: string,
  username: string,
  question: string,
  artwork: string,
): Promise<void> {
  try {
    await fetch(`${GS_BASE}/${encodeURIComponent(id)}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, question, artwork }),
    });
  } catch {
    // ignorata di proposito: la segnalazione al docente e' best-effort
  }
}
