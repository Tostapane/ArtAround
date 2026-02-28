<script setup lang="ts">
    import { ref } from 'vue'
    import DropDownMenu from './DropDownMenu.vue';
    let levels: string[] = ['Principiante', 'Intermedio', 'Esperto']
    let durations: number[] = [15, 30, 45, 60]

    interface State {
    level: string;
    duration: number;
    }
    const filters = ref<State>({ level: 'Principiante', duration: 30})

    function processChoice<K extends keyof State>(key: K, value: State[K]) {
        filters.value[key] = value
    }
</script>

<template>
  <div class="w-full max-w-md mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <h2 class="text-xl font-bold text-gray-900 mb-6">Personalizza la tua visita</h2>

    <div class="space-y-5">
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-gray-700">Livello di esperienza</label>
        <DropDownMenu
          class="w-full"
          :label="filters.level"
          :items="levels"
          @selected="(val) => processChoice('level', val as string)"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-gray-700">Durata (minuti)</label>
        <DropDownMenu
          class="w-full"
          :label="filters.duration"
          :items="durations"
          @selected="(val) => processChoice('duration', val as number)"
        />
      </div>
    </div>

    <div class="mt-6 pt-4 border-t border-gray-100">
      <p class="text-sm text-gray-500">
        Tempo stimato: <span class="font-semibold text-blue-600">{{ filters.duration }} min</span>
      </p>
    </div>
  </div>
</template>