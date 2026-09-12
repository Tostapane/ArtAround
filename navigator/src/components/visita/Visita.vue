<script setup lang="ts">
/**
 * Orchestra avanzamento, logistica, mappa, scheda, localizzazione e fine della
 * visita. Le tappe opzionali e quelle aperte da QR non alterano la progressione
 * principale.
 */
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useSensors } from "@/composables/useSensors";
import { nodeOf, reanchor, startAtEntrance } from "@/localization";
import Stage from "./Stage.vue";
import Scheda from "./Scheda.vue";
import Attesa from "../Attesa.vue";
import Posizione from "./Posizione.vue";
import { marketplaceHome } from "@/config";
import { useTTS } from "./useTTS";
import { useTranslation } from "@/composables/useTranslation";
import { useAnnouncer } from "@/composables/useAnnouncer";
import { getArtworkPreview } from "@/api";
import {
  stopName,
  stopSubtitle,
  includeOptional,
  isOptionalItem,
  loadVisitContent,
  map,
  notesAfter,
  openingNotes,
  matchedContent,
  stageView,
  setStageView,
  visit,
  posizioneAttiva,
  setPosizioneAttiva,
  currentArtwork,
  lastVisitIndex,
  openingShown,
} from "@/state";
import {
  guidedActive,
  guidedRole,
  guidedStato,
  guidedRevision,
  guidedCurrentStep,
  guidedPlayAt,
  guidedAudioText,
  guidedAudioLanguage,
  guidedHasQuiz,
  teacherGoToStep,
  studentAsk,
} from "@/guided";
import {
  guidedAutoplayEnabled,
  playGuidedAudio,
  stopGuidedAudio,
} from "./guidedAudio";
import { NEXT_STOP_COMMAND, labelForCommand } from "../../../../shared/constants";
import { t } from "@/i18n";
import type { Match } from "../../../../shared/types";

const props = defineProps<{ currVisit: string; title: string }>();
const emit = defineEmits<{ exit: []; quiz: []; toggleAudio: [] }>();

const tts = useTTS();
const { announce } = useAnnouncer();

const caricando = ref(true);

watch(
  () => props.currVisit,
  async (id) => {
    if (!id) return;
    caricando.value = true;
    await loadVisitContent(id);
    caricando.value = false;
    const guidedStep = guidedActive.value ? guidedCurrentStep.value : -1;
    if (guidedStep >= 0) selectIndex(guidedStep);
    const opening = openingNotes();
    if (opening.length && !openingShown.value) {
      transition.value = {
        notes: opening,
        target: guidedStep,
        navigateOnClose: guidedStep < 0,
      };
      openingShown.value = true;
    }
  },
  { immediate: true },
);

// --- Le quattro schede del telefono ----------------------------------------
type VistaMobile = "mappa" | "elenco" | "opera" | "domande";
const vistaMobile = ref<VistaMobile>(stageView.value);

function apriVista(v: VistaMobile) {
  vistaMobile.value = v;
  if (v === "mappa" || v === "elenco") setStageView(v);
}

const schedaVisibile = computed(
  () => vistaMobile.value === "opera" || vistaMobile.value === "domande",
);

// --- Posizione corrente ----------------------------------------------------
const showLocator = ref(false);

const sensori = useSensors();
watch(map, () => startAtEntrance(), { immediate: true });

function apriPosizione() {
  showLocator.value = true;
  if (posizioneAttiva.value) sensori.start();
}

function cambiaPosizione(attiva: boolean) {
  setPosizioneAttiva(attiva);
  if (attiva) sensori.start();
  else sensori.stop();
}
const transition = ref<{
  notes: string[];
  target: number;
  navigateOnClose: boolean;
} | null>(null);

const fine = ref<{ notes: string[] } | null>(null);

function tornaAllaHome() {
  window.location.href = marketplaceHome();
}

