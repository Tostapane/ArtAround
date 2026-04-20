<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import Map from "./Map.vue";
import Card from "./Card.vue";
import OptionsBar from "./OptionsBar.vue";
import Info from "./Info.vue";
import {
  loadArtworks,
  loadItems,
  visit,
  loadVisit,
  matchedContent,
  clearItems,
} from "./../../state";
import AudioRecorder from "./speech/AudioRecorder.vue";
// la visita scelta dal selector
const props = defineProps<{
  currVisit: string;
}>();
// ativato ogni volta che viene cambiata una visita, anche se non dovrebbe
// essere cambiabile a runtime? per ora testing
watch(
  () => props.currVisit,
  async (newVisitId) => {
    if (!newVisitId) return;

    // Svuotiamo gli item precedenti prima di caricare la nuova visita
    clearItems();

    // console.log("Caricamento visita:", newVisitId);
    await loadVisit(newVisitId);

    if (visit.value && visit.value.itemListElement) {
      const ids = visit.value.itemListElement;
      // console.log("ID item da caricare:", ids);
      // Carichiamo artworks e nuovi items in parallelo
      await Promise.all([loadArtworks(), loadItems(ids)]);
      // console.log("Contenuto caricato e matchato");
    } else {
      console.error(
        "Errore nel caricamento della visita o itemListElement vuoto",
      );
    }
  },
  { immediate: true },
);
const currentIndex = ref<number | null>(null);

// gestione delle opzioni
const currentOption = ref<string>("");
const showOptions = ref(false);
function actionHandler(option: string) {
  currentOption.value = option;
  showOptions.value = false;
}

// gestione dell'opera selezionata
const currentArtwork = computed(() => {
  if (currentIndex.value === null) return null;
  const art = matchedContent.value[currentIndex.value];
  if (!art) return null;

  return art;
});
// blocca lo scroll quando un'opera è selezionata
watch(currentArtwork, (newVal) => {
  currentOption.value = "";
  showOptions.value = false;
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
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-md overflow-y-auto"
  >
    <div
      class="flex flex-col md:flex-row items-center md:items-stretch gap-4 w-full max-w-5xl justify-center h-auto md:h-[90vh]"
    >
      <Card
        :content="currentArtwork"
        @navigation="navigationHandler"
        @toggleOptions="showOptions = !showOptions"
        class="h-full shrink-0 md:shrink"
      />
      <div
        v-if="showOptions || currentOption"
        class="flex flex-col gap-4 w-full md:w-80 shrink-0 h-auto md:h-full md:overflow-y-auto pb-4 md:pb-0"
      >
        <OptionsBar v-if="showOptions" @action="actionHandler" />
        <Info
          v-if="currentOption"
          :request="currentOption"
          :about="currentArtwork"
          @close="currentOption = ''"
        />
      </div>
    </div>
  </div>
  <AudioRecorder />
</template>
