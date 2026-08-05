<script setup lang="ts">
/**
 * La scheda: la didascalia dell'opera e i comandi, in un pannello sempre aperto.
 *
 * Non e' una finestra ne' un foglio che si apre: e' meta' fissa dello schermo,
 * colonna accanto alla pianta da `lg` in su e fascia sotto di essa sul telefono.
 * Le due domande del visitatore hanno cosi' una risposta ciascuna, tutte e due in
 * vista, senza comandi da scoprire per passare dall'una all'altra.
 *
 * Dall'alto in basso, nell'ordine in cui la si usa: lingua, opera, barra della
 * voce e dell'avanzamento, Chiedi/Orientati. Lingua e barra si cercano senza
 * guardare, quindi stanno ai bordi e non si spostano; opera e comandi si
 * spartiscono il resto in proporzione fissa, e con una risposta aperta la
 * proporzione si ribalta, perche' quella risposta e' il motivo per cui si e'
 * premuto.
 *
 * Senza nessuna tappa aperta al posto dell'opera c'e' la porta d'ingresso della
 * visita: un pannello sempre presente deve dire cosa fare anche quando non c'e'
 * niente da leggere. Le domande invece funzionano da subito, perche'
 * `riferimento` vale l'ultima tappa raggiunta.
 *
 * Chiedi e Orientati sono separati perche' rispondono sistemi diversi: l'LLM per
 * l'opera, il grafo della mappa per l'edificio.
 */
import { computed, ref, watch } from "vue";
import Pannello from "./Pannello.vue";
import Comando from "./Comando.vue";
import { useTTS } from "./useTTS";
import LanguageSelector from "../selection/LanguageSelector.vue";
import { labelForCommand } from "../../../../shared/constants";
import { stopImage } from "@/state";
import { t } from "@/i18n";
import type { Match } from "../../../../shared/types";

const props = defineProps<{
  content: Match | null;
  fields: string[];
  riferimento: Match | null;
  azione: { label: string; index: number } | null;
  inVisit: boolean;
  optional: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  canEnd: boolean;
  numero: number;
  guidedStudent: boolean;
  guidedTeacher: boolean;
  richiesta: string;
  /** La destinazione, se la domanda non la porta con se': servizio o opera. */
  target: string;
  /** Se esiste una tappa successiva verso cui si possa chiedere la strada. */
  canAskNext: boolean;
}>();

const emit = defineEmits<{
  navigation: [value: string];
  action: [value: string];
  closeRequest: [];
  apriTappa: [];
}>();

const tts = useTTS();

const nextLabel = computed(() => {
  if (props.guidedTeacher) return t("Porta tutti alla prossima opera");
  return t(labelForCommand("Prossimo"));
});

// --- L'opera -----------------------------------------------------------------

/** Cambiando tappa il testo riparte dall'inizio: la colonna non scorre da se'. */
const opera = ref<HTMLElement | null>(null);
const imgBroken = ref(false);
watch(
  () => props.content,
  () => {
    imgBroken.value = false;
    if (opera.value) opera.value.scrollTop = 0;
  },
);

const immagine = computed(() => {
  if (!props.content) return { src: "", name: "" };
  return stopImage(props.content);
});

/** Lo stile, che ce l'ha solo un'opera: sotto al nome sta accanto all'autore. */
const stile = computed(() => {
  if (!props.content) return "";
  const a = props.content.artwork;
  if (a && a.style && a.style.name) return a.style.name;
  return "";
});

</script>

