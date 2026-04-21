<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import DropDownMenu from "./DropDownMenu.vue";
import { getVisits } from "./../../api.ts";
import type { Visit } from "../../../../shared/types";

const emit = defineEmits<{
  currVisit: [id: string];
}>();

// carico tutte le visite del database
const visits = ref<Visit[]>();
onMounted(async () => {
  visits.value = await getVisits();
});

interface State {
  level: string;
  duration: number;
}

// default placeholder
const filters = ref<State>({ level: "Principiante", duration: 30 });

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

function emitMatchingVisit() {
  if (!visits.value) return;
  const match = visits.value.find(
    (v) =>
      v.level === filters.value.level && v.duration === filters.value.duration,
  );
  if (match) {
    emit("currVisit", match["@id"]);
  }
}

function processChoice<K extends keyof State>(key: K, value: State[K]) {
  filters.value[key] = value;
  emitMatchingVisit();
}
</script>

<template>
  <div class="w-full p-6">
    <h2 class="text-xl font-bold text-gray-900 mb-6">
      Personalizza la tua visita
    </h2>

    <div class="space-y-5">
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-gray-700"
          >Livello di esperienza</label
        >
        <DropDownMenu
          class="w-full"
          :label="filters.level"
          :items="availableLevels"
          @selected="(val) => processChoice('level', val as string)"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-gray-700"
          >Durata per opera (minuti)</label
        >
        <DropDownMenu
          class="w-full"
          :label="filters.duration"
          :items="availableDurations"
          @selected="(val) => processChoice('duration', val as number)"
        />
      </div>
    </div>

    <div class="mt-6 pt-4 border-t border-gray-100">
      <p class="text-sm text-gray-500">
        Tempo stimato:
        <span class="font-semibold text-black"
          >{{ filters.duration }} min per opera</span
        >
      </p>
    </div>
  </div>
</template>
