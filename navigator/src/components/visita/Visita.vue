<script setup lang="ts">
/**
 * Lo svolgimento della visita.
 *
 * Tiene insieme la guida d'avanzamento ("Tappa 3 di 13", che conta solo le tappe
 * che "Prossimo" raggiungera' davvero), il palcoscenico e la scheda.
 *
 * Lo schermo e' diviso in due meta' che convivono sempre, pianta e scheda,
 * perche' "dove sono" e "che cos'e' questo" sono due domande che il visitatore si
 * fa insieme: la scheda non copre mai niente e non ha uno stato di apertura. E'
 * anche l'unico posto da cui si chiede qualcosa, cosi' il vocabolario controllato
 * (slide 27-28) sta in un elenco solo.
 *
 * Andando avanti, l'indicazione per raggiungere l'opera successiva si mostra
 * PRIMA di aprirla, e le note d'apertura prima della prima tappa: e' lo scopo per
 * cui esistono (slide 21). QR e codice digitato approdano entrambi in
 * `goToArtwork`, e un'opera fuori dalla visita si apre senza toccare la
 * progressione.
 *
 * Il teletrasporto cambia il significato di un tocco sul palcoscenico, quindi lo
 * stato sta qui: si arma da "Dove sono?" e dura un tocco solo, perche' una
 * modalita' e' una cosa in cui si resta intrappolati.
 */
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useSensors } from "@/composables/useSensors";
import { nodeOf, reanchor, startAtEntrance } from "@/localization";
import Stage from "./Stage.vue";
import Scheda from "./Scheda.vue";
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
  setStageView,
  visit,
  posizioneAttiva,
  setPosizioneAttiva,
} from "@/state";
import {
  guidedActive,
  guidedRole,
  guidedStato,
  guidedCurrentStep,
  teacherGoToStep,
  studentAsk,
} from "@/guided";
import { NEXT_STOP_COMMAND, labelForCommand } from "../../../../shared/constants";
import { t } from "@/i18n";
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

// --- Posizione corrente ----------------------------------------------------
const currentArtwork = ref<Match | null>(null);
const lastVisitIndex = ref(-1);
const showLocator = ref(false);

/**
 * I sensori partono solo se il visitatore ha ACCESO la posizione (`posizioneAttiva`,
 * spenta di suo): finche' e' spenta non si chiede nessun permesso e non si legge
 * nessun sensore. Da accesa partono col tocco che apre "Dove sono?", perche' iOS
 * concede il permesso per l'orientamento solo dentro un gesto dell'utente, e
 * quello e' il gesto. Non si spengono richiudendo il pannello: il segnalino deve
 * continuare a seguire chi cammina. Muoversi pero' non apre mai una scheda: a
 * decidere e' solo la pressione del bottone.
 */
const sensori = useSensors();
watch(map, () => startAtEntrance(), { immediate: true });

function apriPosizione() {
  showLocator.value = true;
  if (posizioneAttiva.value) sensori.start();
}

/** L'interruttore della posizione: accendendola i sensori partono subito, e il
 *  tocco che l'ha accesa e' il gesto dentro cui iOS concede il permesso. */
function cambiaPosizione(attiva: boolean) {
  setPosizioneAttiva(attiva);
  if (attiva) sensori.start();
  else sensori.stop();
}
const transition = ref<{ notes: string[]; target: number } | null>(null);

/** Percorso finito: si mostra la chiusura, con la via di casa in evidenza. */
const fine = ref<{ notes: string[] } | null>(null);

function tornaAllaHome() {
  window.location.href = marketplaceHome();
}

/**
 * La posizione si cerca sull'item e non sull'opera. Una visita puo' avere piu'
 * item per lo stesso oggetto, e la slide 21 dice che dovrebbe averne: cercando
 * per opera, la seconda descrizione ritroverebbe sempre l'indice della prima, e
 * "Prossimo" riporterebbe alla tappa gia' vista bloccando li' la visita.
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

const canEnd = computed(() => {
  if (guidedActive.value) return false;
  if (guidedStudent.value) return false;
  if (lastVisitIndex.value < 0) return false;
  return !hasNext.value;
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

/*
 * Le due scritture dell'avanzamento. Quella per esteso e' la sola che arriva a
 * chi ascolta; quella breve serve sotto `sm`, dove "Tappa 104 di 104" non ci sta
 * accanto agli altri comandi. Prima di aprire una tappa sono la stessa frase.
 */
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
  selectIndex(i);
  if (guidedTeacher.value) teacherGoToStep(i);
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

/**
 * La porta d'ingresso alla visita, dentro la scheda finche' non c'e' nessuna
 * tappa aperta: senza, l'unico modo di cominciare sarebbe scoprire che i dischi
 * sulla pianta si toccano. Nella visita guidata non compare: li' a decidere la
 * tappa e' il docente.
 */
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
function goToIndex(i: number) {
  transition.value = null;
  selectIndex(i);
  if (guidedTeacher.value) teacherGoToStep(i);
}

