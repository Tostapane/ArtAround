<script setup lang="ts">
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
  logisticaDopo,
  logisticaIniziale,
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

const props = defineProps<{ currVisit: string; titolo: string }>();
const emit = defineEmits<{ esci: [] }>();

const tts = useTTS();
const { announce } = useAnnouncer();

watch(
  () => props.currVisit,
  async (id) => {
    if (!id) return;
    await loadVisitContent(id);
    // Le note d'apertura ("l'ingresso è da via Garibaldi 2") si mostrano prima
    // della prima tappa: sono parte della visita quanto le descrizioni.
    const iniziali = logisticaIniziale();
    if (iniziali.length) transizione.value = { note: iniziali, target: -1 };
  },
  { immediate: true },
);

/**
 * Quando la scheda è aperta a tutto schermo copre il palcoscenico: quello che
 * sta sotto deve diventare irraggiungibile anche col Tab, altrimenti il fuoco
 * finisce su controlli invisibili. Da lg in su la scheda NON è un foglio ma una
 * colonna affiancata, quindi lì non si rende inerte nulla.
 */
const snapScheda = ref<"riposo" | "media" | "piena">("media");
const schermoLargo = ref(false);
if (typeof window !== "undefined" && window.matchMedia) {
  const mq = window.matchMedia("(min-width: 1024px)");
  schermoLargo.value = mq.matches;
  mq.addEventListener("change", (e) => (schermoLargo.value = e.matches));
}
const stageInerte = computed(
  () => snapScheda.value === "piena" && !schermoLargo.value,
);

// --- Posizione corrente ----------------------------------------------------
const currentArtwork = ref<Match | null>(null);
const lastVisitIndex = ref(-1);
const showPosizione = ref(false);
/** Passaggio fra una tappa e la successiva: mostra le indicazioni logistiche */
const transizione = ref<{ note: string[]; target: number } | null>(null);

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

/** Prossima tappa navigabile: salta le opzionali a interruttore spento. */
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
/** Le tappe che contano davvero per la navigazione, cioè quelle che
 *  Prossimo raggiungerà: il numero mostrato deve combaciare con quello. */
const tappeNavigabili = computed(() =>
  matchedContent.value.filter(
    (m) => includeOptional.value || !isOptionalItem(m.item["@id"]),
  ),
);
const posizioneCorrente = computed(() => {
  if (!currentArtwork.value) return 0;
  const id = currentArtwork.value.artwork["@id"];
  return tappeNavigabili.value.findIndex((m) => m.artwork["@id"] === id) + 1;
});

