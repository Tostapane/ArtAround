import { ref } from "vue";
import type { BaseArtwork, BaseItem, BaseVisit } from "../../shared/types";
import { getArtworks } from "./api";

export const artworks = ref<BaseArtwork[]>([]);
export const items = ref<(BaseItem | BaseVisit)[]>([]);
export const isLoaded = ref(false);

export async function loadArtworks() {
  if (isLoaded.value) return;
  try {
    artworks.value = await getArtworks();
  } catch (err) {
    console.error(
      "Errore durante il caricamento delle opere nella pagina",
      err,
    );
  }
}
