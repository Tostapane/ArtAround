<script setup lang="ts">
import { computed } from "vue";
import { useTheme } from "@/composables/useTheme";

const { isDark, toggle } = useTheme();

// etichetta dinamica: descrive l'azione, non lo stato (piu' chiaro per gli screen reader)
const label = computed(() =>
  isDark() ? "Attiva il tema chiaro" : "Attiva il tema scuro",
);
</script>

<template>
  <button
    type="button"
    @click="toggle"
    :aria-label="label"
    :aria-pressed="isDark()"
    :title="label"
    class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-text transition-colors hover:bg-surface-2"
  >
    <!-- icona luna (tema chiaro attivo → propone scuro) -->
    <svg
      v-if="!isDark()"
      class="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
      />
    </svg>
    <!-- icona sole (tema scuro attivo → propone chiaro) -->
    <svg
      v-else
      class="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        stroke-linecap="round"
        d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  </button>
</template>
