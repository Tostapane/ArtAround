<script setup lang="ts">
import { onMounted, ref } from "vue";
import Header from "./components/Header.vue";
import Footer from "./components/Footer.vue";
import Selector from "./components/selection/Selector.vue";
import MainView from "./components/map/MainView.vue";
import { loadMuseum, setCustomVisit, setVisit } from "./state";
import { getVisit } from "./api";
import { useAnnouncer } from "./composables/useAnnouncer";
import type { Visit, Match } from "../../shared/types";

const { message, announce } = useAnnouncer();

// museo mostrato quando il navigator viene aperto senza parametri
const DEFAULT_MUSEUM_QID = "Q6373";

// qid del museo a partire dal suo @id/URI wikidata (ultimo segmento)
function museumQidFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1] || "";
}

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const visitId = params.get("visit");
  const museumParam = params.get("museum");

  // deep link dal marketplace (?museum=<qid>&visit=<id>): la visita arriva dal
  // database, il museo dal suo file di configurazione; si parte direttamente.
  if (visitId) {
    try {
      const v = await getVisit(visitId);
      let museumQid = museumParam;
      if (v.ofMuseum) museumQid = museumQidFromUri(v.ofMuseum);
      if (museumQid) await loadMuseum(museumQid);
      onStart(v);
      return;
    } catch (err) {
      console.error("Impossibile aprire la visita dal link", err);
      // si ricade sulla normale selezione della visita
    }
  }

  // accesso diretto: museo dal parametro ?museum=, altrimenti quello di default
  let museumQid = museumParam;
  if (!museumQid) museumQid = DEFAULT_MUSEUM_QID;
  loadMuseum(museumQid);
});

// la visita scelta (id) e la fase corrente: prima si sceglie, poi si visita
const choice = ref<string>("");
const started = ref(false);
const summary = ref<{ level: string; duration: number } | null>(null);

// visita normale: il Selector passa l'oggetto Visit gia' completo (lo ha gia'
// caricato per popolare i menu), quindi lo iniettiamo nello stato senza un
// secondo fetch dal server
function onStart(v: Visit) {
  setVisit(v);
  choice.value = v["@id"];
  summary.value = { level: v.level, duration: v.duration };
  started.value = true;
  announce("Visita avviata");
}

// visita su misura: il Selector ha gia' creato visita+contenuto (non persistiti),
// qui li iniettiamo nello stato e avviamo la visita
function onCustomStart(payload: { visit: Visit; content: Match[] }) {
  setCustomVisit(payload.visit, payload.content);
  choice.value = payload.visit["@id"];
  summary.value = {
    level: payload.visit.level,
    duration: payload.visit.duration,
  };
  started.value = true;
  announce("Visita avviata");
}

function goBack() {
  started.value = false;
  announce("Selezione della visita");
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-bg text-text">
    <!-- Salta direttamente al contenuto (utile per chi naviga da tastiera) -->
    <a
      href="#contenuto"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
    >
      Salta al contenuto
    </a>

    <Header class="relative z-20 shrink-0" />

    <main
      id="contenuto"
      tabindex="-1"
      class="relative flex flex-1 flex-col overflow-hidden bg-surface-2"
      aria-label="Contenuto principale"
    >
      <!-- Fase 1: scelta di livello e durata -->
      <div
        v-if="!started"
        class="flex flex-1 items-start justify-center overflow-y-auto p-4 sm:items-center"
      >
        <Selector
          class="w-full max-w-md"
          @start="onStart"
          @customStart="onCustomStart"
        />
      </div>

      <!-- Fase 2: mappa e opere -->
      <template v-else>
        <div
          class="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5"
        >
          <button
            type="button"
            @click="goBack"
            class="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Cambia visita
          </button>
          <span v-if="summary" class="text-sm text-muted">
            {{ summary.level }} ·
            {{ Math.max(1, Math.round(summary.duration / 60)) }} min
          </span>
        </div>

        <div class="relative flex-1 overflow-hidden">
          <MainView :currVisit="choice" />
        </div>
      </template>
    </main>

    <Footer v-if="!started" class="shrink-0" />

    <!-- Live region globale: annunci di stato per screen reader -->
    <p class="sr-only" role="status" aria-live="polite">{{ message }}</p>
  </div>
</template>
