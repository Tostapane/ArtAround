<script setup lang="ts">
import { computed } from "vue";
import { options } from "../../../../shared/constants";
import AudioRecorder from "./speech/AudioRecorder.vue";

defineEmits<{
  action: [value: string];
}>();

// raggruppa i comandi per "group" mantenendo l'ordine di constants.ts.
// Mostra solo i comandi con superficie "panel": quelli "card" (Prossimo/
// Precedente) hanno il loro pulsante equivalente dentro la scheda dell'opera.
const grouped = computed(() => {
  const map = new Map<string, typeof options>();
  for (const o of options) {
    if (o.surface !== "panel") continue;
    if (!map.has(o.group)) map.set(o.group, []);
    map.get(o.group)!.push(o);
  }
  return [...map.entries()].map(([group, items]) => ({ group, items }));
});
</script>

<template>
  <div
    class="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4"
  >
    <h2 class="text-sm font-semibold uppercase tracking-wider text-muted">
      Comandi vocali
    </h2>

    <div
      v-for="{ group, items } in grouped"
      :key="group"
      role="group"
      :aria-label="group"
      class="flex flex-col gap-2"
    >
      <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
        {{ group }}
      </h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in items"
          :key="option.id"
          type="button"
          @click="$emit('action', option.id)"
          class="rounded-md border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-2"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <!-- Comando vocale (registrazione → trascrizione → comando) -->
    <AudioRecorder @action="(a) => $emit('action', a)" />
  </div>
</template>
