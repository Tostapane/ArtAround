<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { getInfo, getDirections } from "@/api";
import { useTTS } from "./useTTS";
import { language, museum } from "@/state";
import { labelForCommand } from "../../../../shared/constants";
import type { Match } from "../../../../shared/types";

const tts = useTTS();
const props = defineProps<{ request: string; about: Match }>();
defineEmits<{ close: [] }>();

const LOADING = "__loading__";
const ERROR = "__error__";

const responseText = ref(LOADING);
const isLoading = computed(() => responseText.value === LOADING);
const isError = computed(() => responseText.value === ERROR);
const canRead = computed(() => !isLoading.value && !isError.value);

// Identifica la richiesta più recente: una risposta vecchia che arriva in
// ritardo (es. dopo un cambio di lingua) non sovrascrive quella nuova.
let requestId = 0;

/**
 * Comandi che riguardano l'EDIFICIO: risponde il grafo ricavato dalla mappa,
 * non l'LLM sull'opera. Sono domande di natura diversa, con modi di fallire
 * diversi: per questo nella scheda stanno in due sezioni separate.
 */
const POSITIONAL: Record<string, string> = {
  "Dove esco?": "exit",
  "Dove e il bagno?": "toilet",
  "Dove e il bar?": "bar",
  "Dove e lo shop?": "shop",
  "Ci sono ostacoli?": "obstacles",
};

const detailed = ref(false);
watch(
  () => props.request,
  () => (detailed.value = false),
);

const canDetail = computed(() => {
  const target = POSITIONAL[props.request.trim()];
  return !!target && target !== "obstacles";
});

const titolo = computed(() => labelForCommand(props.request));

async function chiedi() {
  const cleanRequest = props.request.trim();
  const myId = ++requestId;
  responseText.value = LOADING;

  const target = POSITIONAL[cleanRequest];
  if (target) {
    try {
      const museumQid = museum.value ? museum.value.qid : "";
      const text = await getDirections(
        museumQid,
        props.about.artwork.qid,
        target,
        language.value.name,
        detailed.value,
      );
      if (myId !== requestId) return;
      responseText.value = text || ERROR;
    } catch {
      if (myId !== requestId) return;
      responseText.value = ERROR;
    }
    return;
  }

  // Richiesta sul contenuto dell'opera. I comandi del vocabolario controllato
  // vengono riformulati; una richiesta libera (non mappata) va così com'è.
  let request = cleanRequest;
  switch (cleanRequest) {
    case "Non ho capito":
      request = "Spiegalo con parole diverse";
      break;
    case "Sintetizza":
      request = "Riassumi il testo in meno parole";
      break;
    case "Approfondisci":
      request = "Approfondisci";
      break;
    case "Semplifica":
      request = "Spiegalo in maniera più semplice";
      break;
    case "Chi e' l'autore?":
      request = "Dimmi di più sull'autore e sulla sua vita";
      break;
    case "Che stile e?":
      request = "Raccontami di più sullo stile di cui quest'opera fa parte";
      break;
  }

  try {
    const text = await getInfo(
      props.about.item.text,
      request,
      language.value.name,
    );
    if (myId !== requestId) return;
    responseText.value = text;
  } catch {
    if (myId !== requestId) return;
    responseText.value = ERROR;
  }
}

watch(
  () => [props.request, props.about, language.value, detailed.value],
  chiedi,
  { immediate: true },
);
</script>

<template>
  <section class="lastra p-4" aria-labelledby="info-titolo">
    <div class="flex items-start justify-between gap-2">
      <!-- La domanda resta scritta sopra la risposta: senza, la risposta perde
           il suo riferimento appena si distoglie lo sguardo. -->
      <h3 id="info-titolo" class="text-caption uppercase tracking-wider text-muted">
        {{ titolo }}
      </h3>
      <div class="flex shrink-0 items-center">
        <button
          v-if="!tts.isSpeaking.value"
          type="button"
          class="icona-mini"
          :disabled="!canRead"
          aria-label="Leggi la risposta ad alta voce"
          @click="tts.speak(responseText)"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
          </svg>
        </button>
        <button
          v-else
          type="button"
          class="icona-mini text-accent"
          aria-label="Ferma la lettura"
          @click="tts.stop()"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6h12v12H6z" />
          </svg>
        </button>
        <button
          type="button"
          class="icona-mini"
          aria-label="Chiudi la risposta"
          @click="$emit('close')"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <div class="mt-2" aria-live="polite" :aria-busy="isLoading">
      <!-- Attesa: un blocco fermo, niente luccichii -->
      <div v-if="isLoading" class="flex flex-col gap-2">
        <span class="sr-only">Sto cercando la risposta…</span>
        <span class="h-3 w-full rounded-plate bg-surface-2" aria-hidden="true"></span>
        <span class="h-3 w-11/12 rounded-plate bg-surface-2" aria-hidden="true"></span>
        <span class="h-3 w-3/5 rounded-plate bg-surface-2" aria-hidden="true"></span>
      </div>

      <div v-else-if="isError" class="flex items-start gap-2 text-small text-danger" role="alert">
        <svg class="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4 2.5 20h19z" />
          <path stroke-linecap="round" d="M12 10v4" />
        </svg>
        <span>
          Non sono riuscito a rispondere.
          <button type="button" class="link" @click="chiedi">Riprova</button>
        </span>
      </div>

      <p v-else class="measure text-small leading-relaxed">{{ responseText }}</p>
    </div>

    <!-- Il percorso passo-passo resta a disposizione di chi si è perso -->
    <button
      v-if="canDetail && !detailed && canRead"
      type="button"
      class="btn-secondario mt-3"
      @click="detailed = true"
    >
      Indicazioni dettagliate
    </button>
  </section>
</template>
