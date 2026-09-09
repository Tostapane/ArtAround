<script setup lang="ts">
/**
 * Espone come pulsanti il vocabolario dei comandi vocali. Separa le domande
 * sull'opera da quelle sull'edificio perche' hanno sorgenti diverse.
 */
import { computed, ref, watch } from "vue";
import Info from "./Info.vue";
import { NEXT_STOP_COMMAND, options } from "../../../../shared/constants";
import type { CommandOption } from "../../../../shared/constants";
import type { Match } from "../../../../shared/types";
import { t } from "@/i18n";

const props = defineProps<{
  about: Match | null;
  richiesta: string;

  target: string;

  canAskNext: boolean;
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

function isDisabled(o: CommandOption): boolean {
  if (!props.about) return true;
  if (o.id === NEXT_STOP_COMMAND) return !props.canAskNext;
  return false;
}
</script>

<template>
  <div>
    <div class="segmenti" role="tablist" :aria-label="t('Che cosa vuoi chiedere')">
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'chiedi'"
        class="segmento"
        :class="tab === 'chiedi' ? 'segmento-attivo' : ''"
        @click="tab = 'chiedi'"
      >
        {{ t("Chiedi") }}
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'orientati'"
        class="segmento"
        :class="tab === 'orientati' ? 'segmento-attivo' : ''"
        @click="tab = 'orientati'"
      >
        {{ t("Orientati") }}
      </button>
    </div>

    <p class="mt-3 text-caption text-muted">
      {{
        tab === "chiedi"
          ? t("Domande su questo contenuto.")
          : t("Domande sull'edificio: dove si trovano le cose.")
      }}
    </p>

    <div class="mt-3 grid grid-cols-2 gap-2">
      <button
        v-for="o in shown"
        :key="o.id"
        type="button"
        class="comando"
        :class="richiesta === o.id ? 'comando-attivo' : ''"
        :disabled="isDisabled(o)"
        :aria-describedby="o.hint ? hintId(o.id) : undefined"
        @click="emit('action', o.id)"
      >
        {{ t(o.label) }}
        <span v-if="o.hint" :id="hintId(o.id)" class="sr-only">{{ t(o.hint) }}</span>
      </button>
    </div>

    <p v-if="!about" class="vuoto mt-3">
      {{ t("Apri una tappa: le risposte parlano dell'opera che hai davanti.") }}
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
