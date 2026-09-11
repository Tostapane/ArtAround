<script setup lang="ts">
/**
 * Pannello persistente dell'opera con testo, voce, avanzamento e domande. Sul
 * telefono separa contenuto e comandi; su schermi larghi li mostra insieme.
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
  canStartQuiz: boolean;
  numero: number;
  guidedStudent: boolean;
  guidedTeacher: boolean;
  richiesta: string;

  target: string;

  canAskNext: boolean;

  sezione: string;
}>();

const emit = defineEmits<{
  navigation: [value: string];
  action: [value: string];
  closeRequest: [];
  apriTappa: [];
  quiz: [];
}>();

const tts = useTTS();

const nextLabel = computed(() => {
  if (props.guidedTeacher) return t("Porta tutti alla prossima opera");
  return t(labelForCommand("Prossimo"));
});

// --- L'opera -----------------------------------------------------------------

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
    class="flex min-h-0 flex-1 flex-col bg-surface
           lg:h-auto lg:w-[26rem] lg:flex-none lg:border-l lg:border-line"
  >
    <!-- LINGUA -->
    <div
      class="shrink-0 items-center gap-3 border-b border-line px-3 py-2 lg:flex"
      :class="sezione === 'opera' ? 'flex' : 'hidden'"
    >
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
    <div
      ref="opera"
      class="min-h-0 basis-0 overflow-y-auto lg:block"
      :class="[
        richiesta ? 'grow-[2]' : 'grow-[3]',
        sezione === 'opera' ? 'block' : 'hidden',
      ]"
    >
      <template v-if="content">

        <div class="flex items-start gap-3 p-4 lg:block lg:p-0">
          <img
            v-if="immagine.src && !imgBroken"
            class="figura figura-sfumata h-20 w-28 shrink-0 rounded-none object-cover
                   lg:h-auto lg:max-h-48 lg:w-full lg:object-contain"
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

            <p v-if="!inVisit" class="pastiglia pastiglia-ametista mt-3">{{ t("Non fa parte di questa visita") }}</p>
            <p v-else-if="optional" class="pastiglia pastiglia-ametista mt-3">{{ t("Tappa opzionale") }}</p>
          </div>
        </div>

        <p class="measure px-4 pb-4 text-body lg:pt-4">{{ fields[2] }}</p>
      </template>

      <!-- PORTA D'INGRESSO -->
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

    <!-- BARRA -->
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
        v-if="!guidedStudent && !tts.isSpeaking.value"
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
        v-else-if="!guidedStudent"
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
        v-if="!guidedStudent && !canEnd && !canStartQuiz"
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
        v-if="canStartQuiz"
        type="button"
        class="btn-primario"
        :aria-label="t('Quiz di fine visita')"
        @click="emit('quiz')"
      >
        <span>{{ t("Quiz") }}</span>
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h8M8 12h5M8 17h3" />
          <rect x="4" y="3" width="16" height="18" rx="2" />
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
      class="min-h-0 basis-0 overflow-y-auto border-t border-line bg-surface-2 p-3 lg:block"
      :class="[
        richiesta ? 'grow-[3]' : 'grow-[2]',
        sezione === 'domande' ? 'block' : 'hidden',
      ]"
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
