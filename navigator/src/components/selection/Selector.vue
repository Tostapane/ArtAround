<script setup lang="ts">
import { ref, watch, computed } from "vue";
import DropDownMenu from "./DropDownMenu.vue";
import LanguageSelector from "./LanguageSelector.vue";
import { getVisitsByMuseum } from "./../../api.ts";
import type { Visit } from "../../../../shared/types";
import { museum } from "@/state.ts";

const emit = defineEmits<{
  currVisit: [id: string];
  start: [info: { level: string; duration: number }];
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
    emitMatchingVisit();
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

function emitMatchingVisit() {
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
  emit("currVisit", matchedId.value);
}

function processChoice<K extends keyof State>(key: K, value: State[K]) {
  filters.value[key] = value;
  emitMatchingVisit();
}

function start() {
  if (!canStart.value) return;
  emit("start", { level: filters.value.level, duration: filters.value.duration });
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
  </section>
</template>
