import { ref } from "vue";
import type { Artwork, Visit, Museum, Match } from "../../shared/types";
import { languages, type Language } from "../../shared/constants";
import { getMuseum, getVisit, getVisitItems } from "./api";

export const visit = ref<Visit>();
export const museum = ref<Museum>();
export const map = ref<string>("");

// Lingua scelta dall'utente: tutti i contenuti (titolo, autore, testo, risposte
// LLM) vengono tradotti e sintetizzati live in questa lingua. Default: italiano
// (la lingua di partenza dei contenuti nel DB). La scelta e' persistita.
const STORAGE_KEY = "artaround-lang";

function defaultLanguage(): Language {
  const first = languages[0];
  if (!first) throw new Error("Nessuna lingua configurata");
  return first;
}

function loadLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  for (const l of languages) {
    if (l.translate === saved) return l;
  }
  return defaultLanguage();
}

export const language = ref<Language>(loadLanguage());

export function setLanguage(lang: Language) {
  language.value = lang;
  localStorage.setItem(STORAGE_KEY, lang.translate);
}

// Popolato dal server (GET /api/visits/:id/items, con `about` gia' espanso).
// Niente piu' join lato client tra item e artwork.
export const matchedContent = ref<Match[]>([]);

let visitLoadingPromise: Promise<void> | null = null;
let museumLoadingPromise: Promise<void> | null = null;

// funzioni di pulizia
export function clearVisit() {
  visit.value = undefined;
  matchedContent.value = [];
}

// carica i metadati della visita (nome, livello, logistica, ecc.)
export async function loadVisit(id: string) {
  if (visit.value && visit.value["@id"] === id) return;
  if (visitLoadingPromise) return visitLoadingPromise;
  visitLoadingPromise = (async () => {
    try {
      visit.value = await getVisit(id);
    } catch (err) {
      console.error("Errore durante il caricamento della visita", err);
    } finally {
      visitLoadingPromise = null;
    }
  })();
  return visitLoadingPromise;
}

// carica gli item della visita gia' uniti al rispettivo artwork
export async function loadVisitContent(visitId: string) {
  matchedContent.value = [];
  try {
    const items = await getVisitItems(visitId);
    matchedContent.value = items
      .filter((it) => it.about && typeof it.about === "object")
      .map((it) => ({ artwork: it.about as Artwork, item: it }));
  } catch (err) {
    console.error(
      "Errore durante il caricamento del contenuto della visita",
      err,
    );
  }
}

// carica il museo e la relativa mappa
export async function loadMuseum(id: string) {
  if (museum.value && museum.value.qid === id) return;
  if (museumLoadingPromise) return museumLoadingPromise;
  museumLoadingPromise = (async () => {
    try {
      museum.value = await getMuseum(id);
      console.log("Museum loaded:", museum.value.name);
      await loadMap(museum.value);
    } catch (err) {
      console.error("Errore durante il caricamento del museo", err);
    } finally {
      museumLoadingPromise = null;
    }
  })();
  return museumLoadingPromise;
}

// scarica l'SVG della mappa usando il mapPath del museo (unica fonte di verita')
export async function loadMap(target: Museum) {
  try {
    const response = await fetch(
      `http://localhost:8000${encodeURI(target.mapPath)}`,
    );
    if (!response.ok)
      throw new Error(`Failed to fetch map: ${response.statusText}`);
    map.value = await response.text();
  } catch (err) {
    console.error("Failed to fetch the map", err);
  }
}
