<script setup lang="ts">
import { ref, watch, computed } from "vue";
import DropDownMenu from "./DropDownMenu.vue";
import LanguageSelector from "./LanguageSelector.vue";
import { getVisitsByMuseum, createCustomVisit } from "./../../api.ts";
import type { Visit, Match } from "../../../../shared/types";
import { museum } from "@/state.ts";

const emit = defineEmits<{
  start: [visit: Visit];
  customStart: [payload: { visit: Visit; content: Match[] }];
}>();

interface State {
  level: string;
  duration: number;
}

// default placeholder finche' non arrivano le visite dal database
const filters = ref<State>({ level: "Principiante", duration: 60 });
// id della visita che corrisponde alla selezione corrente ("" se nessuna)
const matchedId = ref<string>("");

// carico le visite del museo corrente (appena il museo e' disponibile)
const visits = ref<Visit[]>();
watch(
  museum,
  async (m) => {
    if (!m) return;
    visits.value = await getVisitsByMuseum(m.qid);
    // imposto valori di default validi (primi disponibili) e calcolo il match
    const [level] = availableLevels.value;
    const [duration] = availableDurations.value;
    if (level !== undefined) filters.value.level = level;
    if (duration !== undefined) filters.value.duration = duration;
    updateMatchedVisit();
  },
  { immediate: true },
);

// tutti i possibili livelli (delle visite inserite dentro il database)
const availableLevels = computed(() => {
  if (!visits.value) return [] as string[];
  const levels = visits.value.map((v) => v.level);
  return [...new Set(levels)];
});

// tutte le possibili durate (delle visite inserite dentro il database)
const availableDurations = computed(() => {
  if (!visits.value) return [] as number[];
  const durations = visits.value.map((v) => v.duration);
  return [...new Set(durations)].sort((a, b) => a - b);
});

// si puo' avviare la visita solo se la combinazione scelta esiste
const canStart = computed(() => matchedId.value !== "");

// ricalcola quale visita corrisponde alla combinazione livello+durata scelta:
// aggiorna matchedId (che abilita "Inizia"). L'oggetto Visit completo viene poi
// passato dal padre da start(), evitando un secondo fetch lato navigator.
function updateMatchedVisit() {
  if (!visits.value) return;
  const currMuseum = museum.value;
  if (!currMuseum) return;

  const match = visits.value.find(
    (v) =>
      v.ofMuseum === `http://www.wikidata.org/entity/${currMuseum.qid}` &&
      v.level === filters.value.level &&
      v.duration === filters.value.duration,
  );

  matchedId.value = match ? match["@id"] : "";
}

function processChoice<K extends keyof State>(key: K, value: State[K]) {
  filters.value[key] = value;
  updateMatchedVisit();
}

function start() {
  if (!canStart.value || !visits.value) return;
  const chosen = visits.value.find((v) => v["@id"] === matchedId.value);
  if (chosen) emit("start", chosen);
}

// --- Visita su misura (in linguaggio naturale) ---------------------------
// descrizione libera dei vincoli dell'utente; la visita risultante vive nel
// client (non viene salvata nel database).
const customRequest = ref<string>("");
const creating = ref(false);
const customError = ref<string>("");

const canCreate = computed(
  () => customRequest.value.trim() !== "" && !creating.value,
);

async function createCustom() {
  const currMuseum = museum.value;
  if (!currMuseum || !canCreate.value) return;
  creating.value = true;
  customError.value = "";
  try {
    const result = await createCustomVisit(
      currMuseum.qid,
      customRequest.value.trim(),
    );
    // il padre (App) inietta la visita e gestisce la transizione
    emit("customStart", result);
  } catch (err) {
    console.error("Errore nella creazione della visita su misura", err);
    customError.value =
      "Non è stato possibile creare la visita. Riprova tra poco.";
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <section
    class="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8"
    aria-labelledby="selector-title"
  >
    <h1
      id="selector-title"
      class="text-xl font-bold tracking-tight text-text sm:text-2xl"
    >
      Personalizza la tua visita
    </h1>
    <p class="mt-2 text-sm text-muted">
      Scegli livello e durata, poi avvia la visita per esplorare la mappa.
    </p>

    <div class="mt-6 flex flex-col gap-5">
      <!-- Lingua: i contenuti vengono tradotti e letti live nella lingua scelta -->
      <LanguageSelector />

      <div class="flex flex-col gap-2">
        <span id="label-livello" class="text-sm font-medium text-text"
          >Livello di esperienza</span
        >
        <DropDownMenu
          class="w-full"
          aria-label="Livello di esperienza"
          :label="filters.level"
          :items="availableLevels"
          @selected="(val) => processChoice('level', val as string)"
        />
      </div>

      <div class="flex flex-col gap-2">
        <span id="label-durata" class="text-sm font-medium text-text"
          >Durata per opera (minuti)</span
        >
        <DropDownMenu
          class="w-full"
          aria-label="Durata per opera in minuti"
          :label="filters.duration"
          :items="availableDurations"
          @selected="(val) => processChoice('duration', val as number)"
        />
      </div>
    </div>

    <p class="mt-6 border-t border-border pt-4 text-sm text-muted">
      Tempo stimato:
      <span class="font-semibold text-text"
        >{{ filters.duration }} min per opera</span
      >
    </p>

    <button
      type="button"
      @click="start"
      :disabled="!canStart"
      class="mt-6 w-full rounded-md bg-accent px-4 py-3 text-base font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Inizia la visita
    </button>
    <p v-if="!canStart" class="mt-3 text-sm text-muted" role="status">
      Nessuna visita disponibile per questa combinazione: prova un'altra durata o
      livello.
    </p>

    <!-- Visita su misura: l'utente descrive a parole cosa desidera -->
    <div class="mt-8 border-t border-border pt-6">
      <h2 class="text-base font-semibold text-text">Oppure descrivi la tua visita</h2>
      <p class="mt-1 text-sm text-muted">
        Raccontaci di cosa hai bisogno e prepariamo un percorso su misura.
      </p>
      <label for="custom-request" class="sr-only">Descrizione della visita desiderata</label>
      <textarea
        id="custom-request"
        v-model="customRequest"
        rows="3"
        :disabled="creating"
        placeholder="Es. «Ho solo mezz'ora, mostrami le cose più importanti» oppure «Siamo due adulti e due bambini di 5 e 8 anni»"
        class="mt-3 w-full resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
      ></textarea>

      <button
        type="button"
        @click="createCustom"
        :disabled="!canCreate"
        class="mt-3 w-full rounded-md border border-accent px-4 py-3 text-base font-semibold text-accent transition-colors hover:bg-accent hover:text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {{ creating ? "Preparazione in corso…" : "Crea visita su misura" }}
      </button>
      <p v-if="customError" class="mt-3 text-sm text-red-600" role="alert">
        {{ customError }}
      </p>
    </div>
  </section>
</template>
