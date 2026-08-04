<script setup lang="ts">
/**
 * Dove sono: un solo ingresso, quattro modi, nessuno privilegiato.
 *
 * Inquadrare un QR accanto a un quadro e' il gesto che una persona cieca non puo'
 * compiere, in un'applicazione fatta per parlarle, ed e' anche quello che manca
 * fuori da un contesto sicuro. Lo stesso campo risolve entrambe le cose: il
 * codice stampato accanto al QR si puo' digitare. Un campo solo, incollabile, mai
 * spezzato in caselle e mai a tempo (WCAG 2.2, 3.3.8).
 *
 * La terza scheda e' la localizzazione automatica (slide 33): il calcolo sta in
 * `localization.ts`, qui c'e' solo il momento in cui lo si interroga, premendo e
 * mai da sola. Quando non vince nessuna opera si mostrano le candidate e sceglie
 * il visitatore, con le immagini piccole e sfocate che la slide chiede: a chi
 * riconosce il quadro che ha davanti basta la sagoma, e nitide sarebbero l'app
 * che gli mostra l'opera invece di aiutarlo a dire quale sia.
 *
 * L'interruttore in cima decide se l'applicazione tiene conto di dove si e'.
 * Parte spento, e finche' lo e' non si legge nessun sensore e non si chiede
 * nessun permesso. QR e codice restano accesi comunque, perche' NOMINANO un
 * oggetto invece di misurare una posizione.
 *
 * La quarta e' il teletrasporto (slide 34): sposta il visitatore su un punto
 * della pianta e nient'altro, ed e' l'unico comando che muove la posizione senza
 * un sensore. Qui e' solo un interruttore, perche' il salto si fa toccando la
 * pianta, che questo pannello coprirebbe.
 */
import { ref, watch, onUnmounted, computed } from "vue";
import { useQRScanner } from "@/composables/useQRScanner";
import { artworkByQid } from "@/state";
import { mediaOrigin } from "@/config";
import { bussola, localizzabile, rank, stima, type Candidato } from "@/localization";
import { t } from "@/i18n";

const props = defineProps<{ sensorError: string; posizioneAttiva: boolean }>();
const emit = defineEmits<{
  found: [qid: string];
  arm: [];
  close: [];
  cambiaPosizione: [attiva: boolean];
}>();

const scanner = useQRScanner();
const video = ref<HTMLVideoElement | null>(null);
const code = ref("");
const codeError = ref("");

const cameraAvailable = computed(
  () => window.isSecureContext && !!navigator.mediaDevices,
);
const sheet = ref<"qr" | "codice" | "posizione" | "teletrasporto">(
  cameraAvailable.value ? "qr" : "codice",
);

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

// --- Localizzazione automatica ---------------------------------------------

const candidati = ref<Candidato[]>([]);
const esitoVuoto = ref("");

const statoSensori = computed(() => {
  const parti: string[] = [];
  const dove = stima.value;
  if (dove) parti.push(`posizione nota a circa ${Math.round(dove.accuracy)} m`);
  else parti.push("posizione non ancora rilevata");
  if (bussola.value === null) parti.push("nessuna bussola");
  else parti.push(`bussola a ${Math.round(bussola.value)}°`);
  return parti.join(" · ");
});

function nomeOpera(qid: string): string {
  const opera = artworkByQid(qid);
  if (opera) return opera.name;
  return qid;
}

function immagineOpera(qid: string): string {
  const opera = artworkByQid(qid);
  if (!opera || !opera.imagePath) return "";
  if (opera.imagePath.startsWith("http")) return opera.imagePath;
  return mediaOrigin() + opera.imagePath;
}

function trova() {
  esitoVuoto.value = "";
  candidati.value = [];
  const verdetto = rank();
  if (!verdetto || verdetto.candidati.length === 0) {
    esitoVuoto.value =
      t("Non riesco ancora a capire dove sei. Inquadra il QR o scrivi il codice.");
    return;
  }
  const primo = verdetto.candidati[0];
  if (verdetto.sicuro && primo) {
    emit("found", primo.qid);
    return;
  }
  candidati.value = verdetto.candidati;
}

