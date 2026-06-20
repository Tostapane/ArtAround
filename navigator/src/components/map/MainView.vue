<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { Dialog, DialogPanel } from "@headlessui/vue";
import Map from "./Map.vue";
import Card from "./Card.vue";
import OptionsBar from "./OptionsBar.vue";
import Info from "./Info.vue";
import { useTTS } from "./speech/useTTS";
import { useTranslation } from "@/composables/useTranslation";
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
    tts.speak(translatedFields.value[2]);
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

// traduzione live di titolo, autore e descrizione dell'opera corrente.
// Vive qui (non dentro Card) cosi' anche il comando "Leggi" puo' leggere la
// descrizione gia' tradotta senza ritradurla. translatedFields = [titolo, autore, testo]
const translatedFields = useTranslation(() => {
  const art = currentArtwork.value;
  if (!art) return [];
  return [art.artwork.name, art.artwork.author.name, art.item.text];
});

// quando si cambia o si chiude l'opera: reset opzioni e stop lettura.
// (lo scroll-lock e il focus-trap sono gestiti dal Dialog headless)
watch(currentArtwork, (newVal) => {
  currentOption.value = "";
  showOptions.value = false;
  tts.stop();
  // lettura automatica predisposta per un futuro toggle (ora disattivata)
  if (newVal && tts.autoRead.value) tts.speak(translatedFields.value[2]);
});

onUnmounted(() => {
  tts.stop();
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

  <!--
    Dialog headless: focus-trap, chiusura con Esc, ripristino del focus
    sull'elemento di partenza e aria-modal automatici.
  -->
  <Dialog
    :open="!!currentArtwork"
    @close="navigationHandler('close')"
    class="relative z-50"
  >
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

    <div class="fixed inset-0 overflow-y-auto p-4 sm:p-6">
      <div class="flex min-h-full items-center justify-center">
        <DialogPanel
          v-if="currentArtwork"
          aria-labelledby="card-title"
          class="flex w-full max-w-5xl flex-col gap-4 md:flex-row md:items-stretch"
        >
          <Card
            :content="currentArtwork"
            :fields="translatedFields"
            @navigation="navigationHandler"
            @toggleOptions="showOptions = !showOptions"
            class="md:flex-1"
          />
          <div
            v-if="showOptions || currentOption"
            class="flex w-full flex-col gap-4 md:w-80 md:shrink-0 md:overflow-y-auto"
          >
            <OptionsBar v-if="showOptions" @action="actionHandler" />
            <Info
              v-if="currentOption"
              :request="currentOption"
              :about="currentArtwork"
              @close="currentOption = ''"
            />
          </div>
        </DialogPanel>
      </div>
    </div>
  </Dialog>
</template>
