<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import Map from "./Map.vue";
import Card from "./Card.vue";
import OptionsBar from "./OptionsBar.vue";
import Info from "./Info.vue";
import { useTTS } from "./speech/useTTS";
import { loadVisit, loadVisitContent, matchedContent } from "./../../state";

const tts = useTTS();

// la visita scelta dal selector
const props = defineProps<{
  currVisit: string;
}>();
// attivato ogni volta che viene cambiata la visita selezionata
watch(
  () => props.currVisit,
  async (newVisitId) => {
    if (!newVisitId) return;
    await loadVisit(newVisitId);
    await loadVisitContent(newVisitId);
  },
  { immediate: true },
);
const currentIndex = ref<number | null>(null);

// gestione delle opzioni
const currentOption = ref<string>("");
const showOptions = ref(false);

function actionHandler(option: string) {
  // comandi di lettura (TTS): intercettati prima del percorso LLM/Info
  if (option === "Leggi") {
    tts.speak(currentArtwork.value?.item.text ?? "");
    showOptions.value = false;
    return;
  }
  if (option === "Ferma lettura") {
    tts.stop();
    showOptions.value = false;
    return;
  }
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
  tts.stop(); // interrompe la lettura quando si cambia o si chiude l'opera
  if (newVal) {
    document.body.classList.add("overflow-hidden");
    // lettura automatica predisposta per un futuro toggle (ora disattivata)
    if (tts.autoRead.value) tts.speak(newVal.item.text);
  } else {
    document.body.classList.remove("overflow-hidden");
  }
});

// pulizia allo smontaggio del componente
onUnmounted(() => {
  tts.stop();
  document.body.classList.remove("overflow-hidden");
});

function navigationHandler(direction: string) {
  if (currentIndex.value != null) {
    if (direction === "next")
      currentIndex.value =
        (currentIndex.value + 1) % matchedContent.value.length;
    else if (direction === "prev")
      currentIndex.value =
        (currentIndex.value - 1 + matchedContent.value.length) %
        matchedContent.value.length;
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
</template>
