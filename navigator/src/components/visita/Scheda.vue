<script setup lang="ts">
/**
 * LA SCHEDA — la didascalia dell'opera, ingrandita.
 *
 * Non e' piu' una finestra che copre la mappa: e' un foglio che sale dal basso,
 * con tre altezze. "Che cos'e' questo" e "dove sono" erano le due domande del
 * visitatore, e il disegno precedente costringeva a sceglierne una.
 *   riposo — numero, titolo, ascolto, avanti/indietro; non e' modale, dietro si
 *            continua a navigare col Tab.
 *   media  — immagine, autore, testo. E' l'altezza con cui si apre una tappa.
 *   piena  — aggiunge Chiedi e Orientati.
 * Da lg in su non e' un foglio ma una colonna, e non e' mai modale.
 *
 * Chiedi e Orientati sono separati perche' sono domande di natura diversa, a
 * sistemi diversi: la prima riguarda l'opera e risponde l'LLM, la seconda
 * riguarda l'edificio e risponde il grafo ricavato dalla mappa.
 *
 * Il microfono e' un controllo permanente del piede, non un'opzione nascosta:
 * per chi non vede e' l'ingresso principale all'applicazione.
 */
import { computed, ref, watch, nextTick } from "vue";
import Pannello from "./Pannello.vue";
import Comando from "./Comando.vue";
import { useTTS } from "./useTTS";
import { labelForCommand } from "../../../../shared/constants";
import { mediaOrigin } from "@/config";
import { language, setLanguage } from "@/state";
import { languages } from "../../../../shared/constants";
import type { Match } from "../../../../shared/types";

const props = defineProps<{
  content: Match;
  fields: string[];
  inVisit: boolean;
  optional: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  numero: number;
  totale: number;
  guidedStudent: boolean;
  guidedTeacher: boolean;
  richiesta: string;
}>();

const emit = defineEmits<{
  navigation: [value: string];
  action: [value: string];
  closeRequest: [];
  snap: [value: "riposo" | "media" | "piena"];
}>();

const tts = useTTS();
const snap = ref<"riposo" | "media" | "piena">("media");
const sheet = ref<HTMLElement | null>(null);

watch(snap, (v) => emit("snap", v), { immediate: true });

watch(
  () => props.content,
  () => {
    snap.value = "media";
  },
);

watch(
  () => props.richiesta,
  (r) => {
    if (r) snap.value = "piena";
  },
);

async function expand() {
  snap.value = snap.value === "piena" ? "media" : "piena";
  if (snap.value === "piena") {
    await nextTick();
    if (sheet.value) sheet.value.focus();
  }
}

function collapse() {
  if (snap.value === "piena") snap.value = "media";
  else if (snap.value === "media") snap.value = "riposo";
}

const nextLabel = computed(() => {
  if (props.guidedTeacher) return "Porta tutti alla prossima opera";
  return labelForCommand("Prossimo");
});

const imgBroken = ref(false);
watch(() => props.content, () => (imgBroken.value = false));
const imgSrc = computed(() => {
  const a = props.content.artwork;
  if (a && a.imagePath) {
    return a.imagePath.startsWith("http")
      ? a.imagePath
      : mediaOrigin() + a.imagePath;
  }
  return (a && a.imageUri) || "";
});

const height = computed(() => {
  if (snap.value === "riposo") return "max-h-[6.5rem]";
  if (snap.value === "media") return "max-h-[62dvh]";
  return "max-h-[92dvh]";
});
</script>

