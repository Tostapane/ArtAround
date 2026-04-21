import type { Artwork, Item, Visit } from "../../shared/types";

const API_BASE = "http://localhost:8000/api";

// ritorna tutti gli artworks nel database
export async function getArtworks(): Promise<Artwork[]> {
  const res = await fetch(`${API_BASE}/artworks`);
  if (!res.ok) throw new Error(`Failed to fetch artworks: ${res.statusText}`);
  const data = await res.json();
  console.log("successfully fetched artworks");
  return data;
}

// ritorna gli items specificati nell'array
export async function getItems(itemIds: string[]): Promise<Item[]> {
  const res = await fetch(`${API_BASE}/items/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids: itemIds }),
  });
  console.log("successfully fetched items");
  if (!res.ok) {
    throw new Error(`Failed to fetch items: ${res.statusText}`);
  }
  console.log();
  const data = await res.json();
  return data;
}

// ritorna la visita con l'id richiesto
export async function getVisit(id: string): Promise<Visit> {
  const res = await fetch(`${API_BASE}/visits/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch visit: ${res.statusText}`);
  const data = await res.json();
  console.log("successfully fetched the desired visit");
  return data;
}

export async function getVisits() {
  const res = await fetch(`${API_BASE}/visits`);
  if (!res.ok) throw new Error(`Failed to fetch visits: ${res.statusText}`);
  const data = await res.json();
  console.log("succesfully fetched all the visits");
  return data;
}

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

  const data = await res.json();
  console.log(`Successfully fetched the new description for: ${userReq}`);
  return data;
}

export async function sendAudioToBackend(audioBlob: Blob): Promise<any> {
  const formData = new FormData();
  formData.append("audioFile", audioBlob, "recording.webm");
  const res = await fetch(`${API_BASE}/speech`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to send Audio");
  console.log(res);
  return await res.json();
}
