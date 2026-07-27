<script setup lang="ts">
/**
 * LA VISITA GUIDATA — sala d'attesa, conduzione, quiz, chiusura.
 *
 * La sala d'attesa e' una schermata PROIETTATA: viene letta a voce alta in una
 * stanza e trenta persone la guardano insieme, percio' la parola chiave ha la
 * dimensione di un'insegna.
 *
 * Durante la visita i comandi di CONDUZIONE (chi c'e', chi ha chiesto cosa,
 * termina) stanno in una barra dedicata, separati dai comandi di visita: un
 * docente che preme "Prossimo" sta muovendo trenta persone, e la scheda lo dice
 * con parole sue.
 *
 * Quattro fasi, non tre. La fase "quiz" ha una sua schermata anche se
 * l'interfaccia del quiz non c'e' ancora: senza, all'avvio del quiz tutti
 * vedrebbero "Visita terminata" a meta' visita, che e' una cosa falsa. E la
 * chiusura distingue "il docente ha terminato" da "la sessione e' sparita":
 * riusare la stessa frase per entrambe e' il modo in cui un guasto diventa
 * invisibile.
 */
import { computed, ref, watch } from "vue";
import Visita from "./visita/Visita.vue";
import {
  guidedRole,
  guidedStato,
  guidedVisitName,
  guidedAccessKey,
  guidedParticipants,
  guidedParticipantsCount,
  guidedQuestions,
  guidedPlannedEnd,
  teacherStart,
  teacherEnd,
  studentLeave,
  resetGuided,
} from "@/guided";
import { visit } from "@/state";
import { useAnnouncer } from "@/composables/useAnnouncer";

const { announce } = useAnnouncer();

const isTeacher = computed(() => guidedRole.value === "docente");
const currVisit = computed(() => (visit.value ? visit.value["@id"] : ""));

const panel = ref<"" | "studenti" | "domande">("");
function togglePanel(p: "studenti" | "domande") {
  panel.value = panel.value === p ? "" : p;
}

const recentQuestions = computed(() => [...guidedQuestions.value].reverse());
function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

watch(guidedParticipantsCount, (ora, prima) => {
  if (!isTeacher.value || prima === undefined) return;
  if (ora > prima) announce(`${ora} studenti collegati`);
  else if (ora < prima) announce(`Uno studente si è disconnesso. Ora sono ${ora}`);
});

watch(
  () => guidedQuestions.value.length,
  (ora, prima) => {
    if (!isTeacher.value || prima === undefined || ora <= prima) return;
    const latest = guidedQuestions.value[ora - 1];
    if (latest) announce(`${latest.username} ha chiesto: ${latest.question}`);
  },
);

async function start() {
  try {
    await teacherStart();
    announce("Visita avviata per tutti");
  } catch (err) {
    console.error("Impossibile avviare la visita guidata", err);
  }
}

async function end() {
  try {
    await teacherEnd();
  } catch (err) {
    console.error("Impossibile terminare la visita guidata", err);
  }
}

async function studentExit() {
  try {
    await studentLeave();
  } finally {
    backToSelection();
  }
}

function exitVisit() {
  if (isTeacher.value) end();
  else studentExit();
}

function backToSelection() {
  resetGuided();
  window.location.href = window.location.pathname;
}
</script>

