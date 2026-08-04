<script setup lang="ts">
/**
 * La scelta della lingua, in biglietteria.
 *
 * E' un `<select>` nativo, ed e' lo stesso controllo che la scheda usa dentro la
 * visita: una scelta sola merita un vocabolario solo. Su un telefono il nativo
 * apre inoltre il selettore del sistema operativo, che e' quel che ha in mano un
 * visitatore in una sala.
 *
 * I nomi sono scritti CIASCUNO NELLA PROPRIA LINGUA (中文, Русский): si
 * riconoscono senza dover prima leggere l'italiano, che e' la sola cosa che qui
 * conta. Con tredici voci non serve nemmeno cercarle.
 */
import { languages, type Language } from "../../../../shared/constants";
import { language, setLanguage } from "@/state";
import { t } from "@/i18n";

function cambiaLingua(codice: string) {
  const scelta: Language | undefined = languages.find(
    (l) => l.translate === codice,
  );
  if (scelta) setLanguage(scelta);
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <label for="lingua-biglietteria" class="text-sm font-medium text-text">
      {{ t("Lingua dei contenuti") }}
    </label>
    <select
      id="lingua-biglietteria"
      class="campo-select w-full"
      :value="language.translate"
      @change="cambiaLingua(($event.target as HTMLSelectElement).value)"
    >
      <option v-for="l in languages" :key="l.translate" :value="l.translate">
        {{ l.name }}
      </option>
    </select>
  </div>
</template>
