<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { getInfo } from "@/api";
import type { Artwork, Match } from "../../../../shared/types";
const props = defineProps<{
  request: string;
  about: Match;
  // artwork: Artwork;
}>();
/*
      AGGIUNGERE SPIEGAZIONI!
  */
const responseText = ref("Loading...");

// This watches for changes and updates responseText automatically
watch(
  () => [props.request, props.about],
  async () => {
    responseText.value = "Loading...";
    try {
      responseText.value = await getInfo(props.about.item.text, props.request);
    } catch (e) {
      responseText.value = "Error loading information.";
    }
  },
  { immediate: true }, // Run it once on mount
);
const containerClasses = [
  "absolute z-30 p-4 bg-white/95 backdrop-blur-md border border-gray-200 shadow-xl rounded-xl",
  "w-[calc(100%-2rem)] max-w-md",
  "top-6 left-1/2 -translate-x-1/2",
  "md:top-8",
].join(" ");
</script>

<template>
  <div :class="containerClasses" aria-live="polite">
    <div class="flex items-start justify-between mb-2">
      <h4 class="text-xs font-bold tracking-wider text-black uppercase">
        {{ request }}
      </h4>
      <button
        class="p-1 -mt-1 -mr-1 text-gray-400 rounded-md hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900"
        @click="$emit('close')"
        aria-label="Close"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          ></path>
        </svg>
      </button>
    </div>
    <p class="text-sm text-gray-800">
      {{ responseText }}
    </p>
  </div>
</template>
