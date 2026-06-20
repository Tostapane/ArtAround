<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
} from "@headlessui/vue";
import { languages, type Language } from "../../../../shared/constants";
import { language, setLanguage } from "@/state";

// testo digitato per filtrare la lista delle lingue
const query = ref("");

// lingue che corrispondono al testo digitato (ricerca per nome, case-insensitive)
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (q === "") return languages;
  const result: Language[] = [];
  for (const l of languages) {
    if (l.name.toLowerCase().includes(q)) result.push(l);
  }
  return result;
});

function onSelect(lang: Language) {
  if (!lang) return;
  setLanguage(lang);
}

function displayName(lang: Language): string {
  if (!lang) return "";
  return lang.name;
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <span id="label-lingua" class="text-sm font-medium text-text">
      Lingua dei contenuti
    </span>
    <Combobox
      :model-value="language"
      @update:model-value="onSelect"
      as="div"
      class="relative w-full"
    >
      <div
        class="relative w-full overflow-hidden rounded-md border border-border bg-surface"
      >
        <ComboboxInput
          aria-labelledby="label-lingua"
          class="w-full bg-surface px-4 py-2.5 text-sm font-medium text-text focus:outline-none"
          :display-value="(l) => displayName(l as Language)"
          placeholder="Cerca una lingua…"
          @change="query = ($event.target as HTMLInputElement).value"
        />
        <ComboboxButton
          class="absolute inset-y-0 right-0 flex items-center px-2 text-muted"
          aria-label="Apri elenco lingue"
        >
          <svg
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clip-rule="evenodd"
            />
          </svg>
        </ComboboxButton>
      </div>

      <ComboboxOptions
        class="absolute left-0 z-30 mt-2 max-h-60 w-full overflow-auto rounded-md border border-border bg-surface p-1 shadow-lg focus:outline-none"
      >
        <p
          v-if="filtered.length === 0"
          class="px-3 py-2 text-sm text-muted"
        >
          Nessuna lingua trovata.
        </p>
        <ComboboxOption
          v-for="lang in filtered"
          :key="lang.translate"
          :value="lang"
          v-slot="{ active, selected }"
        >
          <div
            :class="[
              active ? 'bg-accent text-on-accent' : 'text-text',
              'flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm',
            ]"
          >
            <span>{{ lang.name }}</span>
            <svg
              v-if="selected"
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </ComboboxOption>
      </ComboboxOptions>
    </Combobox>
  </div>
</template>
