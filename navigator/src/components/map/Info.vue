<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { getInfo } from "@/api";
import { useTTS } from "./speech/useTTS";
import type { Match } from "../../../../shared/types";

const tts = useTTS();
const props = defineProps<{
  request: string;
  about: Match;
}>();
defineEmits<{ close: [] }>();

const LOADING = "Caricamento…";
const ERROR = "Errore nel caricamento delle informazioni.";

const responseText = ref(LOADING);
const isLoading = computed(() => responseText.value === LOADING);
// la risposta e' leggibile solo quando c'e' un testo reale
const canRead = computed(
  () => responseText.value !== LOADING && responseText.value !== ERROR,
);

// traduce il comando controllato in una richiesta per l'LLM
watch(
  () => [props.request, props.about],
  async () => {
    let request = "no";
    const cleanRequest = props.request.trim();
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
      case "Dove esco?":
      case "Dove e il bagno?":
      case "Dove e il bar?":
      case "Dove e lo shop?":
      case "Ci sono ostacoli?":
        request = "no";
        break;
    }

    responseText.value = LOADING;
    try {
      responseText.value = await getInfo(props.about.item.text, request);
    } catch (e) {
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
