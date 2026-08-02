<script setup lang="ts">
/**
 * LA SCHEDA — la didascalia dell'opera e i comandi, in un pannello sempre aperto.
 *
 * Non e' una finestra e non e' un foglio che si apre: e' meta' fissa dello
 * schermo, una colonna accanto alla pianta da `lg` in su e una fascia sotto di
 * essa sul telefono. Le due domande del visitatore — «che cos'e' questo» e «dove
 * sono» — hanno cosi' una risposta ciascuna, tutte e due in vista, e non c'e'
 * nessun comando da scoprire per passare dall'una all'altra.
 *
 * Dall'alto in basso, che e' l'ordine in cui la si usa: la lingua dei contenuti,
 * l'opera, la barra della voce e dell'avanzamento, Chiedi/Orientati. Lingua e
 * barra sono le due cose che si cercano senza guardare, quindi stanno ai due
 * bordi e non si spostano mai; a spartirsi il resto dell'altezza sono l'opera e
 * i comandi, in proporzione fissa (`grow-[3]` / `grow-[2]`), ognuno con il
 * proprio scorrimento. Con una risposta aperta la proporzione si ribalta: quella
 * risposta e' il motivo per cui si e' premuto.
 *
 * Finche' non c'e' nessuna tappa aperta, al posto dell'opera c'e' la porta
 * d'ingresso della visita: un pannello sempre presente deve dire cosa fare anche
 * quando non c'e' niente da leggere. Le domande invece funzionano da subito,
 * perche' `riferimento` vale l'ultima tappa raggiunta — «dov'e' il bagno?» non
 * richiede di aver aperto prima una didascalia.
 *
 * Chiedi e Orientati sono separati perche' sono domande di natura diversa, a
 * sistemi diversi: la prima riguarda l'opera e risponde l'LLM, la seconda
 * riguarda l'edificio e risponde il grafo ricavato dalla mappa.
 *
 * Il microfono e' un controllo permanente della barra, non un'opzione nascosta:
 * per chi non vede e' l'ingresso principale all'applicazione.
 */
import { computed, ref, watch } from "vue";
import Pannello from "./Pannello.vue";
import Comando from "./Comando.vue";
import { useTTS } from "./useTTS";
import { labelForCommand, languages } from "../../../../shared/constants";
import { mediaOrigin } from "@/config";
import { language, setLanguage } from "@/state";
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
  /** Il servizio toccato sulla pianta, se la domanda viene da li'. */
  target: string;
}>();

const emit = defineEmits<{
  navigation: [value: string];
  action: [value: string];
  closeRequest: [];
  apriTappa: [];
}>();

const tts = useTTS();

const nextLabel = computed(() => {
  if (props.guidedTeacher) return "Porta tutti alla prossima opera";
  return labelForCommand("Prossimo");
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

const imgSrc = computed(() => {
  if (!props.content) return "";
  const a = props.content.artwork;
  if (a.imagePath) {
    return a.imagePath.startsWith("http") ? a.imagePath : mediaOrigin() + a.imagePath;
  }
  if (a.imageUri) return a.imageUri;
  return "";
});

function cambiaLingua(codice: string) {
  const scelta = languages.find((l) => l.translate === codice);
  if (scelta) setLanguage(scelta);
}
</script>

<template>
  <section
    aria-label="Scheda dell'opera e comandi"
    class="flex h-[55dvh] shrink-0 flex-col border-t border-line bg-surface
           lg:h-auto lg:w-[26rem] lg:border-l lg:border-t-0"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <!-- LINGUA -->
    <div class="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2">
      <label
        for="lingua-scheda"
        class="shrink-0 text-caption uppercase tracking-wider text-muted"
      >
        Lingua dei contenuti
      </label>
      <select
        id="lingua-scheda"
        class="campo-select ml-auto min-w-0 max-w-[11rem] flex-1"
        :value="language.translate"
        @change="cambiaLingua(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="l in languages" :key="l.translate" :value="l.translate">
          {{ l.name }}
        </option>
      </select>
    </div>

    <!-- OPERA -->
    <div ref="opera" class="min-h-0 basis-0 overflow-y-auto" :class="richiesta ? 'grow-[2]' : 'grow-[3]'">
      <template v-if="content">
        <!-- Sul telefono l'intestazione e' una didascalia da museo — miniatura a
             sinistra del titolo — perche' la colonna e' alta 200px e una foto a
             piena larghezza se la prenderebbe tutta, lasciando fuori proprio il
             testo. Da `lg` in su c'e' l'altezza per il passe-partout intero. -->
        <div class="flex items-start gap-3 p-4 lg:block lg:p-0">
          <div
            v-if="imgSrc && !imgBroken"
            class="mat h-16 w-16 shrink-0 lg:h-auto lg:max-h-48 lg:w-full lg:rounded-none
                   lg:border-x-0 lg:border-t-0"
          >
            <img
              :src="imgSrc"
              :alt="'Immagine dell\'opera: ' + content.artwork.name"
              @error="imgBroken = true"
            />
          </div>

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
              <span v-if="content.artwork.style && content.artwork.style.name">
                · {{ content.artwork.style.name }}
              </span>
            </p>

            <p v-if="!inVisit" class="pastiglia pastiglia-ardesia mt-3">Non fa parte di questa visita</p>
            <p v-else-if="optional" class="pastiglia pastiglia-ardesia mt-3">Tappa opzionale</p>
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
        <p v-else-if="guidedStudent" class="vuoto">La prima tappa la apre il docente.</p>
        <p v-else class="vuoto">Questa visita non ha tappe.</p>
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
        <span class="sr-only">{{ labelForCommand("Precedente") }}</span>
      </button>

      <button
        v-if="!tts.isSpeaking.value"
        type="button"
        class="icona-tonda shrink-0"
        :disabled="!content"
        aria-label="Leggi la descrizione ad alta voce"
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
        aria-label="Ferma la lettura"
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
          {{ guidedTeacher ? "Tutti avanti" : labelForCommand("Prossimo") }}
        </span>
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7" />
        </svg>
      </button>

      <button
        v-if="canEnd"
        type="button"
        class="btn-pericolo-pieno"
        aria-label="Termina la visita"
        @click="emit('navigation', 'next')"
      >
        <span class="hidden sm:inline lg:hidden xl:inline">Termina visita</span>
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </button>

      <p v-if="guidedStudent" class="text-center text-caption text-muted">
        La tappa la decide il docente
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
        @action="(a) => emit('action', a)"
        @close-request="emit('closeRequest')"
      />
    </div>
  </section>
</template>