<template>
  <!-- Velo: solo a foglio pieno, e solo sul telefono -->
  <div
    v-if="snap === 'piena'"
    class="fixed inset-0 z-30 bg-black/50 lg:hidden"
    aria-hidden="true"
    @click="snap = 'media'"
  ></div>

  <section
    ref="sheet"
    tabindex="-1"
    :aria-label="'Tappa corrente: ' + fields[0]"
    :role="snap === 'piena' ? 'dialog' : undefined"
    :aria-modal="snap === 'piena' ? 'true' : undefined"
    class="fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-card border border-line
           bg-surface shadow-l2 transition-[max-height] duration-200 ease-[var(--ease-aa)]
           lg:static lg:z-auto lg:w-[26rem] lg:shrink-0 lg:rounded-none lg:border-y-0
           lg:border-r-0 lg:shadow-none"
    :class="[height, 'lg:!max-h-none']"
    style="padding-bottom: env(safe-area-inset-bottom)"
    @keydown.escape="collapse"
  >
    <!-- ===== RIPOSO: sempre visibile ===== -->
    <div class="flex shrink-0 items-center gap-3 border-b border-line p-3">
      <span
        v-if="numero > 0"
        class="tabular shrink-0 font-display text-title-2 text-muted"
        aria-hidden="true"
      >
        {{ String(numero).padStart(2, "0") }}
      </span>

      <!-- L'invito ad aprire era una didascalia grigia sotto al titolo: si
           leggeva come una descrizione, non come una cosa da premere. Ora e' una
           pastiglia con la freccia che ruota — la stessa forma che altrove nel
           prodotto vuol dire "si preme". -->
      <button
        type="button"
        class="group min-w-0 flex-1 text-left"
        :aria-expanded="snap === 'piena'"
        @click="expand"
      >
        <span class="block truncate font-display text-title-3 leading-tight">
          {{ fields[0] }}
        </span>
        <span
          class="pastiglia mt-1.5 gap-1.5 transition-colors group-hover:border-accent
                 group-hover:text-accent"
        >
          <svg
            class="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
            :class="snap === 'piena' ? 'rotate-180' : ''"
            fill="none"
            stroke="currentColor"
            stroke-width="2.25"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m6 15 6-6 6 6" />
          </svg>
          {{ snap === "piena" ? "Riduci" : "Apri la scheda" }}
        </span>
      </button>

      <button
        v-if="!tts.isSpeaking.value"
        type="button"
        class="icona-tonda shrink-0"
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

      <button
        type="button"
        class="icona-tonda shrink-0"
        aria-label="Chiudi la scheda"
        @click="emit('navigation', 'close')"
      >
        <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- ===== MEDIA e PIENA ===== -->
    <div v-show="snap !== 'riposo'" class="min-h-0 flex-1 overflow-y-auto">
      <div v-if="imgSrc && !imgBroken" class="mat rounded-none border-x-0 border-t-0">
        <img
          :src="imgSrc"
          :alt="'Immagine dell\'opera: ' + content.artwork.name"
          @error="imgBroken = true"
        />
      </div>

      <div class="p-4">
        <p class="text-small text-muted">
          {{ fields[1] }}
          <span v-if="content.artwork.style && content.artwork.style.name">
            · {{ content.artwork.style.name }}
          </span>
        </p>

        <p v-if="!inVisit" class="pastiglia pastiglia-ardesia mt-3">Non fa parte di questa visita</p>
        <p v-else-if="optional" class="pastiglia pastiglia-ardesia mt-3">Tappa opzionale</p>

        <p class="measure mt-4 text-body">{{ fields[2] }}</p>

        <div v-show="snap === 'piena'" class="mt-8 border-t border-line pt-5">
          <Pannello
            :about="content"
            :richiesta="richiesta"
            id-prefix="scheda"
            @action="(a) => emit('action', a)"
            @close-request="emit('closeRequest')"
          />

          <div class="mt-8 border-t border-line pt-4">
            <label for="lingua-scheda" class="text-caption uppercase tracking-wider text-muted">
              Lingua dei contenuti
            </label>
            <select
              id="lingua-scheda"
              class="campo-select mt-2 w-full"
              :value="language.translate"
              @change="
                setLanguage(
                  languages.find(
                    (l) => l.translate === ($event.target as HTMLSelectElement).value,
                  )!,
                )
              "
            >
              <option v-for="l in languages" :key="l.translate" :value="l.translate">
                {{ l.name }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Piede: navigazione + voce ===== -->
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

      <Comando class="flex-1" @action="(a) => emit('action', a)" />

      <button
        v-if="!guidedStudent"
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

      <p v-if="guidedStudent" class="flex-1 text-center text-caption text-muted">
        La tappa la decide il docente
      </p>
    </div>
  </section>
</template>
