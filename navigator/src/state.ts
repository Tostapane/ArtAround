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
  //console.log(items.value);
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

// funzione che svuota la lista degli item (per cambiare visita)
export function clearItems() {
  items.value = [];
}

// funzione che ritorna gli items i cui "@id" sono presenti dentro l'array itemList
// effettua una chiamata al server
export async function loadItems(itemList: string[]) {
  if (itemsLoadingPromise) return itemsLoadingPromise;

  itemsLoadingPromise = (async () => {
    try {
      const newItems = await getItems(itemList);
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
