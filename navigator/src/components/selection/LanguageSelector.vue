<script setup lang="ts">
/**
 * Selettore della lingua riusato nei punti d'ingresso. Usa il controllo nativo del
 * dispositivo e mostra ogni lingua col proprio endonimo.
 */
import { languages, type Language } from "../../../../shared/constants";
import { language, setLanguage } from "@/state";
import { t } from "@/i18n";

const props = withDefaults(
  defineProps<{ etichetta?: boolean; id?: string }>(),
  { etichetta: true, id: "lingua" },
);

function cambiaLingua(codice: string) {
  const scelta: Language | undefined = languages.find(
    (l) => l.translate === codice,
  );
  if (scelta) setLanguage(scelta);
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <label
      :for="props.id"
      class="etichetta-impostazione"
      :class="props.etichetta ? '' : 'sr-only'"
    >
      {{ t("Lingua") }}
    </label>
    <select
      :id="props.id"
      class="campo-select"
      :value="language.translate"
      @change="cambiaLingua(($event.target as HTMLSelectElement).value)"
    >
      <option v-for="l in languages" :key="l.translate" :value="l.translate">
        {{ l.name }}
      </option>
    </select>
  </div>
</template>
