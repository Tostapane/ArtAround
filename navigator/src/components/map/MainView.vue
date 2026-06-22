<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { Dialog, DialogPanel } from "@headlessui/vue";
import Map from "./Map.vue";
import Card from "./Card.vue";
import OptionsBar from "./OptionsBar.vue";
import Info from "./Info.vue";
import QRScanner from "./QRScanner.vue";
import { useTTS } from "./speech/useTTS";
import { useTranslation } from "@/composables/useTranslation";
import { getArtworkPreview } from "@/api";
import {
  loadVisitContent,
  matchedContent,
  visit,
} from "./../../state";
import type { Match } from "../../../../shared/types";

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
    await loadVisitContent(newVisitId);
  },
  { immediate: true },
);

// opera attualmente mostrata: puo' stare DENTRO o FUORI dalla visita (quando
// arriva da una scansione QR). E' la singola fonte di verita' della posizione.
const currentArtwork = ref<Match | null>(null);
// indice dell'ultima opera DELLA visita visitata: serve a far ripartire il
// "Prossimo" dall'ultima tappa reale dopo una deviazione su un'opera fuori visita.
const lastVisitIndex = ref(-1);

const showScanner = ref(false);

// gestione delle opzioni
const currentOption = ref<string>("");
const showOptions = ref(false);

// indice dell'opera corrente DENTRO la visita (-1 se non ne fa parte)
function indexInVisit(): number {
  if (!currentArtwork.value) return -1;
  const id = currentArtwork.value.artwork["@id"];
  return matchedContent.value.findIndex((m) => m.artwork["@id"] === id);
}
const inVisit = computed(() => indexInVisit() >= 0);

// indice di riferimento per la navigazione: la posizione reale se siamo dentro
// la visita, altrimenti l'ultima tappa reale (deviazione su opera fuori visita).
function navBase(): number {
  if (inVisit.value) return indexInVisit();
  return lastVisitIndex.value;
}
const hasNext = computed(() => navBase() + 1 < matchedContent.value.length);
const hasPrev = computed(() => navBase() - 1 >= 0);

// seleziona un'opera DELLA visita per indice (aggiorna anche l'ultima tappa)
function selectIndex(i: number) {
  const match = matchedContent.value[i];
  if (!match) return;
  currentArtwork.value = match;
  lastVisitIndex.value = i;
}

// scansione QR: imposta SOLO la posizione corrente, senza ricaricare nulla e
// senza toccare la progressione della visita (lo stato resta in memoria).
async function onScan(qid: string) {
  showScanner.value = false;
  const i = matchedContent.value.findIndex((m) => m.artwork.qid === qid);
  if (i >= 0) {
    selectIndex(i);
    return;
  }
  // opera fuori dalla visita: la mostriamo comunque (segnalata nella Card),
  // lasciando invariato lastVisitIndex cosi' il "Prossimo" riprende la visita.
  try {
    let level = "";
    let duration = 0;
    if (visit.value) {
      level = visit.value.level;
      duration = visit.value.duration;
    }
    currentArtwork.value = await getArtworkPreview(qid, level, duration);
  } catch (err) {
    console.error("Impossibile caricare l'opera scansionata", err);
  }
}

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
  // comandi di navigazione (vocali): equivalgono ai pulsanti della Card
  if (option === "Prossimo") {
    navigationHandler("next");
    showOptions.value = false;
    return;
  }
  if (option === "Precedente") {
    navigationHandler("prev");
    showOptions.value = false;
    return;
  }
  currentOption.value = option;
  showOptions.value = false;
}

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

// "Prossimo"/"Precedente" puntano alla VERA opera successiva/precedente rispetto
// alla posizione reale; ai bordi non fanno nulla (la Card disabilita i pulsanti).
function navigationHandler(direction: string) {
  if (direction === "close") {
    currentArtwork.value = null;
    return;
  }
  const base = navBase();
  if (direction === "next") {
    const target = base + 1;
    if (target < matchedContent.value.length) selectIndex(target);
  } else if (direction === "prev") {
    const target = base - 1;
    if (target >= 0) selectIndex(target);
  }
}
</script>

<template>
  <Map @select="selectIndex" />

  <!-- Scanner QR: disponibile durante una visita; imposta la posizione corrente -->
  <button
    v-if="matchedContent.length"
    type="button"
    @click="showScanner = true"
    aria-label="Scansiona il QR di un'opera"
    class="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-medium text-on-accent shadow-lg transition-opacity hover:opacity-90"
  >
    <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 15h5v5h-5z" />
    </svg>
    Scansiona QR
  </button>

  <QRScanner v-if="showScanner" @scan="onScan" @close="showScanner = false" />

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
            :in-visit="inVisit"
            :has-next="hasNext"
            :has-prev="hasPrev"
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
