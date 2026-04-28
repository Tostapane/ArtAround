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
    let request = "no";
    // rimuove spazi in eccesso e \n
    const cleanRequest = props.request.trim();
    switch (cleanRequest) {
      case "Non ho capito":
        request = "Spiegalo con parole diverese";
        break;
      case "Sintetizza":
        request = "Riassumi in meno parole il testo";
        break;
      case "Approfondisci":
        request = "Approfondisci ";
        break;
      case "Semplifica":
        request = "Spiegalo in maniera piu' semplice";
        break;
      case "Chi e' l'autore?":
        request = "Dimmi di piu' su l'autore, e la sua vita";
        break;
      case "Che stile e?":
        request = "Raccontami di piu' sullo stile di cui questa opera fa parte";
        break;
      case "Dove esco?":
        request = "no";
        break;
      case "Dove e il bagno?":
        request = "no";
        break;
      case "Dove e il bar?":
        request = "no";
        break;
      case "Dove e lo shop?":
        request = "no";
        break;
      case "Ci sono ostacoli?":
        request = "no";
        break;
    }

    responseText.value = "Loading...";
    try {
      responseText.value = await getInfo(props.about.item.text, request);
    } catch (e) {
      responseText.value = "Error loading information.";
    }
  },
  { immediate: true }, // Run it once on mount
);
const containerClasses = [
  "flex flex-col p-4 bg-white/95 backdrop-blur-md border border-gray-200 shadow-xl rounded-xl w-full shrink-0",
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
