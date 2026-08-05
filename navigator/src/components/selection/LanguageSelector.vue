<script setup lang="ts">
/**
 * La scelta della lingua, ovunque si scelga.
 *
 * E' un `<select>` nativo: su un telefono apre il selettore del sistema
 * operativo, che e' quel che ha in mano un visitatore in una sala, e non
 * costringe a mantenere un menu disegnato da noi. I nomi sono scritti CIASCUNO
 * NELLA PROPRIA LINGUA (中文, Русский), quindi si riconoscono senza dover prima
 * leggere l'italiano; con tredici voci non c'e' niente da cercare.
 *
 * Sta in un componente solo, e le due schermate che lo mostrano lo importano:
 * scritto due volte, il controllo che apre l'applicazione a chi non legge
 * l'italiano potrebbe cambiare in un posto e non nell'altro.
 *
 * L'etichetta dice `Lingua` e non "lingua dei contenuti": cambiandola cambiano
 * anche i comandi, i titoli e gli annunci, quindi promettere solo i contenuti
 * direbbe meno di quel che il controllo fa. Si puo' nascondere (`etichetta`)
 * dove il posto la dichiara gia', restando comunque leggibile allo screen
 * reader: il valore da solo non dice di che cosa e' il valore.
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