function indexInVisit(): number {
  if (!currentArtwork.value) return -1;
  const id = currentArtwork.value.item["@id"];
  return matchedContent.value.findIndex((m) => m.item["@id"] === id);
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

const canEnd = computed(() => {
  if (guidedActive.value) return false;
  if (guidedStudent.value) return false;
  if (lastVisitIndex.value < 0) return false;
  return !hasNext.value;
});
const canStartQuiz = computed(
  () =>
    guidedTeacher.value &&
    guidedHasQuiz.value &&
    lastVisitIndex.value >= 0 &&
    !hasNext.value,
);

// --- Avanzamento: "Tappa 3 di 13" -----------------------------------------
const navigableStops = computed(() =>
  matchedContent.value.filter(
    (m) => includeOptional.value || !isOptionalItem(m.item["@id"]),
  ),
);
const currentPosition = computed(() => {
  if (!currentArtwork.value) return 0;
  const id = currentArtwork.value.item["@id"];
  return navigableStops.value.findIndex((m) => m.item["@id"] === id) + 1;
});

const progresso = computed(() => {
  const totale = navigableStops.value.length;
  const qui = currentPosition.value;
  if (qui === 0) {
    const tutte = totale === 1 ? t("1 tappa") : t("{n} tappe", { n: totale });
    return { esteso: tutte, compatto: tutte };
  }
  return {
    esteso: t("Tappa {n} di {m}", { n: qui, m: totale }),
    compatto: `${qui}/${totale}`,
  };
});

function selectIndex(i: number) {
  const match = matchedContent.value[i];
  if (!match) return;
  currentArtwork.value = match;
  lastVisitIndex.value = i;
  vistaMobile.value = "opera";
  const pos = currentPosition.value;
  if (pos > 0) {
    announce(
      t("Tappa {n} di {m}: {nome}", {
        n: pos,
        m: navigableStops.value.length,
        nome: stopName(match),
      }),
    );
  } else {
    announce(stopName(match));
  }
}

function onStageSelect(i: number) {
  if (guidedStudent.value) {
    if (i === guidedCurrentStep.value) selectIndex(i);
    return;
  }
  if (guidedTeacher.value) {
    apriTappa(i);
    return;
  }
  selectIndex(i);
}

const currentLocationId = computed(() => {
  if (currentArtwork.value) {
    const ancora = currentArtwork.value.anchor;
    if (ancora) return ancora.locationId;
    return "";
  }
  if (guidedStudent.value) {
    const match = matchedContent.value[guidedCurrentStep.value];
    if (match && match.anchor) return match.anchor.locationId;
  }
  return "";
});

const azioneTappa = computed(() => {
  if (guidedStudent.value) return null;
  if (currentArtwork.value) return null;
  if (navigableStops.value.length === 0) return null;
  return { label: t("Inizia dalla prima tappa"), index: stepIndex(-1, 1) };
});

function apriTappaCorrente() {
  const azione = azioneTappa.value;
  if (!azione || azione.index < 0) return;
  selectIndex(azione.index);
}

// --- Navigazione -----------------------------------------------------------
async function goToIndex(i: number, closeOpenTransition = true): Promise<boolean> {
  if (closeOpenTransition) transition.value = null;
  if (guidedTeacher.value) {
    if (await teacherGoToStep(i)) {
      selectIndex(i);
      return true;
    }
    return false;
  }
  selectIndex(i);
  return true;
}

function showTransition(
  notes: string[],
  target: number,
  navigateOnClose: boolean,
) {
  transition.value = { notes, target, navigateOnClose };
  announce(notes.join(". "));
}

function navigationHandler(direction: string) {
  if (guidedStudent.value) return;
  const base = navBase();
  const target = stepIndex(base, direction === "next" ? 1 : -1);
  if (target < 0) {
    if (
      direction === "next" &&
      lastVisitIndex.value >= 0 &&
      !guidedActive.value
    ) {
      const notes = currentArtwork.value
        ? notesAfter(currentArtwork.value.item["@id"])
        : [];
      fine.value = { notes };
      announce(t("Visita completata"));
    }
    return;
  }

  if (direction === "next" && currentArtwork.value) {
    const notes = notesAfter(currentArtwork.value.item["@id"]);
    if (notes.length > 0) {
      if (guidedTeacher.value) {
        showTransition(notes, target, false);
        void goToIndex(target, false);
      } else {
        showTransition(notes, target, true);
      }
      return;
    }
  }
  void goToIndex(target);
}

function closeTransition() {
  const t = transition.value;
  transition.value = null;
  if (!t) return;
  if (!t.navigateOnClose) return;
  if (t.target >= 0) {
    void goToIndex(t.target);
    return;
  }
  const primo = stepIndex(-1, 1);
  if (primo >= 0) void goToIndex(primo);
}

function apriTappa(i: number) {
  let notes: string[] = [];
  if (i === 0) {
    if (!openingShown.value) {
      notes = openingNotes();
      openingShown.value = true;
    }
  } else {
    const precedente = matchedContent.value[i - 1];
    if (precedente) notes = notesAfter(precedente.item["@id"]);
  }
  if (notes.length > 0 && i !== indexInVisit()) {
    if (guidedTeacher.value) {
      showTransition(notes, i, false);
      void goToIndex(i, false);
    } else {
      showTransition(notes, i, true);
    }
    return;
  }
  void goToIndex(i);
}

// --- Teletrasporto (slide 34) ----------------------------------------------
const teletrasportoArmato = ref(false);

function armaTeletrasporto() {
  showLocator.value = false;
  teletrasportoArmato.value = true;
  apriVista("mappa");
  announce(t("Teletrasporto pronto: tocca la pianta nel punto in cui ti trovi."));
}

function annullaTeletrasporto() {
  teletrasportoArmato.value = false;
  announce(t("Teletrasporto annullato"));
}

function teletrasportaSuPunto(x: number, y: number) {
  reanchor(x, y);
  teletrasportoArmato.value = false;
  announce(t("Posizione aggiornata"));
}

function teletrasportaSuTappa(i: number) {
  const match = matchedContent.value[i];
  if (!match) return;
  const ancora = match.anchor;
  if (!ancora) {
    announce(t("Non so dove si trovi questa tappa sulla pianta"));
    return;
  }
  const nodo = nodeOf(ancora.qid);
  if (!nodo) {
    announce(t("Non so dove si trovi quest'opera sulla pianta"));
    return;
  }
  reanchor(nodo.x, nodo.y);
  teletrasportoArmato.value = false;
  announce(t("Sei accanto a {nome}", { nome: ancora.name }));
}

function onKeyTeletrasporto(e: KeyboardEvent) {
  if (e.key === "Escape") annullaTeletrasporto();
}
watch(teletrasportoArmato, (armato) => {
  if (armato) window.addEventListener("keydown", onKeyTeletrasporto);
  else window.removeEventListener("keydown", onKeyTeletrasporto);
});

async function goToArtwork(qid: string) {
  showLocator.value = false;

  const nodo = nodeOf(qid);
  if (nodo) reanchor(nodo.x, nodo.y);

  const i = matchedContent.value.findIndex((m) => m.artwork && m.artwork.qid === qid);
  if (i >= 0) {
    apriTappa(i);
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
    const anteprima = await getArtworkPreview(qid, level, duration);
    currentArtwork.value = {
      item: anteprima.item,
      artwork: anteprima.artwork,
      anchor: anteprima.artwork,
    };
    announce(t("{nome}, non fa parte di questa visita", { nome: anteprima.artwork.name }));
  } catch (err) {
    console.error("Impossibile caricare l'opera", err);
    announce(t("Opera non trovata"));
  }
}

// --- Comandi ---------------------------------------------------------------
const openRequest = ref("");

const openTarget = ref("");

const nextAnchorQid = computed(() => {
  if (guidedStudent.value) return "";
  const i = stepIndex(navBase(), 1);
  if (i < 0) return "";
  const stop = matchedContent.value[i];
  if (!stop || !stop.anchor) return "";
  return stop.anchor.qid;
});

const riferimento = computed<Match | null>(() => {
  if (currentArtwork.value) return currentArtwork.value;
  if (lastVisitIndex.value >= 0) {
    const m = matchedContent.value[lastVisitIndex.value];
    if (m) return m;
  }
  const first = matchedContent.value[0];
  if (first) return first;
  return null;
});

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

  if (option === NEXT_STOP_COMMAND) {
    if (!nextAnchorQid.value) {
      announce(t("Non c'è una tappa successiva: sei all'ultima."));
      return;
    }
    openRequest.value = option;
    openTarget.value = nextAnchorQid.value;
    announce(t(labelForCommand(option)));
    return;
  }

  openRequest.value = option;
  openTarget.value = "";
  const art = riferimento.value;
  studentAsk(option, art ? stopName(art) : "");
}

