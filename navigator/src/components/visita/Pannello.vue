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
 * Vive in due posti: dentro la scheda dell'opera, quando è aperta a tutta
 * altezza, e dentro il pannello che si apre dal pulsante "Chiedi" della barra
 * della visita. È lo stesso componente, quindi i due elenchi non possono
 * divergere.
 */
import { computed, ref, watch } from "vue";
import Info from "./Info.vue";
import { options } from "../../../../shared/constants";
import type { Match } from "../../../../shared/types";

const props = defineProps<{
  about: Match | null;
  richiesta: string;
  /** Prefisso degli id di aiuto: due copie del pannello non possono ripeterli. */
  idPrefix?: string;
}>();

const emit = defineEmits<{ action: [value: string]; closeRequest: [] }>();

const tab = ref<"chiedi" | "orientati">("chiedi");

watch(
  () => props.about,
  () => (tab.value = "chiedi"),
);

const askCommands = computed(() => options.filter((o) => o.surface === "chiedi"));
const orientCommands = computed(() =>
  options.filter((o) => o.surface === "orientati"),
);
const shown = computed(() =>
  tab.value === "chiedi" ? askCommands.value : orientCommands.value,
);

function hintId(id: string): string {
  let prefix = "hint";
  if (props.idPrefix) prefix = props.idPrefix;
  return `${prefix}-${id.replace(/[^a-zA-Z0-9]+/g, "-")}`;
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

    <div class="mt-3 flex flex-col gap-2">
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
      @close="emit('closeRequest')"
    />
  </div>
</template>
