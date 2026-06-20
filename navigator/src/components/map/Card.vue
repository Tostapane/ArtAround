<script setup lang="ts">
import type { Match } from "../../../../shared/types";
import { useTTS } from "./speech/useTTS";

defineProps<{
  content: Match;
}>();
const emit = defineEmits<{
  navigation: [value: string];
  toggleOptions: [];
}>();

const tts = useTTS();
</script>

<template>
  <article
    class="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
  >
    <!-- Immagine dell'opera -->
    <div
      v-if="content.artwork.imagePath"
      class="flex shrink-0 justify-center bg-surface-2"
    >
      <img
        :src="'http://localhost:8000' + content.artwork.imagePath"
        :alt="'Immagine dell\'opera: ' + content.artwork.name"
        class="h-48 w-full object-contain sm:h-64"
      />
    </div>

    <div class="flex flex-grow flex-col overflow-y-auto p-5 sm:p-6">
      <div class="mb-1 flex items-start justify-between gap-3">
        <h2
          id="card-title"
          class="text-xl font-bold leading-tight tracking-tight text-text"
        >
          {{ content.artwork.name }}
        </h2>

        <div class="flex shrink-0 items-center gap-1">
          <!-- Lettura ad alta voce della descrizione (TTS) -->
          <button
            v-if="!tts.isSpeaking.value"
            type="button"
            @click="tts.speak(content.item.text)"
            class="rounded-md p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text"
            aria-label="Leggi la descrizione ad alta voce"
          >
            <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4.03v8.05A4.5 4.5 0 0016.5 12z"
              />
            </svg>
          </button>
          <button
            v-else
            type="button"
            @click="tts.stop()"
            class="rounded-md p-2 text-accent transition-colors hover:bg-surface-2"
            aria-label="Ferma la lettura"
          >
            <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6h12v12H6z" />
            </svg>
          </button>

          <!-- Chiudi -->
          <button
            type="button"
            @click="emit('navigation', 'close')"
            class="rounded-md p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text"
            aria-label="Chiudi la scheda dell'opera"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <p class="mb-4 text-sm font-medium text-muted">
        {{ content.artwork.author.name }}
      </p>

      <p class="text-base leading-relaxed text-text">
        {{ content.item.text }}
      </p>

      <div class="mt-6 flex gap-2 border-t border-border pt-4">
        <button
          type="button"
          @click="emit('navigation', 'prev')"
          class="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
        >
          Precedente
        </button>
        <button
          type="button"
          @click="emit('toggleOptions')"
          class="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
        >
          Opzioni
        </button>
        <button
          type="button"
          @click="emit('navigation', 'next')"
          class="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-colors hover:opacity-90"
        >
          Successivo
        </button>
      </div>
    </div>
  </article>
</template>
