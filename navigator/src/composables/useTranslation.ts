/**
 * Traduce reattivamente una lista di testi e conserva l'originale se il servizio non
 * risponde o la lingua richiesta e' gia' quella sorgente.
 */
import { ref, watch, type Ref } from "vue";
import { language } from "@/state";
import { SOURCE_LANG } from "../../../shared/constants";
import { translateTexts } from "@/api";

export function useTranslation(source: () => string[]): Ref<string[]> {
  const translated = ref<string[]>(source());
  let lastRequest = 0;

  watch(
    [source, language],
    async ([texts, lang]) => {
      const request = ++lastRequest;
      translated.value = texts;
      if (lang.translate === SOURCE_LANG) return;
      try {
        const result = await translateTexts(texts, lang.translate);
        if (request === lastRequest) translated.value = result;
      } catch (err) {
        console.error("Errore durante la traduzione", err);
      }
    },
    { immediate: true, deep: true },
  );

  return translated;
}
