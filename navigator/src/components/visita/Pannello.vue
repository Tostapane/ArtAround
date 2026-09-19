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
  <div :class="tab === 'chiedi' ? 'pannello-domande' : ''">
    <div
      class="grid w-full grid-cols-2 gap-1 rounded-plate border border-line bg-surface p-1"
      role="tablist"
      :aria-label="t('Che cosa vuoi chiedere')"
    >
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'chiedi'"
        class="segmento segmento-domande"
        :class="tab === 'chiedi' ? 'segmento-attivo' : ''"
        @click="tab = 'chiedi'"
      >
        {{ t("Chiedi") }}
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'orientati'"
        class="segmento segmento-mappa"
        :class="tab === 'orientati' ? 'segmento-attivo' : ''"
        @click="tab = 'orientati'"
      >
        {{ t("Orientati") }}
      </button>
    </div>

    <div class="mt-4 grid grid-cols-2 gap-2">
      <button
        v-for="o in shown"
        :key="o.id"
        type="button"
        class="comando gap-3"
        :class="richiesta === o.id ? 'comando-attivo' : ''"
        :disabled="isDisabled(o)"
        :aria-describedby="o.hint ? hintId(o.id) : undefined"
        @click="emit('action', o.id)"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-velo font-display text-small text-accent"
          aria-hidden="true"
        >
          <span v-if="tab === 'chiedi'">?</span>
          <svg
            v-else
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
        </span>
        <span class="min-w-0 flex-1">{{ t(o.label) }}</span>
        <svg class="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7" />
        </svg>
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
