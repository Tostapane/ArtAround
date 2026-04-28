import { ref, computed } from "vue";
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
  if (artworks.value.length > 0) return;
  if (museumLoadingPromise) await museumLoadingPromise;
  if (!museum.value) {
    console.error(
      "Impossibile caricare le opere: nessun museo caricato nello stato.",
    );
    return;
  }
  if (artworksLoadingPromise) return artworksLoadingPromise;

  const museumQid = museum.value.qid;

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

// funzione che svuota la lista degli item (per cambiare visita)
export function clearItems() {
  items.value = [];
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
  if (museum.value) return;
  if (museumLoadingPromise) return museumLoadingPromise;

  museumLoadingPromise = (async () => {
    try {
      museum.value = await getMuseum(id);
    } catch (err) {
      console.error("Errore durante il caricamento della visita", err);
    } finally {
      museumLoadingPromise = null;
    }
  })();
}
