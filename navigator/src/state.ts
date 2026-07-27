/**
 * Stato globale del navigator.
 *
 * Reattivo e condiviso, senza libreria di store: l'app ha una sola visita alla
 * volta e pochi stati, quindi dei `ref` esportati bastano.
 *
 * Cose da sapere:
 * - `matchedContent` arriva gia' unito dal server (GET /visits/:id/items con
 *   `about` espanso): nessuna giunzione fra item e opere lato client. Le visite
 *   su misura e quelle guidate lo iniettano direttamente con `setCustomVisit`,
 *   e `contentVisitId` impedisce a `loadVisitContent` di sovrascriverlo.
 * - `stageView` ricorda se si guardava la mappa o l'elenco: sono due modi PARI
 *   di navigare la stessa visita, non un contenuto e la sua barra laterale.
 * - `includeOptional` spento fa saltare le tappe opzionali ad avanti/indietro,
 *   ma restano apribili da elenco, mappa o QR: e' la lettura della slide 23,
 *   "se rimane tempo, o su domanda del visitatore".
 * - `notesAfter` e `openingNotes` leggono le indicazioni logistiche ancorate
 *   alla tappa che seguono. Il navigator non le leggeva affatto: erano scritte,
 *   salvate, mostrate nel marketplace e invisibili alla persona per cui erano
 *   state scritte (slide 21).
 * - `user` e' vuoto in modalita' esempio: senza utente si vedono solo le visite
 *   gratuite.
 */

import { ref } from "vue";
import type { Artwork, Visit, Museum, Match } from "../../shared/types";
import { languages, type Language } from "../../shared/constants";
import { getMuseum, getVisitItems } from "./api";
import { mediaOrigin } from "./config";

// ============================================================================
//                            Visita, museo, mappa
// ============================================================================

export const visit = ref<Visit>();
export const museum = ref<Museum>();
export const map = ref<string>("");
export const matchedContent = ref<Match[]>([]);
export const user = ref<string>("");

let contentVisitId = "";
let museumLoadingPromise: Promise<void> | null = null;

// ============================================================================
//                             Palcoscenico
// ============================================================================

export const stageView = ref<"mappa" | "elenco">(
  (localStorage.getItem("artaround-stage") as "mappa" | "elenco") || "mappa",
);

export function setStageView(value: "mappa" | "elenco") {
  stageView.value = value;
  localStorage.setItem("artaround-stage", value);
}

// ============================================================================
//                                 Lingua
// ============================================================================

const LANG_KEY = "artaround-lang";

function defaultLanguage(): Language {
  const first = languages[0];
  if (!first) throw new Error("Nessuna lingua configurata");
  return first;
}

function loadLanguage(): Language {
  const saved = localStorage.getItem(LANG_KEY);
  for (const l of languages) {
    if (l.translate === saved) return l;
  }
  return defaultLanguage();
}

export const language = ref<Language>(loadLanguage());

export function setLanguage(lang: Language) {
  language.value = lang;
  localStorage.setItem(LANG_KEY, lang.translate);
}

// ============================================================================
//                            Tappe opzionali
// ============================================================================

export const includeOptional = ref(false);

export function isOptionalItem(itemId: string): boolean {
  if (!visit.value) return false;
  if (!visit.value.optionalItems) return false;
  return visit.value.optionalItems.includes(itemId);
}

// ============================================================================
//                         Indicazioni logistiche
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
  const current = visit.value;
  if (!current || !current.logistics) return [];
  const notes: string[] = [];
  for (const n of current.logistics) {
    if (typeof n === "string" && n.trim() !== "") notes.push(n);
    else if (n && typeof n === "object" && !n.after && n.text) notes.push(n.text);
  }
  return notes;
}

// ============================================================================
//                          Caricamento e pulizia
// ============================================================================

export function clearVisit() {
  visit.value = undefined;
  matchedContent.value = [];
  contentVisitId = "";
  includeOptional.value = false;
}

export function setCustomVisit(v: Visit, content: Match[]) {
  visit.value = v;
  matchedContent.value = content;
  contentVisitId = v["@id"];
  includeOptional.value = false;
}

export function setVisit(v: Visit) {
  visit.value = v;
  includeOptional.value = false;
}

export async function loadVisitContent(visitId: string) {
  if (contentVisitId === visitId) return;
  matchedContent.value = [];
  try {
    const items = await getVisitItems(visitId);
    matchedContent.value = items
      .filter((it) => it.about && typeof it.about === "object")
      .map((it) => ({ artwork: it.about as Artwork, item: it }));
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
