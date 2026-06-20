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

// ritorna una nuova descrizione a partire da quella attuale, secondo la richiesta userReq
export async function getInfo(
  previous: string,
  userReq: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/llm/newInfo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ previous, userReq }),
  });
  if (!res.ok)
    throw new Error(`Failed to fetch new description: ${res.statusText}`);
  return res.json();
}

// ============================================================================
//                                   Speech To Text
// ============================================================================

// invia l'audio registrato al server per ottenere la sua trascrizione
export async function sendAudioToBackend(audioBlob: Blob): Promise<any> {
  const formData = new FormData();
  formData.append("audioFile", audioBlob, "recording.webm");
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

// ritorna l'audio (MP3) della sintesi vocale del testo fornito
export async function getSpeechAudio(text: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/speech/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Failed to synthesize speech");
  return res.blob();
}
