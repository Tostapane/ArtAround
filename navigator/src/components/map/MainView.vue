<script setup lang="ts">
import { ref, computed, watch, onUnmounted, watchEffect } from "vue";
import Map from "./Map.vue";
import Card from "./Card.vue";
import OptionsBar from "./OptionsBar.vue";
import Info from "./Info.vue";
import { artworks, loadArtworks } from "./../../state";
import { items, loadItems } from "./../../state";
import { match, matchedContent } from "./../../state";

// il corretto approccio e' di matchare in state e qui importare solamente
// l'interfaccia Match
const ids = [
  "Q12418-Intermedio-30-sistema",
  "Q45585-Intermedio-30-sistema",
  "Q185372-Intermedio-30-sistema",
  "Q18891156-Intermedio-30-sistema",
  "Q128910-Intermedio-30-sistema",
  "Q175036-Intermedio-30-sistema",
  "Q151047-Intermedio-30-sistema",
  "Q208758-Intermedio-30-sistema",
  "Q219831-Intermedio-30-sistema",
  "Q328523-Intermedio-30-sistema",
  "Q321303-Intermedio-30-sistema",
  "Q29530-Intermedio-30-sistema",
  "Q220859-Intermedio-30-sistema",
];
Promise.all([loadArtworks(), loadItems(ids)]).then(() => {
  console.log(artworks.value.length);
  console.log(items.value.length);
  match(items.value, artworks.value);
});
console.log("content matchato: ");
console.log(matchedContent.value);
watchEffect(() => {
  if (items.value.length > 0) {
    console.log("Items loaded reactively:", items.value);
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
      currentIndex.value = (currentIndex.value + 1) % artworks.value.length;
    else if (direction === "prev")
      currentIndex.value = (currentIndex.value - 1) % artworks.value.length;
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
