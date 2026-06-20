<script setup lang="ts">
import { sendAudioToBackend } from "@/api";
import { ref, watch, onUnmounted } from "vue";
import {
  isRecording,
  finalBlob,
  errorMsg,
  startRecording,
  stopRecording,
} from "./useMediaRecorder";
import { useAnnouncer } from "@/composables/useAnnouncer";
import { language } from "@/state";

const emit = defineEmits<{
  action: [value: string];
}>();

const { announce } = useAnnouncer();
const isProcessing = ref(false);

const toggle = async () => {
  if (isRecording.value) {
    stopRecording();
  } else {
    await startRecording();
    if (isRecording.value) announce("Registrazione avviata");
  }
};

// invio automatico al server appena la registrazione produce un audio
watch(finalBlob, async (blob) => {
  if (!blob) return;
  isProcessing.value = true;
  announce("Invio del comando vocale in corso");
  try {
    // invia anche la lingua in cui parla l'utente (per il riconoscimento vocale)
    const result = await sendAudioToBackend(blob, language.value.stt);
    if (result.mappedTranscript) {
      announce("Comando riconosciuto: " + result.mappedTranscript);
      emit("action", result.mappedTranscript);
    } else {
      announce("Comando non riconosciuto");
    }
  } catch (err) {
    announce("Errore nell'invio del comando vocale");
  } finally {
    isProcessing.value = false;
  }
});

onUnmounted(() => {
  if (isRecording.value) stopRecording();
});
</script>

<template>
  <div class="flex flex-col gap-2 border-t border-border pt-4">
    <button
      type="button"
      @click="toggle"
      :disabled="isProcessing"
      :aria-pressed="isRecording"
      class="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      <span
        v-if="isRecording"
        class="h-2.5 w-2.5 rounded-full bg-current motion-safe:animate-pulse"
        aria-hidden="true"
      ></span>
      {{
        isRecording
          ? "Interrompi e invia"
          : isProcessing
            ? "Elaborazione…"
            : "Comando vocale"
      }}
    </button>

    <p
      v-if="errorMsg"
      class="rounded-md bg-surface-2 px-3 py-2 text-sm text-danger"
      role="alert"
    >
      {{ errorMsg }}
    </p>
  </div>
</template>
