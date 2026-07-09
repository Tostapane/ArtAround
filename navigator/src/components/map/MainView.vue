<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { Dialog, DialogPanel } from "@headlessui/vue";
import Map from "./Map.vue";
import Card from "./Card.vue";
import OptionsBar from "./OptionsBar.vue";
import Info from "./Info.vue";
import QRScanner from "./QRScanner.vue";
import { useTTS } from "./speech/useTTS";
import { useTranslation } from "@/composables/useTranslation";
import { getArtworkPreview } from "@/api";
import {
  includeOptional,
  isOptionalItem,
  loadVisitContent,
  matchedContent,
  visit,
} from "./../../state";
import {
  guidedActive,
  guidedRole,
  guidedStato,
  guidedCurrentStep,
  teacherGoToStep,
  studentAsk,
} from "@/guided";
import type { Match } from "../../../../shared/types";

const tts = useTTS();

// la visita scelta dal selector
const props = defineProps<{
  currVisit: string;
}>();
// attivato ogni volta che viene cambiata la visita selezionata
watch(
  () => props.currVisit,
  async (newVisitId) => {
    if (!newVisitId) return;
    await loadVisitContent(newVisitId);
  },
  { immediate: true },
);

// opera attualmente mostrata: puo' stare DENTRO o FUORI dalla visita (quando
// arriva da una scansione QR). E' la singola fonte di verita' della posizione.
const currentArtwork = ref<Match | null>(null);
// indice dell'ultima opera DELLA visita visitata: serve a far ripartire il
// "Prossimo" dall'ultima tappa reale dopo una deviazione su un'opera fuori visita.
const lastVisitIndex = ref(-1);

const showScanner = ref(false);

// gestione delle opzioni
const currentOption = ref<string>("");
const showOptions = ref(false);

// indice dell'opera corrente DENTRO la visita (-1 se non ne fa parte)
function indexInVisit(): number {
  if (!currentArtwork.value) return -1;
  const id = currentArtwork.value.artwork["@id"];
  return matchedContent.value.findIndex((m) => m.artwork["@id"] === id);
}
const inVisit = computed(() => indexInVisit() >= 0);

// indice di riferimento per la navigazione: la posizione reale se siamo dentro
// la visita, altrimenti l'ultima tappa reale (deviazione su opera fuori visita).
function navBase(): number {
  if (inVisit.value) return indexInVisit();
  return lastVisitIndex.value;
}
// prossima tappa navigabile da `from` (esclusa) in direzione step=±1: salta le
// tappe opzionali quando il toggle e' spento; -1 se non ce n'e' nessuna.
function stepIndex(from: number, step: number): number {
  for (let i = from + step; i >= 0 && i < matchedContent.value.length; i += step) {
    const match = matchedContent.value[i];
    if (!match) return -1;
    if (includeOptional.value || !isOptionalItem(match.item["@id"])) return i;
  }
  return -1;
}
// modalita' guidata (18-27): lo studente SEGUE il docente e non naviga; il
// docente conduce (ogni Prossimo/Precedente spinge lo step a tutti).
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

// lo studente non ha Prossimo/Precedente (navigazione pilotata dal docente)
const hasNext = computed(() => {
  if (guidedStudent.value) return false;
  return stepIndex(navBase(), 1) >= 0;
});
const hasPrev = computed(() => {
  if (guidedStudent.value) return false;
  return stepIndex(navBase(), -1) >= 0;
});

// seleziona un'opera DELLA visita per indice (aggiorna anche l'ultima tappa)
function selectIndex(i: number) {
  const match = matchedContent.value[i];
  if (!match) return;
  currentArtwork.value = match;
  lastVisitIndex.value = i;
}

// click su un'opera dalla mappa: lo studente guidato non sceglie le opere, ma
// puo' RIAPRIRE la scheda della propria opera corrente (quella decisa dal
// docente); non puo' spostarsi su altre. Il docente invece porta con se' tutti
// gli studenti (spinge lo step).
function onMapSelect(i: number) {
  if (guidedStudent.value) {
    if (i === guidedCurrentStep.value) selectIndex(i);
    return;
  }
  selectIndex(i);
  if (guidedTeacher.value) teacherGoToStep(i);
}

