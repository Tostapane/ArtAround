<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { getInfo, getDirections } from "@/api";
import { useTTS } from "./speech/useTTS";
import { language, museum } from "@/state";
import type { Match } from "../../../../shared/types";

const tts = useTTS();
const props = defineProps<{
  request: string;
  about: Match;
}>();
defineEmits<{ close: [] }>();

const LOADING = "Caricamento…";
const ERROR = "Errore nel caricamento delle informazioni.";

// risposta dell'LLM, gia' generata nella lingua scelta dall'utente
// (nessuna traduzione automatica); LOADING/ERROR fanno da sentinelle
const responseText = ref(LOADING);
const isLoading = computed(() => responseText.value === LOADING);
// la risposta e' leggibile solo quando c'e' un testo reale
const canRead = computed(
  () => responseText.value !== LOADING && responseText.value !== ERROR,
);

// identifica la richiesta LLM piu' recente: una risposta vecchia che arriva in
// ritardo (es. dopo un rapido cambio di lingua) non sovrascrive quella nuova.
let requestId = 0;

// comandi posizionali/logistici -> tipo di destinazione per il wayfinding.
// Sono gestiti dal grafo ricavato dalla mappa, non dall'LLM sull'opera.
const POSITIONAL: Record<string, string> = {
  "Dove esco?": "exit",
  "Dove e il bagno?": "toilet",
  "Dove e il bar?": "bar",
  "Dove e lo shop?": "shop",
  "Ci sono ostacoli?": "obstacles",
};

// traduce il comando controllato in una richiesta per l'LLM.
// Dipende anche dalla lingua: cambiandola, si richiede una nuova risposta
// direttamente nella nuova lingua (l'LLM la genera, non la traduciamo).
watch(
  () => [props.request, props.about, language.value],
  async () => {
    const cleanRequest = props.request.trim();
    const myId = ++requestId; // id di QUESTA richiesta
    responseText.value = LOADING;

    // comandi posizionali: indicazioni logistiche dal sistema di wayfinding.
    const target = POSITIONAL[cleanRequest];
    if (target) {
      try {
        let museumQid = "";
        if (museum.value) museumQid = museum.value.qid;
        const text = await getDirections(
          museumQid,
          props.about.artwork.qid,
          target,
          language.value.name,
        );
        if (myId !== requestId) return;
        if (text) responseText.value = text;
        else responseText.value = ERROR;
      } catch (e) {
        if (myId !== requestId) return;
        responseText.value = ERROR;
      }
      return;
    }

    // altrimenti: richiesta all'LLM sul contenuto dell'opera. I comandi del
    // vocabolario controllato vengono riformulati; una richiesta libera (non
    // mappata da mapRequest) viene inoltrata cosi' com'e' (vocabolario libero).
    let request = cleanRequest;
    switch (cleanRequest) {
      case "Non ho capito":
        request = "Spiegalo con parole diverese";
        break;
      case "Sintetizza":
        request = "Riassumi in meno parole il testo";
        break;
      case "Approfondisci":
        request = "Approfondisci ";
        break;
      case "Semplifica":
        request = "Spiegalo in maniera piu' semplice";
        break;
      case "Chi e' l'autore?":
        request = "Dimmi di piu' su l'autore, e la sua vita";
        break;
      case "Che stile e?":
        request = "Raccontami di piu' sullo stile di cui questa opera fa parte";
        break;
    }

    try {
      const text = await getInfo(
        props.about.item.text,
        request,
        language.value.name,
      );
      // se nel frattempo e' partita una richiesta piu' recente, abbandoniamo
      if (myId !== requestId) return;
      responseText.value = text;
    } catch (e) {
      if (myId !== requestId) return;
      responseText.value = ERROR;
    }
  },
  { immediate: true },
);
</script>

<template>
  <section
    class="flex w-full shrink-0 flex-col rounded-xl border border-border bg-surface p-4"
    aria-labelledby="info-title"
  >
    <div class="mb-2 flex items-start justify-between gap-2">
      <h3
        id="info-title"
        class="text-xs font-bold uppercase tracking-wider text-text"
      >
        {{ request }}
      </h3>
      <div class="flex items-center gap-1">
        <!-- Leggi la risposta -->
        <button
          v-if="!tts.isSpeaking.value"
          type="button"
          :disabled="!canRead"
          @click="tts.speak(responseText)"
          class="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Leggi la risposta ad alta voce"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4.03v8.05A4.5 4.5 0 0016.5 12z"
            />
          </svg>
        </button>
        <button
          v-else
          type="button"
          @click="tts.stop()"
          class="rounded-md p-1.5 text-accent transition-colors hover:bg-surface-2"
          aria-label="Ferma la lettura"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6h12v12H6z" />
          </svg>
        </button>
        <!-- Chiudi -->
        <button
          type="button"
          @click="$emit('close')"
          class="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
          aria-label="Chiudi il riquadro informazioni"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
    <p class="text-sm leading-relaxed text-text" aria-live="polite" :aria-busy="isLoading">
      {{ responseText }}
    </p>
  </section>
</template>
