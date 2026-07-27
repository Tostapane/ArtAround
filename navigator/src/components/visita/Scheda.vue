<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import Info from "./Info.vue";
import Comando from "./Comando.vue";
import { useTTS } from "./useTTS";
import { options, labelForCommand } from "../../../../shared/constants";
import { mediaOrigin } from "@/config";
import { language, setLanguage } from "@/state";
import { languages } from "../../../../shared/constants";
import type { Match } from "../../../../shared/types";

/**
 * LA SCHEDA — la didascalia, ingrandita.
 *
 * Non è più una finestra modale che copre la mappa: è un foglio che sale dal
 * basso, con tre altezze. "Che cos'è questo" e "dove sono" erano le due domande
 * del visitatore, e il vecchio disegno costringeva a sceglierne una.
 *   riposo  — numero, titolo, ascolto, avanti/indietro. Non è modale: dietro si
 *             continua a navigare con il Tab.
 *   media   — immagine, autore, testo. È l'altezza con cui si apre una tappa.
 *   piena   — aggiunge Chiedi e Orientati. Solo qui il palcoscenico diventa
 *             inerte, perché il foglio copre lo schermo.
 * Da lg in su non è un foglio: è una colonna, e non è mai modale.
 */

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
  chiudiRichiesta: [];
  snap: [value: "riposo" | "media" | "piena"];
}>();

const tts = useTTS();
const snap = ref<"riposo" | "media" | "piena">("media");
const scheda = ref<HTMLElement | null>(null);
const tab = ref<"chiedi" | "orientati">("chiedi");

watch(snap, (v) => emit("snap", v), { immediate: true });

// Aprendo una nuova opera il foglio torna all'altezza media.
watch(
  () => props.content,
  () => {
    snap.value = "media";
    tab.value = "chiedi";
  },
);

// Una richiesta in corso ha bisogno di spazio: il foglio si apre da solo.
watch(
  () => props.richiesta,
  (r) => {
    if (r) snap.value = "piena";
  },
);

async function espandi() {
  snap.value = snap.value === "piena" ? "media" : "piena";
  if (snap.value === "piena") {
    await nextTick();
    if (scheda.value) scheda.value.focus();
  }
}

function riduci() {
  if (snap.value === "piena") snap.value = "media";
  else if (snap.value === "media") snap.value = "riposo";
}

const comandiChiedi = computed(() => options.filter((o) => o.surface === "chiedi"));
const comandiOrientati = computed(() =>
  options.filter((o) => o.surface === "orientati"),
);

const etichettaProssimo = computed(() => {
  // Un docente che preme "Prossimo" sta muovendo trenta persone: dirlo.
  if (props.guidedTeacher) return "Porta tutti alla prossima opera";
  return labelForCommand("Prossimo");
});

// Sorgente immagine: prima quella scaricata sul server, poi quella remota.
const imgRotta = ref(false);
watch(() => props.content, () => (imgRotta.value = false));
const imgSrc = computed(() => {
  const a = props.content.artwork;
  if (a && a.imagePath) {
    return a.imagePath.startsWith("http")
      ? a.imagePath
      : mediaOrigin() + a.imagePath;
  }
  return (a && a.imageUri) || "";
});

const altezza = computed(() => {
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
    ref="scheda"
    tabindex="-1"
    :aria-label="'Tappa corrente: ' + fields[0]"
    :role="snap === 'piena' ? 'dialog' : undefined"
    :aria-modal="snap === 'piena' ? 'true' : undefined"
    class="fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-card border border-line
           bg-surface shadow-l2 transition-[max-height] duration-200 ease-[var(--ease-aa)]
           lg:static lg:z-auto lg:w-[26rem] lg:shrink-0 lg:rounded-none lg:border-y-0
           lg:border-r-0 lg:shadow-none"
    :class="[altezza, 'lg:!max-h-none']"
    style="padding-bottom: env(safe-area-inset-bottom)"
    @keydown.escape="riduci"
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

      <button
        type="button"
        class="min-w-0 flex-1 text-left"
        :aria-expanded="snap === 'piena'"
        @click="espandi"
      >
        <span class="block truncate font-display text-title-3 leading-tight">
          {{ fields[0] }}
        </span>
        <span class="block truncate text-caption text-muted">
          {{ snap === "piena" ? "Riduci la scheda" : "Apri la scheda" }}
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
      <div v-if="imgSrc && !imgRotta" class="mat rounded-none border-x-0 border-t-0">
        <img
          :src="imgSrc"
          :alt="'Immagine dell\'opera: ' + content.artwork.name"
          @error="imgRotta = true"
        />
      </div>

      <div class="p-4">
        <p class="text-small text-muted">
          {{ fields[1] }}
          <span v-if="content.artwork.style && content.artwork.style.name">
            · {{ content.artwork.style.name }}
          </span>
        </p>

        <p v-if="!inVisit" class="pastiglia mt-3">Non fa parte di questa visita</p>
        <p v-else-if="optional" class="pastiglia mt-3">Tappa opzionale</p>

        <p class="measure mt-4 text-body">{{ fields[2] }}</p>

        <!-- ===== Chiedi / Orientati: due sistemi, due domande diverse ===== -->
        <div v-show="snap === 'piena'" class="mt-8 border-t border-line pt-5">
          <div class="segmenti" role="tablist" aria-label="Che cosa vuoi chiedere">
            <button
              type="button"
              role="tab"
              :aria-selected="tab === 'chiedi'"
              class="segmento"
              :class="tab === 'chiedi' ? 'segmento-attivo' : ''"
              @click="tab = 'chiedi'"
            >
              Chiedi
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="tab === 'orientati'"
              class="segmento"
              :class="tab === 'orientati' ? 'segmento-attivo' : ''"
              @click="tab = 'orientati'"
            >
              Orientati
            </button>
          </div>

          <p class="mt-3 text-caption text-muted">
            {{
              tab === "chiedi"
                ? "Domande su quest'opera."
                : "Domande sull'edificio: dove si trovano le cose."
            }}
          </p>

          <div class="mt-3 flex flex-col gap-2">
            <button
              v-for="o in tab === 'chiedi' ? comandiChiedi : comandiOrientati"
              :key="o.id"
              type="button"
              class="comando"
              :class="richiesta === o.id ? 'comando-attivo' : ''"
              :aria-describedby="o.hint ? 'hint-' + o.id : undefined"
              @click="emit('action', o.id)"
            >
              {{ o.label }}
              <span v-if="o.hint" :id="'hint-' + o.id" class="sr-only">{{ o.hint }}</span>
            </button>
          </div>

          <!-- La risposta -->
          <Info
            v-if="richiesta"
            class="mt-4"
            :request="richiesta"
            :about="content"
            @close="emit('chiudiRichiesta')"
          />

          <!-- La lingua si cambia QUI: ci si accorge di averne bisogno durante
               la visita, non alla biglietteria. -->
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

      <!-- Il microfono è un controllo permanente, non un'opzione nascosta:
           per chi non vede è l'ingresso principale, non un'alternativa. -->
      <Comando class="flex-1" @action="(a) => emit('action', a)" />

      <button
        v-if="!guidedStudent"
        type="button"
        class="btn-primario"
        :disabled="!hasNext"
        :aria-label="etichettaProssimo"
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
