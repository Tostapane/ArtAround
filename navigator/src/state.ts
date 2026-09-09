/**
 * Stato reattivo del navigator, senza libreria di store. Costruisce le tappe in un
 * solo punto e separa percorso, vista, lingua e posizione per riusarli anche nelle
 * visite guidate e su misura.
 */
import { ref } from "vue";
import type { Artwork, Item, Visit, Museum, Match } from "../../shared/types";
import {
  LANG_KEY,
  kindById,
  pickLanguage,
  type Language,
} from "../../shared/constants";
import { getMuseum, getMuseumArtworks, getVisitItems } from "./api";
import { mediaOrigin } from "./config";
import { setLocale } from "./i18n";

// ============================================================================

export const visit = ref<Visit>();
export const museum = ref<Museum>();
export const map = ref<string>("");
export const matchedContent = ref<Match[]>([]);
export const currentArtwork = ref<Match | null>(null);
export const lastVisitIndex = ref(-1);
export const openingShown = ref(false);

export const museumArtworks = ref<Artwork[]>([]);

export function artworkByQid(qid: string): Artwork | null {
  for (const a of museumArtworks.value) {
    if (a.qid === qid) return a;
  }
  return null;
}

let contentVisitId = "";
let museumLoadingPromise: Promise<void> | null = null;

// ============================================================================

export const stageView = ref<"mappa" | "elenco">(
  (localStorage.getItem("artaround-stage") as "mappa" | "elenco") || "mappa",
);

export function setStageView(value: "mappa" | "elenco") {
  stageView.value = value;
  localStorage.setItem("artaround-stage", value);
}

export const posizioneAttiva = ref(
  localStorage.getItem("artaround-posizione") === "si",
);

export function setPosizioneAttiva(value: boolean) {
  posizioneAttiva.value = value;
  localStorage.setItem("artaround-posizione", value ? "si" : "no");
}

// ============================================================================

export const language = ref<Language>(
  pickLanguage(sessionStorage.getItem(LANG_KEY)),
);

setLocale(language.value.translate);

export function setLanguage(lang: Language) {
  language.value = lang;
  sessionStorage.setItem(LANG_KEY, lang.translate);
  setLocale(lang.translate);
}

// ============================================================================

export const includeOptional = ref(false);

export function isOptionalItem(itemId: string): boolean {
  if (!visit.value) return false;
  if (!visit.value.optionalItems) return false;
  return visit.value.optionalItems.includes(itemId);
}

// ============================================================================

export function notesAfter(itemId: string): string[] {
  const current = visit.value;
  if (!current || !current.logistics) return [];
  const notes: string[] = [];
  for (const n of current.logistics) {
    if (n && typeof n === "object" && n.after === itemId && n.text) {
      notes.push(n.text);
    }
  }
  return notes;
}

export function openingNotes(): string[] {
  const proprie: string[] = [];
  const current = visit.value;
  if (current && current.logistics) {
    for (const n of current.logistics) {
      if (typeof n === "string" && n.trim() !== "") proprie.push(n);
      else if (n && typeof n === "object" && !n.after && n.text) proprie.push(n.text);
    }
  }

  const notes: string[] = [];
  const sede = museum.value;
  if (sede && sede.logistics) {
    for (const text of sede.logistics) {
      if (text.trim() === "") continue;
      if (proprie.includes(text)) continue;
      notes.push(text);
    }
  }
  for (const text of proprie) notes.push(text);
  return notes;
}

// ============================================================================

export function buildStops(items: Item[]): Match[] {
  const stops: Match[] = [];
  for (const it of items) {
    let artwork: Artwork | null = null;
    if (it.about && typeof it.about === "object") artwork = it.about as Artwork;
    stops.push({ item: it, artwork, anchor: artwork });
  }

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (!stop || stop.anchor) continue;
    for (let j = i + 1; j < stops.length; j++) {
      const dopo = stops[j];
      if (dopo && dopo.artwork) {
        stop.anchor = dopo.artwork;
        break;
      }
    }
    if (stop.anchor) continue;
    for (let j = i - 1; j >= 0; j--) {
      const prima = stops[j];
      if (prima && prima.artwork) {
        stop.anchor = prima.artwork;
        break;
      }
    }
  }
  return stops;
}

export function stopName(stop: Match): string {
  if (stop.artwork) return stop.artwork.name;
  if (stop.item.subject) return stop.item.subject;
  return "Contenuto";
}

export function stopSubtitle(stop: Match): string {
  if (stop.artwork) return stop.artwork.author.name;
  const genere = kindById(stop.item.kind);
  if (genere) return genere.name;
  return "";
}

export function stopImage(stop: Match): { src: string; name: string } {
  if (stop.item.imagePath) {
    return { src: mediaUrl(stop.item.imagePath), name: stopName(stop) };
  }
  const opera = stop.artwork || stop.anchor;
  if (opera) {
    const src = opera.imagePath || opera.imageUri;
    if (src) return { src: mediaUrl(src), name: opera.name };
  }
  return { src: "", name: "" };
}

function mediaUrl(src: string): string {
  if (src.startsWith("http")) return src;
  return mediaOrigin() + src;
}

// ============================================================================

export function clearVisit() {
  visit.value = undefined;
  matchedContent.value = [];
  contentVisitId = "";
  includeOptional.value = false;
  currentArtwork.value = null;
  lastVisitIndex.value = -1;
  openingShown.value = false;
}

export function setCustomVisit(v: Visit, content: Match[]) {
  visit.value = v;
  matchedContent.value = content;
  contentVisitId = v["@id"];
  includeOptional.value = false;
  currentArtwork.value = null;
  lastVisitIndex.value = -1;
  openingShown.value = false;
}

export function setVisit(v: Visit) {
  visit.value = v;
  includeOptional.value = false;
  currentArtwork.value = null;
  lastVisitIndex.value = -1;
  openingShown.value = false;
}

export async function loadVisitContent(visitId: string) {
  if (contentVisitId === visitId) return;
  matchedContent.value = [];
  try {
    const items = await getVisitItems(visitId);
    matchedContent.value = buildStops(items);
    contentVisitId = visitId;
  } catch (err) {
    console.error("Errore durante il caricamento del contenuto della visita", err);
  }
}

export async function loadMuseum(id: string) {
  if (museum.value && museum.value.qid === id) return;
  if (museumLoadingPromise) return museumLoadingPromise;
  museumLoadingPromise = (async () => {
    try {
      museum.value = await getMuseum(id);
      await loadMap(museum.value);
      museumArtworks.value = await getMuseumArtworks(id);
    } catch (err) {
      console.error("Errore durante il caricamento del museo", err);
    } finally {
      museumLoadingPromise = null;
    }
  })();
  return museumLoadingPromise;
}

export async function loadMap(target: Museum) {
  try {
    const response = await fetch(`${mediaOrigin()}${encodeURI(target.mapPath)}`);
    if (!response.ok)
      throw new Error(`Failed to fetch map: ${response.statusText}`);
    map.value = await response.text();
  } catch (err) {
    console.error("Failed to fetch the map", err);
  }
}
