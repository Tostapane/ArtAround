<script setup lang="ts">
/**
 * IL SVOLGIMENTO DELLA VISITA.
 *
 * Tiene insieme tre cose: la guida d'avanzamento ("Tappa 3 di 13", che conta
 * solo le tappe che "Prossimo" raggiungera' davvero), il palcoscenico e la
 * scheda dell'opera.
 *
 * Due comportamenti meritano una spiegazione:
 * - Andando avanti, se l'autore ha lasciato un'indicazione per arrivare
 *   all'opera successiva, la si mostra PRIMA di aprirla; le note d'apertura
 *   compaiono prima della prima tappa. E' lo scopo per cui esistono (slide 21).
 * - Quando la scheda e' aperta a tutto schermo copre il palcoscenico, che
 *   diventa inerte: altrimenti il fuoco da tastiera finisce su controlli
 *   invisibili. Da lg in su la scheda e' una colonna affiancata, non un foglio,
 *   quindi li' non si rende inerte nulla.
 *
 * QR e codice digitato approdano entrambi qui, in `goToArtwork`: un'opera fuori
 * dalla visita viene mostrata comunque, senza toccare la progressione.
 */
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import Stage from "./Stage.vue";
import Scheda from "./Scheda.vue";
import Posizione from "./Posizione.vue";
import { useTTS } from "./useTTS";
import { useTranslation } from "@/composables/useTranslation";
import { useAnnouncer } from "@/composables/useAnnouncer";
import { getArtworkPreview } from "@/api";
import {
  includeOptional,
  isOptionalItem,
  loadVisitContent,
  notesAfter,
  openingNotes,
  matchedContent,
  visit,
} from "@/state";
import {
  guidedActive,
  guidedRole,
  guidedStato,
  guidedCurrentStep,
  teacherGoToStep,
  studentAsk,
} from "@/guided";
import type { Match } from "../../../../shared/types";

const props = defineProps<{ currVisit: string; title: string }>();
const emit = defineEmits<{ exit: [] }>();

const tts = useTTS();
const { announce } = useAnnouncer();

watch(
  () => props.currVisit,
  async (id) => {
    if (!id) return;
    await loadVisitContent(id);
    const opening = openingNotes();
    if (opening.length) transition.value = { notes: opening, target: -1 };
  },
  { immediate: true },
);

const sheetSnap = ref<"riposo" | "media" | "piena">("media");
const wideScreen = ref(false);
if (typeof window !== "undefined" && window.matchMedia) {
  const mq = window.matchMedia("(min-width: 1024px)");
  wideScreen.value = mq.matches;
  mq.addEventListener("change", (e) => (wideScreen.value = e.matches));
}
const stageInert = computed(
  () => sheetSnap.value === "piena" && !wideScreen.value,
);

// --- Posizione corrente ----------------------------------------------------
const currentArtwork = ref<Match | null>(null);
const lastVisitIndex = ref(-1);
const showLocator = ref(false);
const transition = ref<{ notes: string[]; target: number } | null>(null);

function indexInVisit(): number {
  if (!currentArtwork.value) return -1;
  const id = currentArtwork.value.artwork["@id"];
  return matchedContent.value.findIndex((m) => m.artwork["@id"] === id);
}
const inVisit = computed(() => indexInVisit() >= 0);

function navBase(): number {
  if (inVisit.value) return indexInVisit();
  return lastVisitIndex.value;
}

function stepIndex(from: number, step: number): number {
  for (let i = from + step; i >= 0 && i < matchedContent.value.length; i += step) {
    const match = matchedContent.value[i];
    if (!match) return -1;
    if (includeOptional.value || !isOptionalItem(match.item["@id"])) return i;
  }
  return -1;
}

// --- Modalità guidata ------------------------------------------------------
const guidedStudent = computed(
  () =>
    guidedActive.value &&
    guidedRole.value === "studente" &&
    guidedStato.value === "attiva",
);
const guidedTeacher = computed(
  () =>
    guidedActive.value &&
    guidedRole.value === "docente" &&
    guidedStato.value === "attiva",
);