function navigationHandler(direction: string) {
  if (guidedStudent.value) return;
  const base = navBase();
  const target = stepIndex(base, direction === "next" ? 1 : -1);
  if (target < 0) {
    // Fine del percorso: senza questo ramo la visita non finirebbe mai.
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
      announce(t("Visita completata"));
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
  if (t.target >= 0) {
    goToIndex(t.target);
    return;
  }
  // Note d'apertura: "Continua" deve continuare, cioe' portare alla prima tappa.
  // Chiudendo solo il riquadro la visita resterebbe ferma senza niente di aperto.
  const primo = stepIndex(-1, 1);
  if (primo >= 0) goToIndex(primo);
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

/** Sposta la posizione e basta: non apre nessuna tappa e non fa avanzare la
 *  visita, perche' dichiarare dove si e' e decidere cosa leggere sono due atti
 *  diversi. */
function armaTeletrasporto() {
  showLocator.value = false;
  teletrasportoArmato.value = true;
  setStageView("mappa");
  announce(t("Teletrasporto pronto: tocca la pianta nel punto in cui ti trovi."));
}

function annullaTeletrasporto() {
  teletrasportoArmato.value = false;
  announce(t("Teletrasporto annullato"));
}

/** Su un punto qualunque non c'e' un nome da dire: quale opera sia e' il
 *  mestiere di "Trovami", non di chi sposta. */
function teletrasportaSuPunto(x: number, y: number) {
  reanchor(x, y);
  teletrasportoArmato.value = false;
  announce(t("Posizione aggiornata"));
}

/** Una tappa: la "posizione predeterminata" accanto all'opera (slide 34). */
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

  // Dire dove si e' ri-ancora il sistema di coordinate: da qui in poi i passi
  // si contano da questo punto, non da dove il GPS credeva di essere.
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

/**
 * DOVE si vuole andare, quando la domanda non e' un comando che se lo porta
 * dietro. Due sorgenti, che il grafo tratta allo stesso modo perche' per lui una
 * destinazione e' un nodo e basta: il `data-poi` del servizio toccato sulla
 * pianta, quindi tutti i servizi di tutte le piante e non i quattro che il
 * vocabolario sa nominare, e il qid dell'opera della tappa successiva. La
 * risposta esce dove escono le altre, dentro Orientati: una risposta sola in un
 * posto solo e' la ragione per cui la scheda sta sempre aperta.
 */
const openTarget = ref("");

/**
 * L'opera verso cui si va, cioe' l'ANCORA della tappa successiva e non la sua
 * opera: una tappa che parla di uno stile non sta da nessuna parte sulla pianta,
 * ma chi la ascolta si', ed e' quella la posizione che tutto il resto usa gia'.
 *
 * Vuoto vuol dire "non c'e' un dopo", e sono i due casi in cui il comando si
 * spegne: l'ultima tappa e lo studente di una visita guidata, dove la tappa la
 * decide il docente e mandare avanti chi chiede spezzerebbe la classe.
 */
const nextAnchorQid = computed(() => {
  if (guidedStudent.value) return "";
  const i = stepIndex(navBase(), 1);
  if (i < 0) return "";
  const stop = matchedContent.value[i];
  if (!stop || !stop.anchor) return "";
  return stop.anchor.qid;
});

/**
 * L'opera a cui si riferiscono le domande. Finche' non se n'e' aperta nessuna
 * vale la prima della visita: "dov'e' il bagno?" deve poter partire da dove ci
 * si trova, non richiedere di aprire prima una didascalia.
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

  // Chiedere la strada non e' andarci: si apre la risposta, la tappa non cambia.
  if (option === NEXT_STOP_COMMAND) {
    if (!nextAnchorQid.value) {
      // Il bottone e' spento, ma la voce ci arriva lo stesso: se qui si tacesse,
      // un comando riconosciuto e ripetuto non produrrebbe niente.
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
  <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
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
          <span class="sr-only sm:not-sr-only">{{ t("Esci") }}</span>
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
        style="background-color: var(--accent-velo)"
        aria-hidden="true"
      >
        <div
          class="h-full bg-accent transition-[width] duration-200"
          :style="{ width: (currentPosition / navigableStops.length) * 100 + '%' }"
        ></div>
      </div>

      <!-- TELETRASPORTO ARMATO -->
      <div v-if="teletrasportoArmato" class="flex shrink-0 items-center gap-3 bg-structure px-3 py-2 text-on-structure">
        <p class="min-w-0 flex-1 text-small font-medium">{{ t("Tocca la pianta nel punto in cui ti trovi.") }}</p>
        <button type="button" class="btn-fantasma-chiaro shrink-0" @click="annullaTeletrasporto">{{ t("Annulla") }}</button>
      </div>

      <!-- PALCOSCENICO -->
      <Stage
        class="min-h-0 flex-1"
        :current-location-id="currentLocationId"
        :current-index="lastVisitIndex"
        :armed="teletrasportoArmato"
        @select="onStageSelect"
        @locate="apriPosizione"
        @poi="chiediServizio"
        @teleport-point="teletrasportaSuPunto"
        @teleport-stop="teletrasportaSuTappa"
      />
    </div>

    <Scheda
      :content="currentArtwork"
      :fields="translatedFields"
      :riferimento="riferimento"
      :azione="azioneTappa"
      :in-visit="inVisit"
      :optional="currentArtwork ? isOptionalItem(currentArtwork.item['@id']) : false"
      :has-next="hasNext"
      :has-prev="hasPrev"
      :can-end="canEnd"
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
          {{ transition.target < 0 ? t("Prima di cominciare") : t("Verso la prossima tappa") }}
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
      <div class="lastra w-full max-w-md p-6 shadow-l2">
        <p class="text-caption uppercase tracking-wider text-muted">
          {{ title }}
        </p>
        <h2 id="fine-titolo" class="mt-1 font-display text-title-1">
          {{ t("Visita completata.") }}
        </h2>
        <p class="mt-2 text-body text-muted">
          {{
            navigableStops.length === 1
              ? t("Hai visto l'unica tappa del percorso.")
              : t("Hai visto tutte le {n} tappe del percorso.", { n: navigableStops.length })
          }}
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
</template>
