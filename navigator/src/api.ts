import type { BaseArtwork, BaseItem, BaseVisit } from "../../shared/types";

const API_BASE = "http://localhost:8000/api";

export async function getArtworks(): Promise<BaseArtwork[]> {
  const res = await fetch(`${API_BASE}/artworks`);
  const data = await res.json();
  return data;
}