const hasNext = computed(() => {
  if (guidedStudent.value) return false;
  return stepIndex(navBase(), 1) >= 0;
});
const hasPrev = computed(() => {
  if (guidedStudent.value) return false;
  return stepIndex(navBase(), -1) >= 0;
});

// --- Avanzamento: "Tappa 3 di 13" -----------------------------------------
const navigableStops = computed(() =>
  matchedContent.value.filter(
    (m) => includeOptional.value || !isOptionalItem(m.item["@id"]),
  ),
);
const currentPosition = computed(() => {
  if (!currentArtwork.value) return 0;
  const id = currentArtwork.value.artwork["@id"];
  return navigableStops.value.findIndex((m) => m.artwork["@id"] === id) + 1;
});

function selectIndex(i: number) {
  const match = matchedContent.value[i];
  if (!match) return;
  currentArtwork.value = match;
  lastVisitIndex.value = i;
  const pos = currentPosition.value;
  if (pos > 0) {
    announce(`Tappa ${pos} di ${navigableStops.value.length}: ${match.artwork.name}`);
  } else {
    announce(match.artwork.name);
  }
}

function onStageSelect(i: number) {
  if (guidedStudent.value) {
    if (i === guidedCurrentStep.value) selectIndex(i);
    return;
  }
  selectIndex(i);
  if (guidedTeacher.value) teacherGoToStep(i);
}

const currentLocationId = computed(() => {
  if (currentArtwork.value) return currentArtwork.value.artwork.locationId;
  if (guidedStudent.value) {
    const match = matchedContent.value[guidedCurrentStep.value];
    if (match) return match.artwork.locationId;
  }
  return "";
});

// --- Navigazione -----------------------------------------------------------
function goToIndex(i: number) {
  transition.value = null;
  selectIndex(i);
  if (guidedTeacher.value) teacherGoToStep(i);
}

function navigationHandler(direction: string) {
  if (direction === "close") {
    currentArtwork.value = null;
    return;
  }
  if (guidedStudent.value) return;
  const base = navBase();
  const target = stepIndex(base, direction === "next" ? 1 : -1);
  if (target < 0) return;

  if (direction === "next" && currentArtwork.value) {
    const notes = notesAfter(currentArtwork.value.item["@id"]);
    if (notes.length > 0) {
      transition.value = { notes, target };
      announce(notes.join(". "));
      return;
    }
  }
  goToIndex(target);
}

function closeTransition() {
  const t = transition.value;
  transition.value = null;
  if (!t) return;
  if (t.target >= 0) goToIndex(t.target);
}

async function goToArtwork(qid: string) {
  showLocator.value = false;
  const i = matchedContent.value.findIndex((m) => m.artwork.qid === qid);
  if (i >= 0) {
    selectIndex(i);
    return;
  }
  try {
    let level = "";
    let duration = 0;
    if (visit.value) level = visit.value.level;
    const first = matchedContent.value[0];
    if (first) {
      const sec = parseInt(first.item.timeRequired, 10);
      if (!isNaN(sec)) duration = sec;
    }
    currentArtwork.value = await getArtworkPreview(qid, level, duration);
    announce(`${currentArtwork.value.artwork.name}, non fa parte di questa visita`);
  } catch (err) {
    console.error("Impossibile caricare l'opera", err);
    announce("Opera non trovata");
  }
}

// --- Comandi ---------------------------------------------------------------
const openRequest = ref("");

function actionHandler(option: string) {
  if (option === "Leggi") {
    tts.speak(translatedFields.value[2]);
    return;
  }
  if (option === "Ferma lettura") {
    tts.stop();
    return;
  }
  if (option === "Prossimo") return navigationHandler("next");
  if (option === "Precedente") return navigationHandler("prev");

  openRequest.value = option;
  const art = currentArtwork.value;
  studentAsk(option, art ? art.artwork.name : "");
}

