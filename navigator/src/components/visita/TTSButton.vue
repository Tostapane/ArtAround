<script setup lang="ts">
/** Controllo unico per avviare, attendere e fermare la lettura ad alta voce. */
import { computed } from "vue";
import { t } from "@/i18n";
import { useTTS } from "./useTTS";

const props = defineProps<{
  text: string;
  label: string;
  disabled?: boolean;
  activeClass?: string;
}>();

const tts = useTTS();
const active = computed(() => tts.isLoading.value || tts.isSpeaking.value);

function toggle() {
  if (active.value) {
    tts.stop();
    return;
  }
  void tts.speak(props.text);
}
</script>

<template>
  <button
    type="button"
    :class="active ? activeClass || 'text-accent' : ''"
    :disabled="!active && (disabled || !text.trim())"
    :aria-busy="tts.isLoading.value"
    :aria-pressed="active"
    :aria-label="active ? t('Ferma la lettura') : label"
    @click="toggle"
  >
    <span
      v-if="tts.isLoading.value"
      class="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden="true"
    ></span>
    <svg
      v-else
      class="h-5 w-5"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        :d="tts.isSpeaking.value
          ? 'M6 6h12v12H6z'
          : 'M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z'"
      />
    </svg>
  </button>
</template>
