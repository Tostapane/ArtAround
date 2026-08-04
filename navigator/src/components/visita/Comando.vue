<script setup lang="ts">
/**
 * Il comando vocale.
 *
 * Sta nel piede della scheda ed e' sempre visibile: per chi non vede e'
 * l'ingresso principale all'applicazione, non un'alternativa da scovare in fondo
 * a un pannello.
 *
 * Ogni cambio di stato viene annunciato, e il comando riconosciuto si ripete
 * prima di eseguirlo. L'esito negativo si annuncia E si scrive: annunciandolo
 * soltanto, chi guarda lo schermo vedrebbe "Sto capendo...", poi di nuovo
 * "Parla", e nient'altro. Il messaggio scritto non ha pero' `role="alert"`,
 * perche' `announce` ha gia' detto la stessa frase e due regioni vive la
 * farebbero leggere due volte.
 *
 * Quel messaggio racconta l'ultimo tentativo, non la visita: `tappa` serve a
 * sapere quando e' passato di moda, o un "Non ho capito" resterebbe scritto sotto
 * al microfono per tutto il percorso, come fosse il commento all'opera aperta.
 *
 * Mentre si registra il pulsante disegna il volume che il microfono sente: e'
 * l'unico segno che distingue "ti sto ascoltando" da un permesso concesso a un
 * dispositivo muto. Per lo screen reader e' `aria-hidden`, perche' una traccia
 * che cambia dieci volte al secondo non si legge e l'avvio e' gia' annunciato.
 */
import { ref, watch, onUnmounted, computed } from "vue";
import { sendAudioToBackend } from "@/api";
import {
  isRecording,
  finalBlob,
  errorMsg,
  levels,
  startRecording,
  stopRecording,
} from "./useSTT";
import { useAnnouncer } from "@/composables/useAnnouncer";
import { labelForCommand } from "../../../../shared/constants";
import { language } from "@/state";
import { t } from "@/i18n";

const props = defineProps<{ tappa: string }>();
const emit = defineEmits<{ action: [value: string] }>();

const { announce } = useAnnouncer();
const processing = ref(false);
const esito = ref("");

watch(
  () => props.tappa,
  () => {
    esito.value = "";
    errorMsg.value = null;
  },
);

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
  if (stato.value === "registrando") return t("Invia");
  if (stato.value === "elaborando") return t("Sto capendo…");
  return t("Parla");
});

async function press() {
  if (processing.value) return;
  if (isRecording.value) {
    stopRecording();
    return;
  }
  esito.value = "";
  await startRecording();
  if (isRecording.value) announce(t("Registrazione avviata. Parla pure."));
}

watch(finalBlob, async (blob) => {
  if (!blob) return;
  processing.value = true;
  esito.value = "";
  announce(t("Sto capendo il comando"));
  try {
    const result = await sendAudioToBackend(blob, language.value.stt);
    const command = result && result.mappedTranscript;
    if (command) {
      announce(t("Comando: {nome}", { nome: t(labelForCommand(command)) }));
      emit("action", command);
    } else {
      riferisci(t("Non ho capito. Prova a ripetere, oppure usa i pulsanti."));
    }
  } catch {
    // Il server distingue "non ho capito" da "non rispondo": qui si arriva solo
    // nel secondo caso, e ripetere la frase non servirebbe a niente.
    riferisci(t("Il comando vocale non è disponibile ora. Usa i pulsanti qui sopra."));
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
      <!-- LIVELLO DEL MICROFONO -->
      <span
        v-if="isRecording"
        class="flex h-5 shrink-0 items-center gap-px"
        aria-hidden="true"
      >
        <span
          v-for="(livello, i) in levels"
          :key="i"
          class="w-0.5 rounded-full bg-current transition-[height] duration-75"
          :style="{ height: `${2 + livello * 18}px` }"
        ></span>
      </span>
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
