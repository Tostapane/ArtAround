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
 *
 * Il TELETRASPORTO cambia il significato di un tocco sul palcoscenico, quindi lo
 * stato sta qui: si arma da "Dove sono?", una striscia lo dichiara finche' dura,
 * e dura un tocco solo — una modalita' e' una cosa in cui si resta intrappolati.
 */
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useSensors } from "@/composables/useSensors";
import { nodeOf, reanchor, startAtEntrance } from "@/localization";
import Stage from "./Stage.vue";
import Scheda from "./Scheda.vue";
import Posizione from "./Posizione.vue";
import Pannello from "./Pannello.vue";
import { marketplaceHome } from "@/config";
import { useTTS } from "./useTTS";
import { useTranslation } from "@/composables/useTranslation";
import { useAnnouncer } from "@/composables/useAnnouncer";
import { getArtworkPreview } from "@/api";
import {
  includeOptional,
  isOptionalItem,
  loadVisitContent,
  map,
  notesAfter,
  openingNotes,
  matchedContent,
  setStageView,
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

/**
 * I sensori partono col tocco che apre "Dove sono?" — iOS concede il permesso
 * per l'orientamento solo dentro un gesto dell'utente, e quello e' il gesto — e
 * NON si spengono richiudendo il pannello: il segnalino sulla pianta deve
 * continuare a seguire chi cammina. Muoversi pero' non apre mai una scheda: a
 * decidere e' solo la pressione del bottone.
 */
const sensori = useSensors();
watch(map, () => startAtEntrance(), { immediate: true });

function apriPosizione() {
  showLocator.value = true;
  sensori.start();
}
const transition = ref<{ notes: string[]; target: number } | null>(null);

/** Percorso finito: si mostra la chiusura, con la via di casa in evidenza. */
const fine = ref<{ notes: string[] } | null>(null);

/** Il pannello dei comandi aperto dalla barra della visita (slide 27-28). */
const pannelloAperto = ref(false);

function tornaAllaHome() {
  window.location.href = marketplaceHome();
}

/**
 * La posizione si cerca sull'ITEM, non sull'opera. Una visita puo' avere piu'
 * item per lo stesso oggetto — la slide 21 dice che dovrebbe averne — e
 * cercando per opera la seconda descrizione ritrovava sempre l'indice della
 * prima: "Prossimo" riportava alla tappa gia' vista e la visita si bloccava li'.
 */
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
  if (target < 0) {
    // Fine del percorso: prima non succedeva nulla e la visita non finiva mai.
    // In visita guidata no: li' la chiusura la decide il docente, che dopo
    // l'ultima opera fa partire il quiz.
    if (
      direction === "next" &&
      lastVisitIndex.value >= 0 &&
      !guidedActive.value
    ) {
      const notes = currentArtwork.value
        ? notesAfter(currentArtwork.value.item["@id"])
        : [];
      fine.value = { notes };
      announce("Visita completata");
    }
    return;
  }

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

/**
 * Aprire una tappa a cui si e' arrivati: prima l'indicazione logistica scritta
 * per quel passaggio, poi la scheda. E' lo stesso passo intermedio di
 * "Prossimo", ed e' il secondo scopo che la slide 33 assegna alla
 * localizzazione. Se la tappa e' gia' quella aperta la nota non si ripete.
 */
function apriTappa(i: number) {
  let notes: string[] = [];
  if (i === 0) {
    notes = openingNotes();
  } else {
    const precedente = matchedContent.value[i - 1];
    if (precedente) notes = notesAfter(precedente.item["@id"]);
  }
  if (notes.length > 0 && i !== indexInVisit()) {
    transition.value = { notes, target: i };
    announce(notes.join(". "));
    return;
  }
  selectIndex(i);
}

// --- Teletrasporto (slide 34) ----------------------------------------------
const teletrasportoArmato = ref(false);

/** Sposta la posizione e basta: non apre la scheda e non fa avanzare la visita —
 *  dichiarare dove si e' e decidere cosa leggere sono due atti diversi. */
function armaTeletrasporto() {
  showLocator.value = false;
  teletrasportoArmato.value = true;
  setStageView("mappa");
  announce("Teletrasporto pronto: tocca la pianta nel punto in cui ti trovi.");
}

function annullaTeletrasporto() {
  teletrasportoArmato.value = false;
  announce("Teletrasporto annullato");
}

/** Su un punto qualunque non c'e' un nome da dire: quale opera sia e' il
 *  mestiere di "Trovami", non di chi sposta. */
function teletrasportaSuPunto(x: number, y: number) {
  reanchor(x, y);
  teletrasportoArmato.value = false;
  announce("Posizione aggiornata");
}

/** Una tappa: la "posizione predeterminata" accanto all'opera (slide 34). */
function teletrasportaSuTappa(i: number) {
  const match = matchedContent.value[i];
  if (!match) return;
  const nodo = nodeOf(match.artwork.qid);
  if (!nodo) {
    announce("Non so dove si trovi quest'opera sulla pianta");
    return;
  }
  reanchor(nodo.x, nodo.y);
  teletrasportoArmato.value = false;
  announce(`Sei accanto a ${match.artwork.name}`);
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

  // Dire dove si e' ri-ancora il sistema di coordinate: da qui in poi i passi
  // si contano da questo punto, non da dove il GPS credeva di essere.
  const nodo = nodeOf(qid);
  if (nodo) reanchor(nodo.x, nodo.y);

  const i = matchedContent.value.findIndex((m) => m.artwork.qid === qid);
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
    currentArtwork.value = await getArtworkPreview(qid, level, duration);
    announce(`${currentArtwork.value.artwork.name}, non fa parte di questa visita`);
  } catch (err) {
    console.error("Impossibile caricare l'opera", err);
    announce("Opera non trovata");
  }
}

