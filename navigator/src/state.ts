/**
 * Stato globale del navigator.
 *
 * Reattivo e condiviso, senza libreria di store: l'app ha una sola visita alla
 * volta e pochi stati, quindi dei `ref` esportati bastano.
 *
 * Cose da sapere:
 * - `matchedContent` sono le TAPPE, costruite da `buildStops` in un punto solo:
 *   l'opera arriva gia' dentro l'item dal server (`about` espanso), e qui si
 *   aggiunge l'ancora, cioe' dove si sta quando la tappa non e' un'opera. Le
 *   visite su misura e quelle guidate passano dalla stessa funzione, e
 *   `contentVisitId` impedisce a `loadVisitContent` di sovrascriverle.
 * - `stageView` ricorda se si guardava la mappa o l'elenco: sono due modi PARI
 *   di navigare la stessa visita, non un contenuto e la sua barra laterale.
 * - `includeOptional` spento fa saltare le tappe opzionali ad avanti/indietro,
 *   ma restano apribili da elenco, mappa o QR: e' la lettura della slide 23,
 *   "se rimane tempo, o su domanda del visitatore".
 * - `notesAfter` e `openingNotes` leggono le indicazioni logistiche ancorate
 *   alla tappa che seguono. Il navigator non le leggeva affatto: erano scritte,
 *   salvate, mostrate nel marketplace e invisibili alla persona per cui erano
 *   state scritte (slide 21).
 */

import { ref } from "vue";
import type { Artwork, Item, Visit, Museum, Match } from "../../shared/types";
import { languages, kindById, type Language } from "../../shared/constants";
import { getMuseum, getMuseumArtworks, getVisitItems } from "./api";
import { mediaOrigin } from "./config";
import { setLocale } from "./i18n";

// ============================================================================
//                            Visita, museo, mappa
// ============================================================================

export const visit = ref<Visit>();
export const museum = ref<Museum>();
export const map = ref<string>("");
export const matchedContent = ref<Match[]>([]);

/**
 * Tutte le opere del museo, non solo le tappe: la localizzazione sceglie fra i
 * nodi disegnati sulla pianta, e la pianta li porta tutti. Servono il nome e
 * l'immagine per mostrarli quando la scelta la fa il visitatore.
 */
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
//                             Palcoscenico
// ============================================================================

export const stageView = ref<"mappa" | "elenco">(
  (localStorage.getItem("artaround-stage") as "mappa" | "elenco") || "mappa",
);

export function setStageView(value: "mappa" | "elenco") {
  stageView.value = value;
  localStorage.setItem("artaround-stage", value);
}

/**
 * Se il visitatore vuole che l'applicazione tenga conto di dove si trova.
 *
 * Parte SPENTA: nessun sensore, nessun permesso chiesto, e le indicazioni
 * partono dall'opera aperta come hanno sempre fatto. Accendendola, i sensori si
 * avviano e le indicazioni partono da dove si e' — comunque ci si sia arrivati,
 * camminando o col teletrasporto.
 */
export const posizioneAttiva = ref(
  localStorage.getItem("artaround-posizione") === "si",
);

export function setPosizioneAttiva(value: boolean) {
  posizioneAttiva.value = value;
  localStorage.setItem("artaround-posizione", value ? "si" : "no");
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

/**
 * La lingua che il telefono dichiara, se e' fra quelle offerte.
 *
 * Serve perche' la PRIMA schermata si legge prima di poter scegliere: aprendo
 * sempre in italiano, a un visitatore cinese si chiede di riconoscere la frase
 * «Lingua dei contenuti» per arrivare a 中文. Il suo telefono quella risposta ce
 * l'ha gia'.
 *
 * `navigator.languages` porta le preferenze in ordine di gradimento. Si prova
 * prima il codice intero e poi la sola radice, perche' un telefono dice `en-GB`
 * o `pt-PT` dove il nostro elenco ha `en` e `pt` — e all'incontrario dice `zh`
 * dove noi abbiamo solo `zh-CN`. Una radice che porta a piu' lingue prende la
 * prima dell'elenco: e' l'unica cinese che il progetto ha.
 */
function browserLanguage(): Language | null {
  const preferite = navigator.languages || [navigator.language];
  for (const p of preferite) {
    if (!p) continue;
    const codice = p.toLowerCase();
    for (const l of languages) {
      if (l.translate.toLowerCase() === codice) return l;
    }
    const radice = codice.split("-")[0];
    for (const l of languages) {
      if (l.translate.toLowerCase().split("-")[0] === radice) return l;
    }
  }
  return null;
}

/** Quella gia' scelta, poi quella del telefono, poi l'italiano. */
function loadLanguage(): Language {
  const saved = localStorage.getItem(LANG_KEY);
  for (const l of languages) {
    if (l.translate === saved) return l;
  }
  const dalTelefono = browserLanguage();
  if (dalTelefono) return dalTelefono;
  return defaultLanguage();
}

export const language = ref<Language>(loadLanguage());

/**
 * La lingua la SPINGE questo modulo dentro `i18n`, invece di essere letta da li'
 * con un `watch`: quella direzione chiudeva un anello di import
 * (i18n → state → api → i18n) e faceva partire l'applicazione con `language` non
 * ancora inizializzato. Nel verso giusto `i18n` non importa niente e l'anello non
 * si puo' formare — vedi la sua intestazione.
 */
setLocale(language.value.translate);

export function setLanguage(lang: Language) {
  language.value = lang;
  localStorage.setItem(LANG_KEY, lang.translate);
  setLocale(lang.translate);
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
//                        Le tappe: soggetto e ancora
// ============================================================================

/**
 * Da item a tappe: l'opera (che il server manda dentro `about`, e che non c'e'
 * per uno stile o un periodo) e l'ANCORA, cioe' dove si sta mentre si ascolta —
 * la prossima opera del percorso, o quella prima se dopo non ce ne sono.
 * Senza ancora la tappa non avrebbe posizione e la pianta resterebbe indietro.
 */
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

/** Come si chiama il soggetto di una tappa. */
export function stopName(stop: Match): string {
  if (stop.artwork) return stop.artwork.name;
  if (stop.item.subject) return stop.item.subject;
  return "Contenuto";
}

/** La riga sotto il nome: l'autore dell'opera, oppure che genere di soggetto e'. */
export function stopSubtitle(stop: Match): string {
  if (stop.artwork) return stop.artwork.author.name;
  const genere = kindById(stop.item.kind);
  if (genere) return genere.name;
  return "";
}

/**
 * L'immagine della tappa e CHE COSA ritrae, che non sono la stessa cosa.
 *
 * Vince quella dell'item, perche' l'ha scelta l'autore. Quando non c'e' — a un
 * contenuto che parla di uno stile o di un periodo non si chiede piu' di
 * portarne una — si ripiega sull'ANCORA: l'opera davanti a cui si sta mentre lo
 * si ascolta. Non e' un riempitivo, e' la foto di dove il visitatore si trova.
 *
 * Il nome torna insieme all'indirizzo perche' la didascalia deve dire l'opera
 * che si vede e non il soggetto della tappa: altrimenti la Primavera verrebbe
 * annunciata come «Rinascimento».
 */
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