function chiediServizio(servizio: { target: string; label: string }) {
  openRequest.value = servizio.label;
  openTarget.value = servizio.target;
  announce(t("Indicazioni per {nome}", { nome: servizio.label }));
}

function chiudiRisposta() {
  openRequest.value = "";
  openTarget.value = "";
}

const translatedFields = useTranslation(() => {
  const art = currentArtwork.value;
  if (!art) return [];
  return [stopName(art), stopSubtitle(art), art.item.text];
});

watch(currentArtwork, () => {
  chiudiRisposta();
  tts.stop();
});

watch(openRequest, (richiesta) => {
  if (richiesta) vistaMobile.value = "domande";
});

watch(guidedCurrentStep, (step, previousStep) => {
  if (!guidedStudent.value) return;
  if (step < 0) return;
  let notes: string[] = [];
  if (previousStep >= 0 && step > previousStep) {
    const previous = matchedContent.value[previousStep];
    if (previous) notes = notesAfter(previous.item["@id"]);
  }
  selectIndex(step);
  if (notes.length > 0) showTransition(notes, step, false);
});

watch(
  [guidedRevision, guidedStato, guidedAutoplayEnabled],
  () => {
    if (guidedStudent.value && guidedAutoplayEnabled.value) {
      const playAt = guidedPlayAt.value;
      const text = guidedAudioText.value;
      if (playAt && text) {
        void playGuidedAudio(text, guidedAudioLanguage.value, playAt);
        return;
      }
    }
    stopGuidedAudio();
  },
  { immediate: true },
);

