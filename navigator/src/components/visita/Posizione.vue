<script setup lang="ts">
/**
 * DOVE SONO — un solo ingresso, due modi, nessuno dei due privilegiato.
 *
 * Inquadrare un QR accanto a un quadro e' esattamente il gesto che una persona
 * cieca non puo' compiere, in un'app il cui scopo e' parlarle. Ed e' anche il
 * gesto che fallisce fuori da un contesto sicuro: aprendo il navigator con
 * l'IP della rete locale — il modo normale di provarlo su un telefono —
 * getUserMedia semplicemente non c'e'.
 *
 * Lo stesso campo risolve entrambe le cose: il codice dell'opera, stampato sul
 * foglio accanto al QR, si puo' digitare. Un solo campo incollabile, mai
 * spezzato in caselle, mai a tempo (WCAG 2.2, 3.3.8).
 */
import { ref, watch, onUnmounted, computed } from "vue";
import { useQRScanner } from "@/composables/useQRScanner";

const emit = defineEmits<{ found: [qid: string]; close: [] }>();

const scanner = useQRScanner();
const video = ref<HTMLVideoElement | null>(null);
const code = ref("");
const codeError = ref("");

const cameraAvailable = computed(
  () => window.isSecureContext && !!navigator.mediaDevices,
);
const sheet = ref<"qr" | "codice">(cameraAvailable.value ? "qr" : "codice");

function extractQid(raw: string): string {
  const m = raw.trim().toUpperCase().match(/Q\d+/);
  return m ? m[0] : "";
}

watch(
  [video, sheet],
  ([el, s]) => {
    if (s !== "qr") {
      scanner.stop();
      return;
    }
    if (!el) return;
    scanner.start(el, (data) => {
      const qid = extractQid(data);
      scanner.stop();
      if (qid) emit("found", qid);
    });
  },
  { immediate: true },
);

function submitCode() {
  const qid = extractQid(code.value);
  if (!qid) {
    codeError.value =
      "Codice non riconosciuto. È scritto sotto il QR, e comincia per Q.";
    return;
  }
  codeError.value = "";
  emit("found", qid);
}

onUnmounted(() => scanner.stop());
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
    @keydown.escape="emit('close')"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="posizione-titolo"
      class="lastra w-full max-w-md p-5 shadow-l2"
    >
      <div class="flex items-start justify-between gap-3">
        <h2 id="posizione-titolo" class="font-display text-title-2">Dove sono?</h2>
        <button
          type="button"
          class="icona-mini"
          aria-label="Chiudi"
          @click="emit('close')"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="segmenti mt-4" role="tablist" aria-label="Come indicare l'opera">
        <button
          type="button"
          role="tab"
          :aria-selected="sheet === 'qr'"
          :disabled="!cameraAvailable"
          class="segmento"
          :class="sheet === 'qr' ? 'segmento-attivo' : ''"
          @click="sheet = 'qr'"
        >
          Inquadra il QR
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="sheet === 'codice'"
          class="segmento"
          :class="sheet === 'codice' ? 'segmento-attivo' : ''"
          @click="sheet = 'codice'"
        >
          Scrivi il codice
        </button>
      </div>

      <p v-if="!cameraAvailable" class="avviso mt-4">
        La fotocamera funziona solo su indirizzi sicuri (https o localhost).
        Scrivi il codice stampato sotto il QR.
      </p>

      <!-- QR -->
      <div v-show="sheet === 'qr' && cameraAvailable" class="mt-4">
        <div class="relative overflow-hidden rounded-plate bg-black">
          <video ref="video" class="aspect-square w-full object-cover" playsinline muted></video>
          <div
            class="pointer-events-none absolute inset-8 rounded-plate border-2 border-white/70"
            aria-hidden="true"
          ></div>
        </div>
        <p v-if="scanner.error.value" class="avviso mt-3 text-danger" role="alert">
          {{ scanner.error.value }}
        </p>
        <p v-else class="mt-3 text-small text-muted">
          Inquadra il QR posto accanto all'opera.
        </p>
      </div>

      <!-- Codice digitato -->
      <form v-show="sheet === 'codice'" class="mt-4" @submit.prevent="submitCode">
        <label for="codice-opera" class="etichetta">Codice dell'opera</label>
        <p class="mt-1 text-caption text-muted">
          È stampato sotto il QR, accanto all'opera.
        </p>
        <input
          id="codice-opera"
          v-model="code"
          type="text"
          inputmode="text"
          autocomplete="off"
          spellcheck="false"
          class="campo font-mono text-title-3 uppercase"
          placeholder="Q12418"
          :aria-describedby="codeError ? 'codice-errore' : undefined"
        />
        <p v-if="codeError" id="codice-errore" class="mt-2 text-small text-danger" role="alert">
          {{ codeError }}
        </p>
        <button type="submit" class="btn-primario mt-4 w-full justify-center" :disabled="!code.trim()">
          Portami qui
        </button>
      </form>
    </div>
  </div>
</template>