<template>
  <div
    v-if="guidedStato === 'attesa'"
    class="flex flex-1 flex-col justify-between bg-structure p-6 text-on-structure sm:p-10"
  >
    <p class="text-caption uppercase tracking-[0.18em] text-on-structure/70">
      Visita guidata
    </p>

    <!-- DOCENTE -->
    <div v-if="isTeacher" class="py-8">
      <h1 class="font-display text-title-1 leading-tight">{{ guidedVisitName }}</h1>

      <div v-if="guidedAccessKey" class="mt-8">
        <p class="text-caption uppercase tracking-wider text-on-structure/70">
          Parola chiave
        </p>
        <p class="mt-2 font-mono text-display font-semibold leading-none">
          {{ guidedAccessKey }}
        </p>
        <p class="mt-3 text-small text-on-structure/80">
          Gli studenti la digitano dal marketplace per entrare.
        </p>
      </div>

      <div class="mt-10">
        <p class="tabular text-title-3">
          {{ guidedParticipantsCount }}
          {{ guidedParticipantsCount === 1 ? "studente collegato" : "studenti collegati" }}
        </p>
        <ul
          v-if="guidedParticipants.length"
          class="mt-4 flex max-h-48 flex-wrap gap-2 overflow-y-auto"
        >
          <li
            v-for="p in guidedParticipants"
            :key="p.username"
            class="rounded-plate border border-on-structure/30 px-3 py-1.5 text-small"
          >
            {{ p.username }}
          </li>
        </ul>
        <p v-else class="mt-3 text-small text-on-structure/70">
          In attesa che entrino con la parola chiave…
        </p>
      </div>
    </div>

    <!-- STUDENTE -->
    <div v-else class="py-8">
      <h1 class="font-display text-title-1 leading-tight">{{ guidedVisitName }}</h1>
      <p class="mt-6 text-title-3 text-on-structure/85">
        In attesa che il docente dia il via.
      </p>
      <p class="tabular mt-2 text-small text-on-structure/70">
        {{ guidedParticipantsCount }}
        {{ guidedParticipantsCount === 1 ? "collegato" : "collegati" }}
      </p>
    </div>

    <div class="flex flex-wrap gap-3">
      <template v-if="isTeacher">
        <button type="button" class="btn-primario text-title-3" @click="start">
          Avvia la visita
        </button>
        <button type="button" class="btn-fantasma-chiaro" @click="end">
          Annulla
        </button>
      </template>
      <button v-else type="button" class="btn-fantasma-chiaro" @click="studentExit">
        Esci
      </button>
    </div>
  </div>

  <template v-else-if="guidedStato === 'attiva'">
    <div
      v-if="isTeacher"
      class="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-structure px-3 py-2 text-on-structure"
    >
      <span class="mr-auto truncate text-small font-medium">
        Stai conducendo · {{ guidedVisitName }}
      </span>
      <button
        type="button"
        class="btn-fantasma-chiaro"
        :aria-pressed="panel === 'studenti'"
        @click="togglePanel('studenti')"
      >
        Studenti (<span class="tabular">{{ guidedParticipantsCount }}</span>)
      </button>
      <button
        type="button"
        class="btn-fantasma-chiaro"
        :aria-pressed="panel === 'domande'"
        @click="togglePanel('domande')"
      >
        Domande (<span class="tabular">{{ guidedQuestions.length }}</span>)
      </button>
      <button type="button" class="btn-pericolo-pieno" @click="end">
        Termina per tutti
      </button>
    </div>
    <p
      v-else
      class="shrink-0 border-b border-line bg-structure px-3 py-2 text-center text-caption text-on-structure"
    >
      Visita guidata dal docente
    </p>

    <Visita
      :curr-visit="currVisit"
      :title="guidedVisitName"
      @exit="exitVisit"
    />

    <div
      v-if="isTeacher && panel"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center"
      @click.self="panel = ''"
    >
      <aside
        class="lastra flex max-h-[80dvh] w-full max-w-md flex-col p-5 shadow-l2"
        :aria-label="panel === 'studenti' ? 'Studenti collegati' : 'Domande degli studenti'"
      >
        <div class="flex shrink-0 items-center justify-between gap-3">
          <h2 class="font-display text-title-3">
            {{ panel === "studenti" ? "Studenti collegati" : "Domande degli studenti" }}
          </h2>
          <button type="button" class="icona-mini" aria-label="Chiudi" @click="panel = ''">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Studenti -->
        <template v-if="panel === 'studenti'">
          <ul v-if="guidedParticipants.length" class="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto">
            <li
              v-for="p in guidedParticipants"
              :key="p.username"
              class="rounded-plate border border-line px-3 py-2 text-small font-medium"
            >
              {{ p.username }}
            </li>
          </ul>
          <p v-else class="vuoto mt-4">Nessuno studente collegato.</p>
        </template>

        <template v-else>
          <ul v-if="recentQuestions.length" class="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto">
            <li
              v-for="(q, i) in recentQuestions"
              :key="i"
              class="rounded-plate border border-line p-3 text-small"
            >
              <div class="flex items-baseline justify-between gap-2">
                <span class="font-semibold">{{ q.username }}</span>
                <span class="tabular shrink-0 text-caption text-muted">{{ formatTime(q.at) }}</span>
              </div>
              <p class="mt-1">{{ q.question }}</p>
              <p v-if="q.artwork" class="mt-0.5 text-caption text-muted">su «{{ q.artwork }}»</p>
            </li>
          </ul>
          <p v-else class="vuoto mt-4">Nessuna domanda per ora.</p>
        </template>
      </aside>
    </div>
  </template>

  <div
    v-else-if="guidedStato === 'quiz'"
    class="flex flex-1 items-center justify-center bg-structure p-6 text-on-structure"
  >
    <div class="max-w-md text-center">
      <h1 class="font-display text-title-1">Il docente ha avviato il quiz</h1>
      <p class="mt-3 text-body text-on-structure/85">
        Segui le indicazioni del docente.
      </p>
    </div>
  </div>

  <div v-else class="flex flex-1 items-center justify-center bg-structure p-6 text-on-structure">
    <div class="max-w-md text-center">
      <h1 class="font-display text-title-1">
        {{ guidedPlannedEnd ? "La visita è finita." : "La sessione è stata chiusa." }}
      </h1>
      <p class="mt-3 text-body text-on-structure/85">
        {{
          guidedPlannedEnd
            ? "Grazie per aver partecipato."
            : "Il collegamento con la visita si è interrotto. Chiedi al docente di riaprire la sala d'attesa."
        }}
      </p>
      <button type="button" class="btn-primario mt-8" @click="backToSelection">
        Torna alle visite
      </button>
    </div>
  </div>
</template>