<template>
  <section
    :aria-label="t(`Scheda dell'opera e comandi`)"
    class="flex h-[55dvh] shrink-0 flex-col border-t border-line bg-surface
           lg:h-auto lg:w-[26rem] lg:border-l lg:border-t-0"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <!-- LINGUA -->
    <div class="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2">
      <span class="etichetta-impostazione shrink-0" aria-hidden="true">
        {{ t("Lingua") }}
      </span>
      <LanguageSelector
        id="lingua-scheda"
        :etichetta="false"
        class="ml-auto min-w-0 max-w-[11rem]"
      />
    </div>

    <!-- OPERA -->
    <div ref="opera" class="min-h-0 basis-0 overflow-y-auto" :class="richiesta ? 'grow-[2]' : 'grow-[3]'">
      <template v-if="content">
        <!-- Sul telefono l'intestazione e' una didascalia da museo, con la
             miniatura a sinistra del titolo, perche' la colonna e' bassa e una foto a
             piena larghezza se la prenderebbe tutta, lasciando fuori proprio il
             testo. Da `lg` in su c'e' l'altezza per l'opera intera, e li' si
             contiene invece di ritagliare: quella e' l'opera che si sta guardando. -->
        <div class="flex items-start gap-3 p-4 lg:block lg:p-0">
          <img
            v-if="immagine.src && !imgBroken"
            class="figura h-16 w-16 shrink-0 rounded-plate object-cover
                   lg:h-auto lg:max-h-48 lg:w-full lg:rounded-none lg:object-contain"
            :src="immagine.src"
            :alt="t('Immagine di {nome}', { nome: immagine.name })"
            @error="imgBroken = true"
          />

          <div class="min-w-0 lg:p-4 lg:pb-0">
            <div class="flex items-baseline gap-3">
              <span
                v-if="numero > 0"
                class="tabular shrink-0 font-display text-title-3 text-muted lg:text-title-2"
                aria-hidden="true"
              >
                {{ String(numero).padStart(2, "0") }}
              </span>
              <h2 class="min-w-0 font-display text-title-3 leading-tight lg:text-title-2">
                {{ fields[0] }}
              </h2>
            </div>

            <p class="mt-1 text-small text-muted">
              {{ fields[1] }}
              <span v-if="stile">· {{ stile }}</span>
            </p>

            <p v-if="!inVisit" class="pastiglia pastiglia-ardesia mt-3">{{ t("Non fa parte di questa visita") }}</p>
            <p v-else-if="optional" class="pastiglia pastiglia-ardesia mt-3">{{ t("Tappa opzionale") }}</p>
          </div>
        </div>

        <p class="measure px-4 pb-4 text-body lg:pt-4">{{ fields[2] }}</p>
      </template>

      <!-- PORTA D'INGRESSO: nessuna tappa aperta -->
      <div v-else class="p-4">
        <button
          v-if="azione"
          type="button"
          class="btn-primario w-full justify-center text-title-3"
          @click="emit('apriTappa')"
        >
          {{ azione.label }}
        </button>
        <p v-else-if="guidedStudent" class="vuoto">{{ t("La prima tappa la apre il docente.") }}</p>
        <p v-else class="vuoto">{{ t("Questa visita non ha tappe.") }}</p>
      </div>
    </div>

    <!-- BARRA: voce e avanzamento -->
    <div class="flex shrink-0 items-center gap-2 border-t border-line p-3">
      <button
        v-if="!guidedStudent"
        type="button"
        class="btn-secondario"
        :disabled="!hasPrev"
        @click="emit('navigation', 'prev')"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19 8 12l7-7" />
        </svg>
        <span class="sr-only">{{ t(labelForCommand("Precedente")) }}</span>
      </button>

      <button
        v-if="!tts.isSpeaking.value"
        type="button"
        class="icona-tonda shrink-0"
        :disabled="!content"
        :aria-label="t('Leggi la descrizione ad alta voce')"
        @click="emit('action', 'Leggi')"
      >
        <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
        </svg>
      </button>
      <button
        v-else
        type="button"
        class="icona-tonda icona-tonda-attiva shrink-0"
        :aria-label="t('Ferma la lettura')"
        @click="emit('action', 'Ferma lettura')"
      >
        <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6h12v12H6z" />
        </svg>
      </button>

      <Comando
        class="min-w-0 flex-1"
        :tappa="content ? content.item['@id'] : ''"
        @action="(a) => emit('action', a)"
      />

      <button
        v-if="!guidedStudent && !canEnd"
        type="button"
        class="btn-primario"
        :disabled="!hasNext"
        :aria-label="nextLabel"
        @click="emit('navigation', 'next')"
      >
        <span class="hidden sm:inline lg:hidden xl:inline">
          {{ guidedTeacher ? t("Tutti avanti") : t(labelForCommand("Prossimo")) }}
        </span>
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7" />
        </svg>
      </button>

      <button
        v-if="canEnd"
        type="button"
        class="btn-pericolo-pieno"
        :aria-label="t('Termina la visita')"
        @click="emit('navigation', 'next')"
      >
        <span class="hidden sm:inline lg:hidden xl:inline">{{ t("Termina visita") }}</span>
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </button>

      <p v-if="guidedStudent" class="text-center text-caption text-muted">
        {{ t("La tappa la decide il docente") }}
      </p>
    </div>

    <!-- CHIEDI / ORIENTATI -->
    <div
      class="min-h-0 basis-0 overflow-y-auto border-t border-line p-3"
      :class="richiesta ? 'grow-[3]' : 'grow-[2]'"
    >
      <Pannello
        :about="riferimento"
        :richiesta="richiesta"
        :target="target"
        :can-ask-next="canAskNext"
        @action="(a) => emit('action', a)"
        @close-request="emit('closeRequest')"
      />
    </div>
  </section>
</template>
