<script setup lang="ts">
/**
 * IL PANNELLO DEI COMANDI — il vocabolario controllato, a bottoni.
 *
 * La slide 28 chiede che ogni comando vocale abbia un pulsante equivalente, e
 * la slide 27 elenca le due famiglie di domande: quelle sull'OPERA ("dimmi di
 * più", "chi è l'autore?", "non ho capito") e quelle sull'EDIFICIO ("dov'è la
 * toilette?", "dove esco?"). Sono famiglie diverse perché rispondono sistemi
 * diversi — l'LLM la prima, il grafo delle sale la seconda — e tenerle separate
 * evita un elenco unico di quindici bottoni in cui non si trova niente.
 *
 * Sta in fondo alla scheda, sempre visibile: chiedere è un comando come
 * "Prossimo", non una schermata da aprire. I comandi stanno su due colonne
 * perché la scheda ha da spartire l'altezza con l'opera che si sta leggendo, e
 * un elenco a piena larghezza costringerebbe a scorrere per vedere l'ultimo.
 */
import { computed, ref, watch } from "vue";
import Info from "./Info.vue";
import { options } from "../../../../shared/constants";
import type { Match } from "../../../../shared/types";

const props = defineProps<{
  about: Match | null;
  richiesta: string;
  /** Il servizio toccato sulla pianta: una domanda d'orientamento senza comando. */
  target: string;
}>();

const emit = defineEmits<{ action: [value: string]; closeRequest: [] }>();

const tab = ref<"chiedi" | "orientati">("chiedi");

watch(
  () => props.about,
  () => (tab.value = "chiedi"),
);

watch(
  () => props.target,
  (t) => {
    if (t) tab.value = "orientati";
  },
);

const askCommands = computed(() => options.filter((o) => o.surface === "chiedi"));
const orientCommands = computed(() =>
  options.filter((o) => o.surface === "orientati"),
);
const shown = computed(() =>
  tab.value === "chiedi" ? askCommands.value : orientCommands.value,
);

function hintId(id: string): string {
  return `hint-${id.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}
</script>

<template>
  <div>
    <div class="segmenti" role="tablist" aria-label="Che cosa vuoi chiedere">
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'chiedi'"
        class="segmento"
        :class="tab === 'chiedi' ? 'segmento-attivo' : ''"
        @click="tab = 'chiedi'"
      >
        Chiedi
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'orientati'"
        class="segmento"
        :class="tab === 'orientati' ? 'segmento-attivo' : ''"
        @click="tab = 'orientati'"
      >
        Orientati
      </button>
    </div>

    <p class="mt-3 text-caption text-muted">
      {{
        tab === "chiedi"
          ? "Domande su quest'opera."
          : "Domande sull'edificio: dove si trovano le cose."
      }}
    </p>

    <div class="mt-3 grid grid-cols-2 gap-2">
      <button
        v-for="o in shown"
        :key="o.id"
        type="button"
        class="comando"
        :class="richiesta === o.id ? 'comando-attivo' : ''"
        :disabled="!about"
        :aria-describedby="o.hint ? hintId(o.id) : undefined"
        @click="emit('action', o.id)"
      >
        {{ o.label }}
        <span v-if="o.hint" :id="hintId(o.id)" class="sr-only">{{ o.hint }}</span>
      </button>
    </div>

    <p v-if="!about" class="vuoto mt-3">
      Apri una tappa: le risposte parlano dell'opera che hai davanti.
    </p>

    <!-- La risposta -->
    <Info
      v-if="richiesta && about"
      class="mt-4"
      :request="richiesta"
      :about="about"
      :target="target"
      @close="emit('closeRequest')"
    />
  </div>
</template>
