/**
 * Traduce il navigator tramite cataloghi condivisi. Le frasi italiane sono chiavi e
 * ripiego; la lingua viene passata a ogni chiamata per mantenere la reattivita'
 * senza dipendere dallo stato Vue.
 */
import i18next from "i18next";
import { ref } from "vue";
import { SOURCE_LANG, languages } from "../../shared/constants";

const cataloghi = import.meta.glob<{ default: Record<string, string> }>(
  "../../shared/i18n/*.json",
);

const percorsoDi = (codice: string) => `../../shared/i18n/${codice}.json`;

i18next.init({
  lng: SOURCE_LANG,
  fallbackLng: false,

  keySeparator: false,
  nsSeparator: false,

  interpolation: { prefix: "{", suffix: "}", escapeValue: false },

  saveMissing: true,
  missingKeyHandler(lngs, _ns, key) {
    for (const l of lngs) {
      if (l !== SOURCE_LANG) console.warn(`[i18n] manca "${key}" in ${l}`);
    }
  },
  resources: {},
});

const locale = ref(SOURCE_LANG);
const caricate = new Set<string>();

export function t(key: string, params?: Record<string, unknown>): string {
  return i18next.t(key, { lng: locale.value, ...params });
}

export function tKey(phrase: string): string {
  return phrase;
}

export async function setLocale(codice: string) {
  document.documentElement.lang = codice;
  const carica = cataloghi[percorsoDi(codice)];
  if (carica && !caricate.has(codice)) {
    i18next.addResourceBundle(codice, "translation", (await carica()).default);
    caricate.add(codice);
  }
  locale.value = codice;
}

for (const l of languages) {
  if (l.translate === SOURCE_LANG) continue;
  if (!cataloghi[percorsoDi(l.translate)]) {
    console.warn(`[i18n] nessun catalogo per ${l.name} (${l.translate})`);
  }
}
