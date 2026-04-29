import { ref, computed, nextTick } from "vue";
import type { Artwork, Item, Visit, Match, Museum } from "../../shared/types";
import {
  getAllArtworks,
  getArtworksByMuseum,
  getItems,
  getMuseum,
  getVisit,
} from "./api";

export const artworks = ref<Artwork[]>([]);
export const items = ref<Item[]>([]);
export const visit = ref<Visit>();
export const museum = ref<Museum>();
export const map = ref<string>("");

// computed in modo da non aver bisogno di fare feth in mainview, bastera chiamare solo
// le funzioni per item e artworks
// PROBLEMA: piu item dovrebbero poter essere associati allo stesso artwork
export const matchedContent = computed<Match[]>(() => {
  console.log("Inzio matching");
  const results: Match[] = [];
  console.log(items.value);
  console.log(artworks.value);
  for (const item of items.value) {
    const matchingArt = artworks.value.find((art) => {
      // console.log(`${art["@id"]} -- ${item.about}`);
      return art["@id"] == item.about;
    });
    if (matchingArt) {
      results.push({
        artwork: matchingArt,
        item: item,
      });
    } else {
      console.log("matching non trovato");
    }
  }
  return results;
});

let artworksLoadingPromise: Promise<void> | null = null;
let itemsLoadingPromise: Promise<void> | null = null;
let visitLoadingPromise: Promise<void> | null = null;
let museumLoadingPromise: Promise<void> | null = null;

// funzione che carica tutti gli artworks facendo una chiamata al server
export async function loadArtworks() {
  if (museumLoadingPromise) await museumLoadingPromise;
  if (!museum.value) {
    console.error("Errore caricametno opere, nessun museo scelto.");
    return;
  }
  const museumQid = museum.value.qid;
  if (artworks.value.length > 0) return;
  if (artworksLoadingPromise) return artworksLoadingPromise;
  artworksLoadingPromise = (async () => {
    try {
      const results = await getArtworksByMuseum(museumQid);
      artworks.value = results;
      console.log("Artworks updated in state:", results.length);
    } catch (err) {
      console.error("Errore durante il caricamento delle opere", err);
    } finally {
      artworksLoadingPromise = null;
    }
  })();
  return artworksLoadingPromise;
}

// funzioni di pulizia
export function clearItems() {
  items.value = [];
}
export function clearVisit() {
  visit.value = undefined;
}
export function clearArtworks() {
  artworks.value = [];
}

// funzione che ritorna gli items i cui "@id" sono presenti dentro l'array itemList
export async function loadItems(itemList: string[]) {
  if (itemsLoadingPromise) return itemsLoadingPromise;
  itemsLoadingPromise = (async () => {
    try {
      const newItems = await getItems(itemList);
      items.value = [...items.value, ...newItems];
      // console.log("Items updated in state:", items.value.length);
    } catch (err) {
      console.error("Errore durante il caricamento degli item", err);
    } finally {
      itemsLoadingPromise = null;
    }
  })();
  return itemsLoadingPromise;
}

// funzione che ritorna la visita con lo specifico id
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

// funzione che ritorna il museo con lo specifico id
export async function loadMuseum(id: string) {
  if (museum.value && museum.value.qid === id) return;
  if (museumLoadingPromise) return museumLoadingPromise;
  museumLoadingPromise = (async () => {
    try {
      museum.value = await getMuseum(id);
      console.log("Museum loaded:", museum.value.name);
      await loadMap(museum.value.name);
    } catch (err) {
      console.error("Errore durante il caricamento del museo", err);
    } finally {
      museumLoadingPromise = null;
    }
  })();
  return museumLoadingPromise;
}

export async function loadMap(museumName: string) {
  try {
    const response = await fetch(
      `http://localhost:8000/maps/${encodeURIComponent(museumName)}.svg`,
    );
    if (!response.ok)
      throw new Error(`Failed to fetch map: ${response.statusText}`);
    map.value = await response.text();
    await nextTick();
  } catch (err) {
    console.error("Failed to fetch the map", err);
  }
}
