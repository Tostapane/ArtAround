import type { Artwork, Item, Visit } from "../../shared/types";

const API_BASE = "http://localhost:8000/api";

export async function getArtworks(): Promise<Artwork[]> {
  const res = await fetch(`${API_BASE}/artworks`);
  const data = await res.json();
  console.log("successfully  fetched artworks");
  return data;
}

export async function getItems(itemIds: string[]): Promise<Item[]> {
  const res = await fetch(`${API_BASE}/items/batch`, {
    method: "POST", // Changed from GET to POST
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids: itemIds }), // The array goes securely in the body
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch items: ${res.statusText}`);
  }

  const data = await res.json();
  return data;
}