// posizione corrente da evidenziare sulla mappa ("sei qui"): l'opera mostrata
// quando la scheda e' aperta; per lo studente guidato resta l'opera scelta dal
// docente anche a scheda chiusa, cosi' vede sempre dove si trova.
const currentLocationId = computed(() => {
  if (currentArtwork.value) return currentArtwork.value.artwork.locationId;
  if (guidedStudent.value) {
    const match = matchedContent.value[guidedCurrentStep.value];
    if (match) return match.artwork.locationId;
  }
  return "";
});

// scansione QR: imposta SOLO la posizione corrente, senza ricaricare nulla e
// senza toccare la progressione della visita (lo stato resta in memoria).
async function onScan(qid: string) {
  showScanner.value = false;
  const i = matchedContent.value.findIndex((m) => m.artwork.qid === qid);
  if (i >= 0) {
    selectIndex(i);
    return;
  }
  // opera fuori dalla visita: la mostriamo comunque (segnalata nella Card),
  // lasciando invariato lastVisitIndex cosi' il "Prossimo" riprende la visita.
  try {
    let level = "";
    let duration = 0;
    if (visit.value) {
      level = visit.value.level;
    }
    // preferenza di durata PER ITEM: visit.duration e' il totale della visita,
    // quindi usiamo la durata degli item della visita corrente (nel seed sono
    // tutti omogenei); se non ricavabile, il server ripiega sul solo livello
    const first = matchedContent.value[0];
    if (first) {
      const sec = parseInt(first.item.timeRequired, 10);
      if (!isNaN(sec)) duration = sec;
    }
    currentArtwork.value = await getArtworkPreview(qid, level, duration);
  } catch (err) {
    console.error("Impossibile caricare l'opera scansionata", err);
  }
}

function actionHandler(option: string) {
  // comandi di lettura (TTS): intercettati prima del percorso LLM/Info
  if (option === "Leggi") {
    tts.speak(translatedFields.value[2]);
    showOptions.value = false;
    return;
  }
  if (option === "Ferma lettura") {
    tts.stop();
    showOptions.value = false;
    return;
  }
  // comandi di navigazione (vocali): equivalgono ai pulsanti della Card
  if (option === "Prossimo") {
    navigationHandler("next");
    showOptions.value = false;
    return;
  }
  if (option === "Precedente") {
    navigationHandler("prev");
    showOptions.value = false;
    return;
  }
  currentOption.value = option;
  showOptions.value = false;
  // visita guidata: notifica al docente la domanda posta dallo studente
  // (no-op se non e' uno studente in una visita attiva)
  const art = currentArtwork.value;
  studentAsk(option, art ? art.artwork.name : "");
}

// traduzione live di titolo, autore e descrizione dell'opera corrente.
// Vive qui (non dentro Card) cosi' anche il comando "Leggi" puo' leggere la
// descrizione gia' tradotta senza ritradurla. translatedFields = [titolo, autore, testo]
const translatedFields = useTranslation(() => {
  const art = currentArtwork.value;
  if (!art) return [];
  return [art.artwork.name, art.artwork.author.name, art.item.text];
});

// quando si cambia o si chiude l'opera: reset opzioni e stop lettura.
// (lo scroll-lock e il focus-trap sono gestiti dal Dialog headless)
watch(currentArtwork, (newVal) => {
  currentOption.value = "";
  showOptions.value = false;
  tts.stop();
  // lettura automatica predisposta per un futuro toggle (ora disattivata)
  if (newVal && tts.autoRead.value) tts.speak(translatedFields.value[2]);
});

