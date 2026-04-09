import { ref } from "vue";
import type { BaseArtwork, BaseItem, BaseVisit } from "../../shared/types";
import { getArtworks, getItems } from "./api";

export const artworks = ref<BaseArtwork[]>([]);
export const items = ref<BaseItem[]>([]);
export const artworksLoaded = ref(false);
let loadingPromise: Promise<void> | null = null;

export async function loadArtworks() {
  if (artworksLoaded.value) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      artworks.value = await getArtworks();
      artworksLoaded.value = true;
    } catch (err) {
      console.error(
        "Errore durante il caricamento delle opere nella pagina",
        err,
      );
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}
