<script setup lang="ts">
import { computed, ref } from "vue";
import MainView from "./map/MainView.vue";
import {
  guidedRole,
  guidedStato,
  guidedVisitName,
  guidedAccessKey,
  guidedParticipants,
  guidedParticipantsCount,
  guidedQuestions,
  teacherStart,
  teacherEnd,
  studentLeave,
  resetGuided,
} from "@/guided";
import { visit } from "@/state";

// Gestisce le fasi della visita guidata: sala d'attesa -> visita -> fine.
// La fase "attiva" riusa il normale MainView (che sincronizza da solo la vista
// leggendo lo stato guidato).

const isTeacher = computed(() => guidedRole.value === "docente");
const currVisit = computed(() => (visit.value ? visit.value["@id"] : ""));

// Pannelli laterali del docente durante la visita: domande e studenti collegati
// (mutuamente esclusivi, cosi' non si sovrappongono sullo stesso lato).
const showQuestions = ref(false);
const showParticipants = ref(false);
function toggleQuestions() {
  showQuestions.value = !showQuestions.value;
  showParticipants.value = false;
}
function toggleParticipants() {
  showParticipants.value = !showParticipants.value;
  showQuestions.value = false;
}
const domandeRecenti = computed(() => [...guidedQuestions.value].reverse());
function formatOra(at: number): string {
  return new Date(at).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function avvia() {
  try {
    await teacherStart();
  } catch (err) {
    console.error("Impossibile avviare la visita guidata", err);
  }
}

async function termina() {
  try {
    await teacherEnd();
  } catch (err) {
    console.error("Impossibile terminare la visita guidata", err);
  }
}

// Uscita dello studente dalla sala d'attesa (prima dell'avvio).
async function esciAttesa() {
  try {
    await studentLeave();
  } finally {
    tornaAllaSelezione();
  }
}

// Torna al navigator normale ripulendo il deep-link dall'URL.
function tornaAllaSelezione() {
  resetGuided();
  window.location.href = window.location.pathname;
}
</script>

<template>
  <!-- FASE 1: sala d'attesa -->
  <div
    v-if="guidedStato === 'attesa'"
    class="flex flex-1 items-start justify-center overflow-y-auto p-4 sm:items-center"
  >
    <div class="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-lg">
      <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">
        Visita guidata
      </p>
      <h1 class="mb-4 text-xl font-bold text-text">{{ guidedVisitName }}</h1>

      <!-- DOCENTE: parola chiave (promemoria) + lista dei collegati + avvio -->
      <template v-if="isTeacher">
        <div
          v-if="guidedAccessKey"
          class="mb-4 rounded-md border border-border bg-surface-2 px-4 py-3"
        >
          <p class="text-xs font-medium uppercase tracking-wider text-muted">
            Parola chiave
          </p>
          <p class="font-mono text-lg font-bold tracking-wide text-text">
            {{ guidedAccessKey }}
          </p>
          <p class="mt-1 text-xs text-muted">
            Comunicala agli studenti per farli entrare.
          </p>
        </div>
        <p class="mb-3 text-sm text-muted">
          {{ guidedParticipantsCount }} collegati
        </p>
        <ul
          v-if="guidedParticipants.length"
          class="mb-4 flex max-h-56 flex-col gap-1 overflow-y-auto"
        >
          <li
            v-for="p in guidedParticipants"
            :key="p.username"
            class="rounded-md border border-border px-3 py-2 text-sm"
          >
            <span class="font-medium text-text">{{ p.username }}</span>
          </li>
        </ul>
        <p v-else class="mb-4 text-sm text-muted">
          In attesa che gli studenti entrino con la parola chiave…
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            @click="termina"
            class="rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
          >
            Annulla
          </button>
          <button
            type="button"
            @click="avvia"
            class="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
          >
            Avvia visita
          </button>
        </div>
      </template>

      <!-- STUDENTE: attesa del via -->
      <template v-else>
        <p class="mb-4 text-sm text-muted">
          In attesa che il/la docente avvii la visita.
          {{ guidedParticipantsCount }} collegati.
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            @click="esciAttesa"
            class="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
          >
            Esci
          </button>
        </div>
      </template>
    </div>
  </div>

  <!-- FASE 2: visita in corso (sincronizzata dal docente) -->
  <template v-else-if="guidedStato === 'attiva'">
    <div
      class="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5"
    >
      <span class="truncate text-sm font-medium text-text">
        <span aria-hidden="true">🔑</span> {{ guidedVisitName }}
      </span>
      <button
        v-if="isTeacher"
        type="button"
        @click="toggleParticipants"
        class="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
        :aria-pressed="showParticipants"
      >
        Studenti ({{ guidedParticipantsCount }})
      </button>
      <span v-else class="shrink-0 text-xs text-muted">Guidata dal docente</span>
      <button
        v-if="isTeacher"
        type="button"
        @click="toggleQuestions"
        class="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
        :aria-pressed="showQuestions"
      >
        Domande ({{ guidedQuestions.length }})
      </button>
      <button
        v-if="isTeacher"
        type="button"
        @click="termina"
        class="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
      >
        Termina
      </button>
    </div>
    <div class="relative flex-1 overflow-hidden">
      <MainView :currVisit="currVisit" />

      <!-- Pannello studenti collegati (solo docente): nomi, non solo il numero -->
      <aside
        v-if="isTeacher && showParticipants"
        class="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-border bg-surface shadow-xl"
        aria-label="Studenti collegati"
      >
        <div
          class="flex shrink-0 items-center justify-between border-b border-border px-4 py-3"
        >
          <h2 class="text-sm font-semibold text-text">
            Studenti collegati ({{ guidedParticipantsCount }})
          </h2>
          <button
            type="button"
            @click="showParticipants = false"
            class="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-2"
          >
            Chiudi
          </button>
        </div>
        <ul
          v-if="guidedParticipants.length"
          class="flex flex-1 flex-col gap-2 overflow-y-auto p-3"
        >
          <li
            v-for="p in guidedParticipants"
            :key="p.username"
            class="rounded-md border border-border px-3 py-2 text-sm font-medium text-text"
          >
            {{ p.username }}
          </li>
        </ul>
        <p v-else class="p-4 text-sm text-muted">
          Nessuno studente collegato.
        </p>
      </aside>

      <!-- Pannello domande degli studenti (solo docente): conservate dal client -->
      <aside
        v-if="isTeacher && showQuestions"
        class="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-border bg-surface shadow-xl"
        aria-label="Domande degli studenti"
      >
        <div
          class="flex shrink-0 items-center justify-between border-b border-border px-4 py-3"
        >
          <h2 class="text-sm font-semibold text-text">Domande degli studenti</h2>
          <button
            type="button"
            @click="showQuestions = false"
            class="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-2"
          >
            Chiudi
          </button>
        </div>
        <ul
          v-if="domandeRecenti.length"
          class="flex flex-1 flex-col gap-2 overflow-y-auto p-3"
        >
          <li
            v-for="(q, i) in domandeRecenti"
            :key="i"
            class="rounded-md border border-border p-3 text-sm"
          >
            <div class="mb-1 flex items-center justify-between gap-2">
              <span class="font-semibold text-text">{{ q.username }}</span>
              <span class="shrink-0 text-xs text-muted">{{ formatOra(q.at) }}</span>
            </div>
            <p class="text-text">{{ q.question }}</p>
            <p v-if="q.artwork" class="mt-0.5 text-xs text-muted">
              su «{{ q.artwork }}»
            </p>
          </li>
        </ul>
        <p v-else class="p-4 text-sm text-muted">
          Nessuna domanda per ora.
        </p>
      </aside>
    </div>
  </template>

  <!-- FASE 3: visita terminata -->
  <div
    v-else
    class="flex flex-1 items-center justify-center p-4"
  >
    <div class="w-full max-w-md rounded-xl border border-border bg-surface p-6 text-center shadow-lg">
      <h1 class="mb-2 text-xl font-bold text-text">Visita terminata</h1>
      <p class="mb-6 text-sm text-muted">
        La visita guidata è finita. Grazie per aver partecipato.
      </p>
      <button
        type="button"
        @click="tornaAllaSelezione"
        class="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
      >
        Torna alla selezione
      </button>
    </div>
  </div>
</template>