// STUDENTE guidato: quando il docente cambia opera, la vista lo segue. L'audio
// NON parte in automatico: e' lo studente ad avviare la lettura col pulsante se
// lo desidera (resta valida la sua preferenza di lettura automatica, se attiva).
watch(guidedCurrentStep, (step) => {
  if (!guidedStudent.value) return;
  if (step < 0) return;
  selectIndex(step);
});

// All'ingresso nella visita (MainView montato in fase "attiva") apriamo subito
// l'opera corrente sia per lo studente sia per il docente.
onMounted(() => {
  if (guidedCurrentStep.value < 0) return;
  if (guidedStudent.value || guidedTeacher.value) {
    selectIndex(guidedCurrentStep.value);
  }
});

onUnmounted(() => {
  tts.stop();
});

// "Prossimo"/"Precedente" puntano alla VERA opera successiva/precedente rispetto
// alla posizione reale; ai bordi non fanno nulla (la Card disabilita i pulsanti).
function navigationHandler(direction: string) {
  if (direction === "close") {
    // anche lo studente guidato puo' chiudere la scheda per vedere la mappa
    // (dove si trova e il resto del museo). Non e' navigazione: la tappa la
    // decide il docente, quindi quando avanza la scheda si riapre da sola
    // (watch su guidedCurrentStep). Puo' comunque riaprire l'opera corrente
    // cliccandola sulla mappa (onMapSelect).
    currentArtwork.value = null;
    return;
  }
  if (guidedStudent.value) return; // lo studente non naviga da solo (Prossimo/Precedente)
  const base = navBase();
  if (direction === "next") {
    const target = stepIndex(base, 1);
    if (target >= 0) {
      selectIndex(target);
      if (guidedTeacher.value) teacherGoToStep(target);
    }
  } else if (direction === "prev") {
    const target = stepIndex(base, -1);
    if (target >= 0) {
      selectIndex(target);
      if (guidedTeacher.value) teacherGoToStep(target);
    }
  }
}
</script>

<template>
  <Map @select="onMapSelect" :current-location-id="currentLocationId" />

  <!-- Scanner QR: disponibile durante una visita; imposta la posizione corrente.
       Nascosto allo studente guidato (non puo' spostarsi da solo). -->
  <button
    v-if="matchedContent.length && !guidedStudent"
    type="button"
    @click="showScanner = true"
    aria-label="Scansiona il QR di un'opera"
    class="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-medium text-on-accent shadow-lg transition-opacity hover:opacity-90"
  >
    <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 15h5v5h-5z" />
    </svg>
    Scansiona QR
  </button>

  <QRScanner v-if="showScanner" @scan="onScan" @close="showScanner = false" />

  <!--
    Dialog headless: focus-trap, chiusura con Esc, ripristino del focus
    sull'elemento di partenza e aria-modal automatici.
  -->
  <Dialog
    :open="!!currentArtwork"
    @close="navigationHandler('close')"
    class="relative z-50"
  >
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

    <div class="fixed inset-0 overflow-y-auto p-4 sm:p-6">
      <div class="flex min-h-full items-center justify-center">
        <DialogPanel
          v-if="currentArtwork"
          aria-labelledby="card-title"
          class="flex w-full max-w-5xl flex-col gap-4 md:flex-row md:items-stretch"
        >
          <Card
            :content="currentArtwork"
            :fields="translatedFields"
            :in-visit="inVisit"
            :optional="isOptionalItem(currentArtwork.item['@id'])"
            :has-next="hasNext"
            :has-prev="hasPrev"
            @navigation="navigationHandler"
            @toggleOptions="showOptions = !showOptions"
            class="md:flex-1"
          />
          <div
            v-if="showOptions || currentOption"
            class="flex w-full flex-col gap-4 md:w-80 md:shrink-0 md:overflow-y-auto"
          >
            <OptionsBar v-if="showOptions" @action="actionHandler" />
            <Info
              v-if="currentOption"
              :request="currentOption"
              :about="currentArtwork"
              @close="currentOption = ''"
            />
          </div>
        </DialogPanel>
      </div>
    </div>
  </Dialog>
</template>
