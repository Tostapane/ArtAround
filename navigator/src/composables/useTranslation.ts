import { ref, watch, type Ref } from "vue";
import { language } from "@/state";
import { SOURCE_LANG } from "../../../shared/constants";
import { translateTexts } from "@/api";

// Traduce reattivamente una lista di testi nella lingua scelta dall'utente.
// `source` e' una funzione che restituisce i testi originali (in italiano):
// ogni volta che cambiano i testi o la lingua, l'output viene ricalcolato.
// Se la lingua scelta e' quella di partenza, restituisce i testi invariati.
export function useTranslation(source: () => string[]): Ref<string[]> {
  const translated = ref<string[]>(source());

  watch(
    [source, language],
    async ([texts, lang]) => {
      // lingua di partenza: nessuna traduzione necessaria
      if (lang.translate === SOURCE_LANG) {
        translated.value = texts;
        return;
      }
      try {
        translated.value = await translateTexts(texts, lang.translate);
      } catch (err) {
        // in caso di errore mostriamo comunque i testi originali
        console.error("Errore durante la traduzione", err);
        translated.value = texts;
      }
    },
    { immediate: true, deep: true },
  );

  return translated;
}
