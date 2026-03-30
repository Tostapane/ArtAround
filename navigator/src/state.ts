import { ref } from "vue";
import type { BaseArtwork, BaseItem, BaseVisit } from "../../shared/types";

export const artworks = ref<BaseArtwork[]>([]);
export const items = ref<(BaseItem | BaseVisit)[]>([]);
export const isLoaded = ref(false);