function selectIndex(i: number) {
  const match = matchedContent.value[i];
  if (!match) return;
  currentArtwork.value = match;
  lastVisitIndex.value = i;
  const pos = posizioneCorrente.value;
  if (pos > 0) {
    announce(`Tappa ${pos} di ${tappeNavigabili.value.length}: ${match.artwork.name}`);
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
function vaiAllIndice(i: number) {
  transizione.value = null;
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

  // Andando AVANTI, se l'autore ha lasciato un'indicazione per arrivare alla
  // prossima opera, la si mostra prima: è esattamente il suo scopo (slide 21).
  if (direction === "next" && currentArtwork.value) {
    const note = logisticaDopo(currentArtwork.value.item["@id"]);
    if (note.length > 0) {
      transizione.value = { note, target };
      announce(note.join(". "));
      return;
    }
  }
  vaiAllIndice(target);
}

function chiudiTransizione() {
  const t = transizione.value;
  transizione.value = null;
  if (!t) return;
  if (t.target >= 0) vaiAllIndice(t.target);
}

/** Teletrasporto e QR condividono lo stesso approdo: impostano la posizione. */
async function vaiAOpera(qid: string) {
  showPosizione.value = false;
  const i = matchedContent.value.findIndex((m) => m.artwork.qid === qid);
  if (i >= 0) {
    selectIndex(i);
    return;
  }
  // Opera fuori dalla visita: la mostriamo comunque, senza toccare il percorso.
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
const richiestaAperta = ref("");

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

  richiestaAperta.value = option;
  const art = currentArtwork.value;
  studentAsk(option, art ? art.artwork.name : "");
}

// Traduzione live di titolo, autore e testo dell'opera corrente. Vive qui
// (non dentro la scheda) così il comando "Leggi" riusa lo stesso testo.
const translatedFields = useTranslation(() => {
  const art = currentArtwork.value;
  if (!art) return [];
  return [art.artwork.name, art.artwork.author.name, art.item.text];
});

watch(currentArtwork, () => {
  richiestaAperta.value = "";
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
    <!-- ========== Colonna principale: guida + palcoscenico ========== -->
    <div class="flex min-h-0 flex-1 flex-col">
      <!-- GUIDA D'AVANZAMENTO: dove sei, in una visita che è una sequenza -->
      <div
        class="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-3 py-2"
      >
        <button
          type="button"
          class="btn-fantasma shrink-0 px-2"
          @click="emit('esci')"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19 8 12l7-7" />
          </svg>
          <span class="sr-only sm:not-sr-only">Esci</span>
        </button>

        <p class="min-w-0 flex-1 truncate text-small font-medium">{{ titolo }}</p>

        <p
          v-if="tappeNavigabili.length"
          class="tabular shrink-0 text-small text-muted"
        >
          <span v-if="posizioneCorrente > 0">
            Tappa {{ posizioneCorrente }} di {{ tappeNavigabili.length }}
          </span>
          <span v-else>{{ tappeNavigabili.length }} tappe</span>
        </p>
      </div>
      <!-- Barra di avanzamento: informazione ridondante al testo, non sostitutiva -->
      <div
        v-if="tappeNavigabili.length"
        class="h-0.5 shrink-0 bg-surface-2"
        aria-hidden="true"
      >
        <div
          class="h-full bg-accent transition-[width] duration-200"
          :style="{ width: (posizioneCorrente / tappeNavigabili.length) * 100 + '%' }"
        ></div>
      </div>

      <!-- PALCOSCENICO -->
      <Stage
        class="min-h-0 flex-1"
        :current-location-id="currentLocationId"
        :current-index="lastVisitIndex"
        :inert="stageInerte"
        @select="onStageSelect"
        @posizione="showPosizione = true"
      />
    </div>

    <!-- ========== LA SCHEDA ==========
         Sul telefono è un foglio che sale dal basso sopra la mappa: "che cos'è
         questo" e "dove sono" smettono di escludersi a vicenda. Da lg in su
         diventa una colonna a destra e non è mai modale. -->
    <Scheda
      v-if="currentArtwork"
      :content="currentArtwork"
      :fields="translatedFields"
      :in-visit="inVisit"
      :optional="isOptionalItem(currentArtwork.item['@id'])"
      :has-next="hasNext"
      :has-prev="hasPrev"
      :numero="posizioneCorrente"
      :totale="tappeNavigabili.length"
      :guided-student="guidedStudent"
      :guided-teacher="guidedTeacher"
      :richiesta="richiestaAperta"
      @navigation="navigationHandler"
      @action="actionHandler"
      @chiudi-richiesta="richiestaAperta = ''"
      @snap="snapScheda = $event"
    />

    <!-- ========== Passaggio fra due tappe: le indicazioni logistiche ========== -->
    <div
      v-if="transizione"
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
          {{ transizione.target < 0 ? "Prima di cominciare" : "Verso la prossima tappa" }}
        </p>
        <ul class="mt-3 flex flex-col gap-3">
          <li
            v-for="(n, i) in transizione.note"
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
            @click="tts.speak(transizione.note.join('. '))"
          >
            Leggi
          </button>
          <button type="button" class="btn-primario flex-1 justify-center" @click="chiudiTransizione">
            Continua
          </button>
        </div>
      </div>
    </div>

    <!-- ========== Dove sono: QR o codice digitato ========== -->
    <Posizione
      v-if="showPosizione"
      @trovata="vaiAOpera"
      @close="showPosizione = false"
    />
  </div>
</template>
