import { ref } from "vue";
import type { Artwork, Item, Visit, Match } from "../../shared/types";
import { getArtworks, getItems } from "./api";

export const artworks = ref<Artwork[]>([]);
export const items = ref<Item[]>([]);
export const artworksLoaded = ref(false);
export const itemsLoaded = ref(false);
export const matchedContent = ref<Match[]>([]);
let artworksLoadingPromise: Promise<void> | null = null;
let itemsLoadingPromise: Promise<void> | null = null;

export async function loadArtworks() {
  if (artworksLoaded.value) return;
  if (artworksLoadingPromise) return artworksLoadingPromise;

  artworksLoadingPromise = (async () => {
    try {
      artworks.value = await getArtworks();
      artworksLoaded.value = true;
    } catch (err) {
      console.error("Errore durante il caricamento delle opere", err);
    } finally {
      artworksLoadingPromise = null;
    }
  })();

  return artworksLoadingPromise;
}

export async function loadItems(itemList: string[]) {
  if (itemsLoaded.value) return;
  if (itemsLoadingPromise) return itemsLoadingPromise;

  itemsLoadingPromise = (async () => {
    try {
      items.value = await getItems(itemList);
      itemsLoaded.value = true;
    } catch (err) {
      console.error("Errore durante il caricamento degli item", err);
    } finally {
      itemsLoadingPromise = null;
    }
  })();

  return itemsLoadingPromise;
}

export async function match(items: Item[], artworks: Artwork[]) {
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