// --- Comandi ---------------------------------------------------------------
const openRequest = ref("");

/**
 * L'opera a cui si riferiscono le domande del pannello. Se la scheda e' chiusa
 * vale l'ultima tappa aperta, e in mancanza di tutto la prima della visita:
 * "dov'e' il bagno?" deve poter partire da dove ci si trova, non richiedere di
 * aprire prima una didascalia.
 */
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

  openRequest.value = option;
  const art = riferimento.value;
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

onUnmounted(() => {
  tts.stop();
  sensori.stop();
  window.removeEventListener("keydown", onKeyTeletrasporto);
});
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

        <!-- I comandi del vocabolario controllato, sempre a un tocco: prima
             erano raggiungibili solo aprendo la scheda a tutta altezza. -->
        <button
          type="button"
          class="btn-secondario shrink-0 px-2"
          :aria-expanded="pannelloAperto"
          aria-label="Chiedi qualcosa"
          @click="pannelloAperto = true"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.5 9a2.5 2.5 0 1 1 3.2 2.4c-.7.2-1.2.9-1.2 1.6v.5" />
            <circle cx="11.5" cy="17" r=".7" fill="currentColor" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z" />
          </svg>
          <span class="sr-only sm:not-sr-only">Chiedi</span>
        </button>

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

      <!-- TELETRASPORTO ARMATO -->
      <div v-if="teletrasportoArmato" class="flex shrink-0 items-center gap-3 bg-structure px-3 py-2 text-on-structure">
        <p class="min-w-0 flex-1 text-small font-medium">Tocca la pianta nel punto in cui ti trovi.</p>
        <button type="button" class="btn-fantasma-chiaro shrink-0" @click="annullaTeletrasporto">Annulla</button>
      </div>

      <!-- PALCOSCENICO -->
      <Stage
        class="min-h-0 flex-1"
        :current-location-id="currentLocationId"
        :current-index="lastVisitIndex"
        :armed="teletrasportoArmato"
        :inert="stageInert"
        @select="onStageSelect"
        @locate="apriPosizione"
        @teleport-point="teletrasportaSuPunto"
        @teleport-stop="teletrasportaSuTappa"
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

    <!-- PANNELLO DEI COMANDI -->
    <div
      v-if="pannelloAperto"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center"
      @click.self="pannelloAperto = false"
    >
      <aside
        class="lastra flex max-h-[85dvh] w-full max-w-md flex-col overflow-y-auto p-5 shadow-l2"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pannello-titolo"
        @keydown.escape="pannelloAperto = false"
      >
        <div class="flex shrink-0 items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 id="pannello-titolo" class="font-display text-title-3">
              Chiedi qualcosa
            </h2>
            <p v-if="riferimento" class="truncate text-caption text-muted">
              {{ riferimento.artwork.name }}
            </p>
          </div>
          <button
            type="button"
            class="icona-mini shrink-0"
            aria-label="Chiudi il pannello"
            @click="pannelloAperto = false"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <Pannello
          class="mt-4"
          :about="riferimento"
          :richiesta="openRequest"
          id-prefix="pannello"
          @action="actionHandler"
          @close-request="openRequest = ''"
        />
      </aside>
    </div>

    <!-- FINE DELLA VISITA -->
    <div
      v-if="fine"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fine-titolo"
    >
      <div class="lastra w-full max-w-md p-6 shadow-l2">
        <p class="text-caption uppercase tracking-wider text-muted">
          {{ title }}
        </p>
        <h2 id="fine-titolo" class="mt-1 font-display text-title-1">
          Visita completata.
        </h2>
        <p class="mt-2 text-body text-muted">
          Hai visto tutte le
          <span class="tabular">{{ navigableStops.length }}</span>
          {{ navigableStops.length === 1 ? "tappa" : "tappe" }} del percorso.
        </p>

        <ul v-if="fine.notes.length" class="mt-5 flex flex-col gap-3">
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

        <div class="mt-6 flex flex-col gap-2">
          <button type="button" class="btn-primario justify-center" @click="tornaAllaHome">
            Torna alla home
          </button>
          <button type="button" class="btn-secondario justify-center" @click="fine = null">
            Resta nella visita
          </button>
        </div>
      </div>
    </div>

    <Posizione
      v-if="showLocator"
      :sensor-error="sensori.error.value"
      @found="goToArtwork"
      @arm="armaTeletrasporto"
      @close="showLocator = false"
    />
  </div>
</template>