const translatedFields = useTranslation(() => {
  const art = currentArtwork.value;
  if (!art) return [];
  return [art.artwork.name, art.artwork.author.name, art.item.text];
});

watch(currentArtwork, () => {
  openRequest.value = "";
  tts.stop();
});

watch(guidedCurrentStep, (step) => {
  if (!guidedStudent.value) return;
  if (step < 0) return;
  selectIndex(step);
});

onMounted(() => {
  if (guidedCurrentStep.value < 0) return;
  if (guidedStudent.value || guidedTeacher.value) selectIndex(guidedCurrentStep.value);
});

onUnmounted(() => tts.stop());
</script>

<template>
  <div class="flex flex-1 flex-col lg:flex-row">
    <div class="flex min-h-0 flex-1 flex-col">
      <div
        class="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-3 py-2"
      >
        <button
          type="button"
          class="btn-fantasma shrink-0 px-2"
          @click="emit('exit')"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19 8 12l7-7" />
          </svg>
          <span class="sr-only sm:not-sr-only">Esci</span>
        </button>

        <p class="min-w-0 flex-1 truncate text-small font-medium">{{ title }}</p>

        <p
          v-if="navigableStops.length"
          class="tabular shrink-0 text-small text-muted"
        >
          <span v-if="currentPosition > 0">
            Tappa {{ currentPosition }} di {{ navigableStops.length }}
          </span>
          <span v-else>{{ navigableStops.length }} tappe</span>
        </p>
      </div>
      <div
        v-if="navigableStops.length"
        class="h-0.5 shrink-0 bg-surface-2"
        aria-hidden="true"
      >
        <div
          class="h-full bg-accent transition-[width] duration-200"
          :style="{ width: (currentPosition / navigableStops.length) * 100 + '%' }"
        ></div>
      </div>

      <!-- PALCOSCENICO -->
      <Stage
        class="min-h-0 flex-1"
        :current-location-id="currentLocationId"
        :current-index="lastVisitIndex"
        :inert="stageInert"
        @select="onStageSelect"
        @locate="showLocator = true"
      />
    </div>

    <Scheda
      v-if="currentArtwork"
      :content="currentArtwork"
      :fields="translatedFields"
      :in-visit="inVisit"
      :optional="isOptionalItem(currentArtwork.item['@id'])"
      :has-next="hasNext"
      :has-prev="hasPrev"
      :numero="currentPosition"
      :totale="navigableStops.length"
      :guided-student="guidedStudent"
      :guided-teacher="guidedTeacher"
      :richiesta="openRequest"
      @navigation="navigationHandler"
      @action="actionHandler"
      @close-request="openRequest = ''"
      @snap="sheetSnap = $event"
    />

    <div
      v-if="transition"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transizione-titolo"
    >
      <div class="lastra w-full max-w-md p-6 shadow-l2">
        <p
          id="transizione-titolo"
          class="text-caption uppercase tracking-wider text-muted"
        >
          {{ transition.target < 0 ? "Prima di cominciare" : "Verso la prossima tappa" }}
        </p>
        <ul class="mt-3 flex flex-col gap-3">
          <li
            v-for="(n, i) in transition.notes"
            :key="i"
            class="flex items-start gap-3 text-title-3 leading-snug"
          >
            <svg class="mt-1 h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.4" />
            </svg>
            <span>{{ n }}</span>
          </li>
        </ul>
        <div class="mt-6 flex gap-3">
          <button
            type="button"
            class="btn-secondario"
            @click="tts.speak(transition.notes.join('. '))"
          >
            Leggi
          </button>
          <button type="button" class="btn-primario flex-1 justify-center" @click="closeTransition">
            Continua
          </button>
        </div>
      </div>
    </div>

    <Posizione
      v-if="showLocator"
      @found="goToArtwork"
      @close="showLocator = false"
    />
  </div>
</template>
