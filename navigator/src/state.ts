import { ref, computed } from "vue";
import type { Artwork, Item, Visit, Match } from "../../shared/types";
import { getArtworks, getItems, getVisit } from "./api";

export const artworks = ref<Artwork[]>([]);
export const items = ref<Item[]>([]);
export const visit = ref<Visit>();

// computed in modo da non aver bisogno di fare feth in mainview, bastera chiamare solo
// le funzioni per item e artworks
export const matchedContent = computed<Match[]>(() => {
  const results: Match[] = [];
  for (const item of items.value) {
    const matchingArt = artworks.value.find((art) => {
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

// funzione che carica tutti gli artworks facendo una chiamata al server
export async function loadArtworks() {
  if (artworks.value.length > 0) return;
  if (artworksLoadingPromise) return artworksLoadingPromise;

  artworksLoadingPromise = (async () => {
    try {
      artworks.value = await getArtworks();
    } catch (err) {
      console.error("Errore durante il caricamento delle opere", err);
    } finally {
      artworksLoadingPromise = null;
    }
  })();

  return artworksLoadingPromise;
}

// funzione che ritorna gli items i cui "@id" sono presenti dentro l'array itemList
// effettua una chiamata al server
export async function loadItems(itemList: string[]) {
  // Check if we already have all requested items
  const missingItems = itemList.filter(id => !items.value.some(item => item["@id"] === id));
  if (missingItems.length === 0) return;
  
  if (itemsLoadingPromise) return itemsLoadingPromise;

  itemsLoadingPromise = (async () => {
    try {
      const newItems = await getItems(missingItems);
      items.value = [...items.value, ...newItems];
    } catch (err) {
      console.error("Errore durante il caricamento degli item", err);
    } finally {
      itemsLoadingPromise = null;
    }
  })();

  return itemsLoadingPromise;
}

// funzione che ritorna la visita con lo specifico id
// effettua una chiamata al server
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

// funzione sincrona, viene usata solo una volta ottenute le risorse
// promossa a computed
/*
export function match(items: Item[], artworks: Artwork[]) {
  const results: Match[] = [];
  for (const item of items) {
    const matchingArt = artworks.find((art) => {
      return art["@id"] == item.about;
    });
    if (matchingArt) {
      console.log("trovato");
      results.push({
        artwork: matchingArt,
        item: item,
      });
    } else {
      console.log("non trovato");
    }
  }
  matchedContent.value = results;
}
*/
