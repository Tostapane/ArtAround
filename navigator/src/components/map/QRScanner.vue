<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";
import { Dialog, DialogPanel } from "@headlessui/vue";
import { useQRScanner } from "@/composables/useQRScanner";

const emit = defineEmits<{
  scan: [qid: string];
  close: [];
}>();

const video = ref<HTMLVideoElement | null>(null);
const scanner = useQRScanner();

// Il payload del QR e' il qid nudo ("Q123"), ma siamo tolleranti: se fosse un
// URL (es. deep-link) estraiamo comunque il qid.
function extractQid(payload: string): string {
  const match = payload.trim().match(/Q\d+/);
  if (match) return match[0];
  return payload.trim();
}

// avvia la fotocamera appena l'elemento <video> esiste davvero nel DOM.
// (il Dialog headless puo' montare il <video> DOPO l'onMounted di questo
// componente: affidarsi a onMounted lascerebbe video.value a null e la
// fotocamera non partirebbe — schermo nero, nessuna richiesta di permesso.)
const stopWatch = watch(
  video,
  (el) => {
    if (!el) return;
    scanner.start(el, (data) => {
      const qid = extractQid(data);
      scanner.stop();
      emit("scan", qid);
    });
    stopWatch();
  },
  { immediate: true },
);

onUnmounted(() => {
  scanner.stop();
});
</script>

<template>
  <Dialog :open="true" @close="$emit('close')" class="relative z-[60]">
    <div class="fixed inset-0 bg-black/70" aria-hidden="true" />
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel
        class="flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-surface p-5"
      >
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-muted">
            Scansiona il QR dell'opera
          </h2>
          <button
            type="button"
            @click="$emit('close')"
            aria-label="Chiudi lo scanner"
            class="rounded-md p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="relative overflow-hidden rounded-lg bg-black">
          <video
            ref="video"
            class="aspect-square w-full object-cover"
            playsinline
            muted
          ></video>
          <div
            class="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/70"
            aria-hidden="true"
          ></div>
        </div>

        <p v-if="scanner.error.value" class="text-sm text-danger" role="alert">
          {{ scanner.error.value }}
        </p>
        <p v-else class="text-sm text-muted">
          Inquadra il QR posto accanto all'opera.
        </p>
      </DialogPanel>
    </div>
  </Dialog>
</template>
