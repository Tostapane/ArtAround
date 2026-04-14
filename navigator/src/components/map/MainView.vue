<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, watchEffect } from "vue";
import Map from "./Map.vue";
import Card from "./Card.vue";
import OptionsBar from "./OptionsBar.vue";
import Info from "./Info.vue";
import { loadArtworks } from "./../../state";
import { loadItems } from "./../../state";
import { visit, loadVisit } from "./../../state";
import { matchedContent } from "./../../state";

// il corretto approccio e' di matchare in state e qui importare solamente
// l'interfaccia Match
onMounted(async () => {
  await loadVisit("visit-Avanzato-30");
  if (visit.value && visit.value.itemListElement) {
    const ids = visit.value.itemListElement;
    await Promise.all([loadArtworks(), loadItems(ids)]);
    console.log("content matchato: ");
  } else {
    console.error("Failed to load visit");
  }
});
let currentIndex = ref<number | null>(null);

// gestione delle opzioni
let currentOption = ref<string>("");
function actionHandler(option: string) {
  if (currentOption) currentOption.value = option;
}

// gestione dell'opera selezionata
const currentArtwork = computed(() => {
  if (currentIndex.value === null) return null;
  const art = matchedContent.value[currentIndex.value];
  if (!art) return null;

  currentOption.value = "";
  return art;
});
// blocca lo scroll quando un'opera è selezionata
watch(currentArtwork, (newVal) => {
  if (newVal) {
    document.body.classList.add("overflow-hidden");
  } else {
    document.body.classList.remove("overflow-hidden");
  }
});

// pulizia allo smontaggio del componente
onUnmounted(() => {
  document.body.classList.remove("overflow-hidden");
});

function navigationHandler(direction: string) {
  if (currentIndex.value != null) {
    if (direction === "next")
      currentIndex.value =
        (currentIndex.value + 1) % matchedContent.value.length;
    else if (direction === "prev")
      currentIndex.value =
        (currentIndex.value - 1) % matchedContent.value.length;
    else currentIndex.value = null;
  }
}
</script>

<template>
  <Map @select="(index: number) => (currentIndex = index)" />
  <div
    v-if="currentArtwork"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md"
  >
    <Card :content="currentArtwork" @navigation="navigationHandler" />
    <OptionsBar @action="actionHandler" />
    <Info
      v-if="currentOption"
      :request="currentOption"
      @close="currentOption = ''"
    />
  </div>
</template>