onMounted(() => {
  if (guidedCurrentStep.value < 0) return;
  if (guidedStudent.value || guidedTeacher.value) selectIndex(guidedCurrentStep.value);
});

onUnmounted(() => {
  tts.stop();
  stopGuidedAudio();
  sensori.stop();
  window.removeEventListener("keydown", onKeyTeletrasporto);
});
</script>

<template>

  <div class="flex min-h-0 flex-1 flex-col">
  <div class="flex min-h-0 flex-1 flex-col lg:flex-row">

    <div
      class="flex min-h-0 flex-col lg:flex-1"
      :class="schedaVisibile ? 'shrink-0' : 'flex-1'"
    >
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
          <span class="sr-only sm:not-sr-only">{{ t("Esci") }}</span>
        </button>

        <button
          v-if="guidedStudent"
          type="button"
          class="btn-primario shrink-0 px-3"
          :aria-pressed="guidedAutoplayEnabled"
          @click="emit('toggleAudio')"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5 6.5 9H3v6h3.5l4.5 4V5zM15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" />
          </svg>
          {{ guidedAutoplayEnabled ? t("Disattiva audio") : t("Attiva audio") }}
        </button>

        <p class="hidden min-w-0 flex-1 truncate text-small font-medium sm:block">
          {{ title }}
        </p>

        <p
          v-if="navigableStops.length"
          class="tabular ml-auto shrink-0 text-small text-muted"
        >
          <span class="sr-only">{{ progresso.esteso }}</span>
          <span aria-hidden="true" class="sm:hidden">{{ progresso.compatto }}</span>
          <span aria-hidden="true" class="hidden sm:inline">{{ progresso.esteso }}</span>
        </p>
      </div>
      <div
        v-if="navigableStops.length"
        class="h-0.5 shrink-0"
        style="background-color: var(--location-veil)"
        aria-hidden="true"
      >
        <div
          class="h-full transition-[width] duration-200"
          :style="{
            width: (currentPosition / navigableStops.length) * 100 + '%',
            backgroundColor: 'var(--location)',
          }"
        ></div>
      </div>

      <!-- TELETRASPORTO ARMATO -->
      <div v-if="teletrasportoArmato" class="flex shrink-0 items-center gap-3 bg-structure px-3 py-2 text-on-structure">
        <p class="min-w-0 flex-1 text-small font-medium">{{ t("Tocca la pianta nel punto in cui ti trovi.") }}</p>
        <button type="button" class="btn-fantasma-chiaro shrink-0" @click="annullaTeletrasporto">{{ t("Annulla") }}</button>
      </div>

      <!-- PALCOSCENICO -->
      <Stage
        class="min-h-0 flex-1 lg:flex"
        :class="schedaVisibile ? 'hidden' : 'flex'"
        :current-location-id="currentLocationId"
        :current-index="lastVisitIndex"
        :armed="teletrasportoArmato"
        :active="!schedaVisibile"
        @select="onStageSelect"
        @locate="apriPosizione"
        @poi="chiediServizio"
        @teleport-point="teletrasportaSuPunto"
        @teleport-stop="teletrasportaSuTappa"
      />
    </div>

    <Scheda
      class="lg:flex"
      :class="schedaVisibile ? 'flex' : 'hidden'"
      :sezione="vistaMobile"
      :content="currentArtwork"
      :fields="translatedFields"
      :riferimento="riferimento"
      :azione="azioneTappa"
      :in-visit="inVisit"
      :optional="currentArtwork ? isOptionalItem(currentArtwork.item['@id']) : false"
      :has-next="hasNext"
      :has-prev="hasPrev"
      :can-end="canEnd"
      :can-start-quiz="canStartQuiz"
      :numero="currentPosition"
      :guided-student="guidedStudent"
      :guided-teacher="guidedTeacher"
      :richiesta="openRequest"
      :target="openTarget"
      :can-ask-next="nextAnchorQid !== ''"
      @navigation="navigationHandler"
      @action="actionHandler"
      @close-request="chiudiRisposta"
      @apri-tappa="apriTappaCorrente"
      @quiz="emit('quiz')"
    />

    <div v-if="caricando" class="fixed inset-0 z-50 flex items-center justify-center bg-bg">
      <Attesa :testo="t('Caricamento delle visite…')" />
    </div>

    <div
      v-if="transition"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transizione-titolo"
    >
      <div class="lastra flex max-h-[85dvh] w-full max-w-md flex-col p-6 shadow-l2">
        <p
          id="transizione-titolo"
          class="shrink-0 text-caption uppercase tracking-wider text-muted"
        >
          {{ transition.target < 0 ? t("Prima di cominciare") : t("Verso la prossima tappa") }}
        </p>
        <ul class="mt-3 flex min-h-0 flex-col gap-3 overflow-y-auto">
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
        <div class="mt-6 flex shrink-0 gap-3">
          <button
            type="button"
            class="btn-secondario"
            @click="tts.speak(transition.notes.join('. '))"
          >
            {{ t("Leggi") }}
          </button>
          <button type="button" class="btn-primario flex-1 justify-center" @click="closeTransition">
            {{ t("Continua") }}
          </button>
        </div>
      </div>
    </div>

    <!-- FINE DELLA VISITA -->
    <div
      v-if="fine"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fine-titolo"
    >
      <div class="lastra flex max-h-[85dvh] w-full max-w-md flex-col p-6 shadow-l2">
        <p class="shrink-0 text-caption uppercase tracking-wider text-muted">
          {{ title }}
        </p>
        <h2 id="fine-titolo" class="mt-1 shrink-0 font-display text-title-1">
          {{ t("Visita completata.") }}
        </h2>
        <p class="mt-2 shrink-0 text-body text-muted">
          {{
            navigableStops.length === 1
              ? t("Hai visto l'unica tappa del percorso.")
              : t("Hai visto tutte le {n} tappe del percorso.", { n: navigableStops.length })
          }}
        </p>

        <ul v-if="fine.notes.length" class="mt-5 flex min-h-0 flex-col gap-3 overflow-y-auto">
          <li
            v-for="(n, i) in fine.notes"
            :key="i"
            class="flex items-start gap-3 text-body leading-snug"
          >
            <svg class="mt-1 h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.4" />
            </svg>
            <span>{{ n }}</span>
          </li>
        </ul>

        <div class="mt-6 flex shrink-0 flex-col gap-2">
          <button type="button" class="btn-primario justify-center" @click="tornaAllaHome">
            {{ t("Torna alla home") }}
          </button>
          <button type="button" class="btn-secondario justify-center" @click="fine = null">
            {{ t("Resta nella visita") }}
          </button>
        </div>
      </div>
    </div>

    <Posizione
      v-if="showLocator"
      :sensor-error="sensori.error.value"
      :posizione-attiva="posizioneAttiva"
      @cambia-posizione="cambiaPosizione"
      @found="goToArtwork"
      @arm="armaTeletrasporto"
      @close="showLocator = false"
    />
  </div>

    <nav
      class="nav-visita shrink-0 border-t border-line lg:hidden"
      style="padding-bottom: env(safe-area-inset-bottom)"
      role="radiogroup"
      :aria-label="t('Come vedere la visita')"
    >
      <div class="flex">
        <button
          v-for="s in [
            { id: 'mappa', label: t('Mappa') },
            { id: 'elenco', label: t('Elenco') },
            { id: 'opera', label: t('Opera') },
            { id: 'domande', label: t('Domande') },
          ]"
          :key="s.id"
          type="button"
          role="radio"
          :aria-checked="vistaMobile === s.id"
          :data-section="s.id"
          class="nav-visita-tab min-h-12 flex-1 border-b-2 border-transparent px-1 text-small font-medium transition-colors"
          :class="vistaMobile === s.id ? 'nav-visita-tab-attivo' : ''"
          @click="apriVista(s.id as VistaMobile)"
        >
          {{ s.label }}
        </button>
      </div>
    </nav>
  </div>
</template>
