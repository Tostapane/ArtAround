<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from "vue";
import { sendAudioToBackend } from "@/api";
import {
  isRecording,
  finalBlob,
  errorMsg,
  startRecording,
  stopRecording,
} from "./useVoce";
import { useAnnouncer } from "@/composables/useAnnouncer";
import { labelForCommand } from "../../../../shared/constants";
import { language } from "@/state";

/**
 * IL COMANDO VOCALE — promosso a controllo permanente della scheda.
 *
 * Prima stava in fondo al pannello delle opzioni, due tocchi sotto. Per chi non
 * vede, questo e' l'ingresso PRINCIPALE all'applicazione, non un'alternativa:
 * tenerlo sepolto era il difetto di accessibilita' che pesava di piu' in tutta
 * l'app. Ogni cambio di stato viene annunciato, e il comando riconosciuto viene
 * ripetuto prima di essere eseguito — cosi' si sa sempre cosa sta per succedere.
 */

const emit = defineEmits<{ action: [value: string] }>();

const { announce } = useAnnouncer();
const inElaborazione = ref(false);

const stato = computed(() => {
  if (isRecording.value) return "registrando";
  if (inElaborazione.value) return "elaborando";
  return "fermo";
});

const etichetta = computed(() => {
  if (stato.value === "registrando") return "Interrompi e invia";
  if (stato.value === "elaborando") return "Sto capendo…";
  return "Parla";
});

async function premi() {
  if (inElaborazione.value) return;
  if (isRecording.value) {
    stopRecording();
    return;
  }
  await startRecording();
  if (isRecording.value) announce("Registrazione avviata. Parla pure.");
}

// Appena la registrazione produce un audio lo si manda al server.
watch(finalBlob, async (blob) => {
  if (!blob) return;
  inElaborazione.value = true;
  announce("Sto capendo il comando");
  try {
    const result = await sendAudioToBackend(blob, language.value.stt);
    const comando = result && result.mappedTranscript;
    if (comando) {
      // Si ripete il comando riconosciuto PRIMA di eseguirlo.
      announce(`Comando: ${labelForCommand(comando)}`);
      emit("action", comando);
    } else {
      announce("Non ho capito. Prova a ripetere, oppure usa i pulsanti.");
    }
  } catch {
    announce("Non sono riuscito a inviare il comando vocale.");
  } finally {
    inElaborazione.value = false;
  }
});

onUnmounted(() => {
  if (isRecording.value) stopRecording();
});
</script>

<template>
  <div class="flex flex-col">
    <button
      type="button"
      class="btn-primario w-full justify-center"
      :class="isRecording ? 'bg-danger text-on-danger' : ''"
      :aria-pressed="isRecording"
      :disabled="inElaborazione"
      @click="premi"
    >
      <!-- Registrazione in corso: pallino fermo, non pulsante (reduced-motion) -->
      <span
        v-if="isRecording"
        class="h-2.5 w-2.5 shrink-0 rounded-full bg-current"
        aria-hidden="true"
      ></span>
      <svg
        v-else
        class="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path stroke-linecap="round" d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
      {{ etichetta }}
    </button>

    <p v-if="errorMsg" class="avviso mt-2 text-danger" role="alert">
      {{ errorMsg }}
    </p>
  </div>
</template>
