/**
 * Traduzione reattiva di una lista di testi.
 *
 * Se la lingua scelta e' quella di partenza non si chiama il server. In caso di
 * errore si mostrano i testi originali: meglio in italiano che assenti.
 */
import { ref, watch, type Ref } from "vue";
import { language } from "@/state";
import { SOURCE_LANG } from "../../../shared/constants";
import { translateTexts } from "@/api";

export function useTranslation(source: () => string[]): Ref<string[]> {
  const translated = ref<string[]>(source());

  watch(
    [source, language],
    async ([texts, lang]) => {
      if (lang.translate === SOURCE_LANG) {
        translated.value = texts;
        return;
      }
      try {
        translated.value = await translateTexts(texts, lang.translate);
      } catch (err) {
        console.error("Errore durante la traduzione", err);
        translated.value = texts;
      }
    },
    { immediate: true, deep: true },
  );

  return translated;
}
