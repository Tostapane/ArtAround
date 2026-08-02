<script setup lang="ts">
/**
 * DOVE SONO — un solo ingresso, tre modi, nessuno privilegiato.
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
 *
 * La terza scheda e' la localizzazione automatica (slide 33): il calcolo sta in
 * localization.ts, qui c'e' solo il momento in cui lo si interroga — premendo,
 * mai da sola. Quando non vince nessuna opera si mostrano le possibili con la
 * loro immagine e sceglie il visitatore: e' il comportamento che la slide
 * chiede, e insieme l'unico modo di far funzionare la cosa dove una bussola non
 * esiste. Le immagini sono le stesse del catalogo mostrate in piccolo — a chi
 * deve riconoscere un quadro che ha davanti basta la sagoma.
 *
 * L'INTERRUTTORE in cima decide se l'applicazione tiene conto di dove si e'.
 * Parte spento, e finche' lo e' non si legge nessun sensore, non si chiede
 * nessun permesso e le indicazioni partono dall'opera aperta. Il QR e il codice
 * digitato restano accesi comunque: NOMINANO un oggetto, non misurano una
 * posizione, ed e' il modo in cui una persona cieca dice dov'e'.
 *
 * LA QUARTA E' IL TELETRASPORTO (slide 34): sposta il visitatore in un punto
 * della pianta e nient'altro. E' l'unico comando che muove la posizione senza un
 * sensore, ed e' il motivo per cui esiste — da li' "Trovami" ragiona sui numeri
 * veri, quindi la localizzazione si mostra al chiuso, senza fogli stampati.
 * Qui e' solo un interruttore: il salto si fa toccando la pianta, che questo
 * pannello coprirebbe, percio' il bottone arma la modalita' e chiude.
 */
import { ref, watch, onUnmounted, computed } from "vue";
import { useQRScanner } from "@/composables/useQRScanner";
import { artworkByQid } from "@/state";
import { mediaOrigin } from "@/config";
import { bussola, localizzabile, rank, stima, type Candidato } from "@/localization";

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

/** Quel che i sensori sanno dire, detto a chi guarda: precisione e bussola. */
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
      "Non riesco ancora a capire dove sei. Inquadra il QR o scrivi il codice.";
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

      <label class="mt-4 flex cursor-pointer items-center gap-3 rounded-card border border-line bg-surface-2 px-4 py-3">
        <input
          type="checkbox"
          class="h-5 w-5 shrink-0 accent-[var(--accent)]"
          :checked="props.posizioneAttiva"
          @change="emit('cambiaPosizione', ($event.target as HTMLInputElement).checked)"
        />
        <span class="text-small">
          <span class="font-medium">Tieni conto di dove sono</span>
          <span class="block text-caption text-muted">
            Le indicazioni partono da dove ti trovi, invece che dall'opera aperta.
          </span>
        </span>
      </label>

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
        <button
          type="button"
          role="tab"
          :aria-selected="sheet === 'posizione'"
          class="segmento"
          :class="sheet === 'posizione' ? 'segmento-attivo' : ''"
          @click="sheet = 'posizione'"
        >
          Trovami
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="sheet === 'teletrasporto'"
          class="segmento"
          :class="sheet === 'teletrasporto' ? 'segmento-attivo' : ''"
          @click="sheet = 'teletrasporto'"
        >
          Teletrasporto
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

      <!-- Localizzazione automatica -->
      <div v-show="sheet === 'posizione'" class="mt-4">
        <p v-if="!localizzabile" class="avviso">
          La pianta di questo museo non porta la propria misura, quindi non posso
          convertire un passo in metri. Inquadra il QR o scrivi il codice.
        </p>
        <template v-else>
          <p class="text-small text-muted">
            {{ statoSensori }}
          </p>
          <p v-if="props.sensorError" class="avviso mt-3 text-danger" role="alert">
            {{ props.sensorError }}
          </p>
          <p v-else-if="bussola === null" class="mt-3 text-caption text-muted">
            Senza bussola posso solo dirti quali opere ti sono vicine: la scelta
            resta a te.
          </p>

          <button type="button" class="btn-primario mt-4 w-full justify-center" @click="trova">
            Trova l'opera che ho davanti
          </button>

          <p v-if="esitoVuoto" class="avviso mt-4" role="alert">{{ esitoVuoto }}</p>

          <div v-if="candidati.length" class="mt-5">
            <h3 class="text-small font-medium">Quale hai davanti?</h3>
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
                    class="h-24 w-full object-cover"
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
          Ti porta dove vuoi sulla pianta senza attraversare il museo: il tocco
          successivo ti sposta lì, su una tappa o sul pavimento. Non apre nessuna
          tappa — da lì premi «Trovami».
        </p>

        <p v-if="!localizzabile" class="avviso mt-4">
          La pianta di questo museo non porta la propria misura, quindi da un
          punto qualunque non saprei calcolare niente.
        </p>
        <button v-else type="button" class="btn-primario mt-4 w-full justify-center" @click="emit('arm')">
          Scegli il punto sulla pianta
        </button>
      </div>
    </div>
  </div>
</template>
