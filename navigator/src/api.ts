import type { Item, Museum, Visit } from "../../shared/types";

const API_BASE = "http://localhost:8000/api";

// ============================================================================
//                                 Visits
// ============================================================================

// ritorna la visita con l'id richiesto
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

// ritorna uno specifico museo in base al suo qid
export async function getMuseum(qid: string): Promise<Museum> {
  const res = await fetch(`${API_BASE}/museums/${encodeURIComponent(qid)}`);
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

// ritorna le indicazioni logistiche (in linguaggio naturale, nella lingua scelta)
// dalla posizione `from` (qid dell'opera corrente) verso `target`: un tipo di POI
// ("toilet"|"exit"|"bar"|"shop"|...), "obstacles", o il qid di un'altra opera.
// Il percorso e' calcolato lato server sul grafo ricavato dalla mappa SVG.
export async function getDirections(
  museumQid: string,
  from: string,
  target: string,
  language: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/wayfinding`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ museumQid, from, target, language }),
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
