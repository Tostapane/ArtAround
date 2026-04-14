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

  if (!res.ok) {
    throw new Error(`Failed to fetch items: ${res.statusText}`);
  }

  const data = await res.json();
  return data;
}

// ritorna la visita con l'id richiesto
export async function getVisit(id: string): Promise<Visit> {
  const res = await fetch(`${API_BASE}/visits/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch visit: ${res.statusText}`);
  const data = await res.json();
  console.log("successfully fetched the desired visit");
  console.log(data);
  return data;
}
