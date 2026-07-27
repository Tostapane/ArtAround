import { ref } from "vue";
import type { Artwork, Visit, Museum, Match } from "../../shared/types";
import { languages, type Language } from "../../shared/constants";
import { getMuseum, getVisitItems } from "./api";
import { mediaOrigin } from "./config";

export const visit = ref<Visit>();
export const museum = ref<Museum>();
export const map = ref<string>("");

/** Chi sta visitando (arriva dal marketplace con ?user=). Vuoto in modalita'
 *  esempio: in quel caso si vedono solo le visite gratuite. */
export const utente = ref<string>("");

/** Cosa mostra il palcoscenico: la mappa o l'elenco. Sono due modi di
 *  navigare la stessa visita, non un contenuto e la sua barra laterale —
 *  quindi sono pari, e la scelta si ricorda. */
export const vistaStage = ref<"mappa" | "elenco">(
  (localStorage.getItem("artaround-stage") as "mappa" | "elenco") || "mappa",
);

export function setVistaStage(v: "mappa" | "elenco") {
  vistaStage.value = v;
  localStorage.setItem("artaround-stage", v);
}

// Lingua scelta dall'utente: tutti i contenuti vengono tradotti e sintetizzati
// live in questa lingua. Default: italiano (lingua di partenza nel DB).
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

// Popolato dal server (GET /api/visits/:id/items, con `about` gia' espanso),
// oppure iniettato direttamente per le visite su misura e guidate.
export const matchedContent = ref<Match[]>([]);

// Tappe opzionali (slide 23): a interruttore spento Prossimo/Precedente le
// saltano; restano apribili direttamente (elenco, mappa, QR) — cioe' "se
// rimane tempo, o su domanda del visitatore".
export const includeOptional = ref(false);

export function isOptionalItem(itemId: string): boolean {
  if (!visit.value) return false;
  if (!visit.value.optionalItems) return false;
  return visit.value.optionalItems.includes(itemId);
}

/**
 * Indicazioni logistiche ancorate DOPO una certa tappa.
 * Slide 21: la visita e' "una sequenza di descrizioni di item piu' indicazioni
 * logistiche ... per passare da un item all'altro". Finora il navigator non le
 * leggeva affatto: erano scritte, salvate, mostrate nel marketplace e invisibili
 * alla persona per cui erano state scritte.
 */
export function logisticaDopo(itemId: string): string[] {
  const v = visit.value;
  if (!v || !v.logistics) return [];
  const note: string[] = [];
  for (const n of v.logistics) {
    if (n && typeof n === "object" && n.after === itemId && n.text) {
      note.push(n.text);
    }
  }
  return note;
}

/** Note d'apertura: quelle senza posizione (o salvate nel vecchio formato). */
export function logisticaIniziale(): string[] {
  const v = visit.value;
  if (!v || !v.logistics) return [];
  const note: string[] = [];
  for (const n of v.logistics) {
    if (typeof n === "string" && n.trim() !== "") note.push(n);
    else if (n && typeof n === "object" && !n.after && n.text) note.push(n.text);
  }
  return note;
}

// id della visita di cui matchedContent contiene gia' il contenuto: evita di
// ricaricarlo (e, per le visite iniettate, di sovrascriverlo).
let contentVisitId = "";

let museumLoadingPromise: Promise<void> | null = null;

export function clearVisit() {
  visit.value = undefined;
  matchedContent.value = [];
  contentVisitId = "";
  includeOptional.value = false;
}

// inietta una visita costruita altrove (su misura, oppure guidata) senza
// passare dal database: vive solo nel client.
export function setCustomVisit(v: Visit, content: Match[]) {
  visit.value = v;
  matchedContent.value = content;
  contentVisitId = v["@id"];
  includeOptional.value = false;
}

// imposta i metadati della visita scelta: il contenuto arriva da loadVisitContent.
export function setVisit(v: Visit) {
  visit.value = v;
  includeOptional.value = false;
}

// carica gli item della visita gia' uniti al rispettivo artwork
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

// carica il museo e la relativa mappa
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

// scarica l'SVG della mappa usando il mapPath del museo (unica fonte di verita')
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
