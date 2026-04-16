<script setup lang="ts">
import type { Match } from "../../../../shared/types";
defineProps<{
  content: Match;
}>();
const emit = defineEmits<{
  navigation: [value: string];
  toggleOptions: [];
}>();
</script>

<template>
  <div
    class="relative w-full max-w-lg max-h-full flex flex-col bg-white border border-gray-200 rounded-xl shadow-2xl z-20 overflow-hidden"
    aria-live="polite"
  >
    <!-- Artwork Image -->
    <div
      v-if="content.artwork.imagePath"
      class="w-full bg-gray-100 flex justify-center shrink-0"
    >
      <img
        :src="'http://localhost:8000' + content.artwork.imagePath"
        :alt="'Immagine dell\'opera: ' + content.artwork.name"
        class="w-full h-48 sm:h-64 object-contain"
      />
    </div>

    <div class="p-4 sm:p-6 overflow-y-auto flex-grow">
      <div class="flex items-start justify-between mb-4 gap-4">
        <h3 class="text-xl font-bold leading-tight text-gray-900">
          {{ content.artwork.name }}
        </h3>
        <button
          @click="emit('navigation', 'close')"
          class="p-1 shrink-0 text-gray-400 rounded hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900"
          aria-label="Close information card"
        >
          <svg
            class="w-5 h-5"
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

      <p class="text-base text-gray-600 mb-6">
        {{ content.artwork.author.name }}
        <br />
        {{ content.item.text }}
      </p>

      <div
        class="flex justify-between mt-4 pt-4 border-t border-gray-100 gap-2"
      >
        <button
          @click="emit('navigation', 'prev')"
          class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          Previous
        </button>
        <button
          @click="emit('toggleOptions')"
          class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          Options
        </button>
        <button
          @click="emit('navigation', 'next')"
          class="flex-1 px-4 py-2 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