function submitCode() {
  const qid = extractQid(code.value);
  if (!qid) {
    codeError.value =
      t("Codice non riconosciuto. È scritto sotto il QR, e comincia per Q.");
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
        <h2 id="posizione-titolo" class="font-display text-title-2">{{ t("Dove sono?") }}</h2>
        <button
          type="button"
          class="icona-mini"
          :aria-label="t('Chiudi')"
          @click="emit('close')"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <label class="mt-4 flex cursor-pointer items-center gap-3 rounded-card border border-line bg-surface-2 px-4 py-3">
        <input
          type="checkbox"
          class="h-5 w-5 shrink-0 accent-[var(--accent)]"
          :checked="props.posizioneAttiva"
          @change="emit('cambiaPosizione', ($event.target as HTMLInputElement).checked)"
        />
        <span class="text-small">
          <span class="font-medium">{{ t("Tieni conto di dove sono") }}</span>
          <span class="block text-caption text-muted">
            {{ t("Le indicazioni partono da dove ti trovi, invece che dall'opera aperta.") }}
          </span>
        </span>
      </label>

      <div class="segmenti mt-4" role="tablist" :aria-label="t(`Come indicare l'opera`)">
        <button
          type="button"
          role="tab"
          :aria-selected="sheet === 'qr'"
          :disabled="!cameraAvailable"
          class="segmento"
          :class="sheet === 'qr' ? 'segmento-attivo' : ''"
          @click="sheet = 'qr'"
        >
          {{ t("Inquadra il QR") }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="sheet === 'codice'"
          class="segmento"
          :class="sheet === 'codice' ? 'segmento-attivo' : ''"
          @click="sheet = 'codice'"
        >
          {{ t("Scrivi il codice") }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="sheet === 'posizione'"
          class="segmento"
          :class="sheet === 'posizione' ? 'segmento-attivo' : ''"
          @click="sheet = 'posizione'"
        >
          {{ t("Trovami") }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="sheet === 'teletrasporto'"
          class="segmento"
          :class="sheet === 'teletrasporto' ? 'segmento-attivo' : ''"
          @click="sheet = 'teletrasporto'"
        >
          {{ t("Teletrasporto") }}
        </button>
      </div>

      <p v-if="!cameraAvailable" class="avviso mt-4">
        {{ t("La fotocamera funziona solo su indirizzi sicuri (https o localhost). Scrivi il codice stampato sotto il QR.") }}
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
          {{ t("Inquadra il QR posto accanto all'opera.") }}
        </p>
      </div>

      <!-- Codice digitato -->
      <form v-show="sheet === 'codice'" class="mt-4" @submit.prevent="submitCode">
        <label for="codice-opera" class="etichetta">{{ t("Codice dell'opera") }}</label>
        <p class="mt-1 text-caption text-muted">
          {{ t("È stampato sotto il QR, accanto all'opera.") }}
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
          {{ t("Portami qui") }}
        </button>
      </form>

      <!-- Localizzazione automatica -->
      <div v-show="sheet === 'posizione'" class="mt-4">
        <p v-if="!localizzabile" class="avviso">
          {{ t("La pianta di questo museo non porta la propria misura, quindi non posso convertire un passo in metri. Inquadra il QR o scrivi il codice.") }}
        </p>
        <template v-else>
          <p class="text-small text-muted">
            {{ statoSensori }}
          </p>
          <p v-if="props.sensorError" class="avviso mt-3 text-danger" role="alert">
            {{ props.sensorError }}
          </p>
          <p v-else-if="bussola === null" class="mt-3 text-caption text-muted">
            {{ t("Senza bussola posso solo dirti quali opere ti sono vicine: la scelta resta a te.") }}
          </p>

          <button type="button" class="btn-primario mt-4 w-full justify-center" @click="trova">
            {{ t("Trova l'opera che ho davanti") }}
          </button>

          <p v-if="esitoVuoto" class="avviso mt-4" role="alert">{{ esitoVuoto }}</p>

          <div v-if="candidati.length" class="mt-5">
            <h3 class="text-small font-medium">{{ t("Quale hai davanti?") }}</h3>
            <ul class="mt-3 grid grid-cols-2 gap-3">
              <li v-for="c in candidati" :key="c.qid">
                <button
                  type="button"
                  class="lastra w-full overflow-hidden p-0 text-left transition-colors hover:bg-surface-2"
                  @click="emit('found', c.qid)"
                >
                  <img
                    v-if="immagineOpera(c.qid)"
                    :src="immagineOpera(c.qid)"
                    alt=""
                    loading="lazy"
                    class="h-24 w-full object-cover blur-[3px]"
                  />
                  <span class="block px-3 py-2">
                    <span class="block text-small font-medium">{{ nomeOpera(c.qid) }}</span>
                    <span class="block text-caption text-muted">
                      {{ Math.round(c.p * 100) }}%
                    </span>
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </template>
      </div>

      <!-- Teletrasporto -->
      <div v-show="sheet === 'teletrasporto'" class="mt-4">
        <p class="text-small text-muted">
          {{ t("Ti porta dove vuoi sulla pianta senza attraversare il museo: il tocco successivo ti sposta lì, su una tappa o sul pavimento. Non apre nessuna tappa: da lì premi «Trovami».") }}
        </p>

        <p v-if="!localizzabile" class="avviso mt-4">
          {{ t("La pianta di questo museo non porta la propria misura, quindi da un punto qualunque non saprei calcolare niente.") }}
        </p>
        <button v-else type="button" class="btn-primario mt-4 w-full justify-center" @click="emit('arm')">
          {{ t("Scegli il punto sulla pianta") }}
        </button>
      </div>
    </div>
  </div>
</template>
