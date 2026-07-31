<script setup lang="ts">
/**
 * IL COMANDO VOCALE.
 *
 * Sta nel piede della scheda, sempre visibile: per chi non vede e' l'ingresso
 * principale all'applicazione, non un'alternativa, e tenerlo in fondo a un
 * pannello di opzioni era il difetto di accessibilita' che pesava di piu'.
 *
 * Ogni cambio di stato viene annunciato, e il comando riconosciuto viene
 * ripetuto PRIMA di essere eseguito: cosi' si sa sempre cosa sta per succedere.
 *
 * L'esito negativo si ANNUNCIA e si SCRIVE. Annunciarlo soltanto lo consegnava
 * alla sola regione viva, quindi chi guarda lo schermo vedeva "Sto capendo…",
 * poi di nuovo "Parla", e nient'altro: il comando sembrava non fare niente.
 * Il messaggio scritto non ha `role="alert"` perche' `announce` ha gia' detto la
 * stessa frase, e due regioni vive la farebbero leggere due volte.
 */
import { ref, watch, onUnmounted, computed } from "vue";
import { sendAudioToBackend } from "@/api";
import {
  isRecording,
  finalBlob,
  errorMsg,
  startRecording,
  stopRecording,
} from "./useSTT";
import { useAnnouncer } from "@/composables/useAnnouncer";
import { labelForCommand } from "../../../../shared/constants";
import { language } from "@/state";

const emit = defineEmits<{ action: [value: string] }>();

const { announce } = useAnnouncer();
const processing = ref(false);
const esito = ref("");

function riferisci(testo: string) {
  esito.value = testo;
  announce(testo);
}

const stato = computed(() => {
  if (isRecording.value) return "registrando";
  if (processing.value) return "elaborando";
  return "fermo";
});

const label = computed(() => {
  if (stato.value === "registrando") return "Interrompi e invia";
  if (stato.value === "elaborando") return "Sto capendo…";
  return "Parla";
});

async function press() {
  if (processing.value) return;
  if (isRecording.value) {
    stopRecording();
    return;
  }
  esito.value = "";
  await startRecording();
  if (isRecording.value) announce("Registrazione avviata. Parla pure.");
}

watch(finalBlob, async (blob) => {
  if (!blob) return;
  processing.value = true;
  esito.value = "";
  announce("Sto capendo il comando");
  try {
    const result = await sendAudioToBackend(blob, language.value.stt);
    const command = result && result.mappedTranscript;
    if (command) {
      announce(`Comando: ${labelForCommand(command)}`);
      emit("action", command);
    } else {
      riferisci("Non ho capito. Prova a ripetere, oppure usa i pulsanti.");
    }
  } catch {
    // Il server distingue "non ho capito" da "non rispondo": qui si arriva solo
    // nel secondo caso, e ripetere la frase non servirebbe a niente.
    riferisci("Il comando vocale non è disponibile ora. Usa i pulsanti qui sopra.");
  } finally {
    processing.value = false;
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
      :disabled="processing"
      @click="press"
    >
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
      {{ label }}
    </button>

    <p v-if="errorMsg" class="avviso mt-2 text-danger" role="alert">
      {{ errorMsg }}
    </p>
    <p v-else-if="esito" class="avviso mt-2">
      {{ esito }}
    </p>
  </div>
</template>
