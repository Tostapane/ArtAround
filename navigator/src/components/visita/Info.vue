<script setup lang="ts">
/**
 * La risposta a un comando del vocabolario controllato.
 *
 * Due sorgenti, scelte in base al comando: le domande sull'edificio vanno al
 * grafo delle sale ricavato dalla mappa, che risponde prima con la sola zona e su
 * richiesta col percorso passo-passo; tutte le altre vanno all'LLM.
 *
 * `target` e' la destinazione quando la domanda non se la porta dietro: il
 * `data-poi` del servizio toccato, oppure il qid dell'opera verso cui si va. Il
 * grafo non distingue i due casi, quindi qui non c'e' nessun ramo, e per lo
 * stesso motivo la tabella traduce i comandi invece di elencare i servizi: quelli
 * di un museo sono quelli della sua mappa.
 *
 * La domanda resta scritta sopra la risposta, che serve proprio a chi il testo
 * precedente non l'ha capito. Un contatore scarta le risposte in ritardo, cosi'
 * un cambio di lingua non viene sovrascritto da una vecchia.
 *
 * Un'indicazione parte dall'opera piu' vicina se la posizione e' accesa e il
 * calcolo se la sente, altrimenti da quella aperta. Non si cerca la sala esatta
 * perche' il percorso ragiona per sale e un'opera basta a nominarne una. La
 * condizione `sicuro` non e' una raffinatezza: all'apertura la posizione e'
 * l'ingresso con un'incertezza larga quanto il museo. Se partenza e destinazione
 * coincidono si manda vuoto, che per il server vuol dire "dall'ingresso".
 */
import { computed, ref, watch } from "vue";
import { getInfo, getDirections } from "@/api";
import { useTTS } from "./useTTS";
import { language, museum, posizioneAttiva } from "@/state";
import { rank } from "@/localization";
import { labelForCommand } from "../../../../shared/constants";
import { t } from "@/i18n";
import type { Match } from "../../../../shared/types";

const tts = useTTS();
const props = defineProps<{ request: string; about: Match; target: string }>();
defineEmits<{ close: [] }>();

const LOADING = "__loading__";
const ERROR = "__error__";

const responseText = ref(LOADING);
const isLoading = computed(() => responseText.value === LOADING);
const isError = computed(() => responseText.value === ERROR);
const canRead = computed(() => !isLoading.value && !isError.value);

let requestId = 0;

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

/** Vuoto se la domanda e' sull'opera: allora a rispondere e' l'LLM. */
const bersaglio = computed(() => {
  if (props.target) return props.target;
  const comando = POSITIONAL[props.request.trim()];
  if (comando) return comando;
  return "";
});

const canDetail = computed(() => bersaglio.value !== "" && bersaglio.value !== "obstacles");

const title = computed(() => t(labelForCommand(props.request)));

/** L'opera da cui far partire il percorso. Vuoto vuol dire "dall'ingresso". */
function partenza(): string {
  let qui = "";
  if (posizioneAttiva.value) {
    const verdetto = rank();
    if (verdetto && verdetto.sicuro && verdetto.candidati[0]) {
      qui = verdetto.candidati[0].qid;
    }
  }
  // Si parte dall'ANCORA: uno stile non ha un posto sulla pianta, chi lo ascolta si'.
  if (!qui && props.about.anchor) qui = props.about.anchor.qid;
  if (qui === bersaglio.value) return "";
  return qui;
}

async function ask() {
  const cleanRequest = props.request.trim();
  const myId = ++requestId;
  responseText.value = LOADING;

  if (bersaglio.value) {
    try {
      const museumQid = museum.value ? museum.value.qid : "";
      const text = await getDirections(
        museumQid,
        partenza(),
        bersaglio.value,
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
  () => [props.request, props.target, props.about, language.value, detailed.value],
  ask,
  { immediate: true },
);
</script>

<template>
  <section class="lastra p-4" aria-labelledby="info-titolo">
    <div class="flex items-start justify-between gap-2">
      <h3 id="info-titolo" class="text-caption uppercase tracking-wider text-muted">
        {{ title }}
      </h3>
      <div class="flex shrink-0 items-center">
        <button
          v-if="!tts.isSpeaking.value"
          type="button"
          class="icona-mini"
          :disabled="!canRead"
          :aria-label="t('Leggi la risposta ad alta voce')"
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
          :aria-label="t('Ferma la lettura')"
          @click="tts.stop()"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6h12v12H6z" />
          </svg>
        </button>
        <button
          type="button"
          class="icona-mini"
          :aria-label="t('Chiudi la risposta')"
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
        <span class="sr-only">{{ t("Sto cercando la risposta…") }}</span>
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
          {{ t("Non sono riuscito a rispondere.") }}
          <button type="button" class="link" @click="ask">{{ t("Riprova") }}</button>
        </span>
      </div>

      <p v-else class="measure text-small leading-relaxed">{{ responseText }}</p>
    </div>

    <button
      v-if="canDetail && !detailed && canRead"
      type="button"
      class="btn-secondario mt-3"
      @click="detailed = true"
    >
      {{ t("Indicazioni dettagliate") }}
    </button>
  </section>
</template>
