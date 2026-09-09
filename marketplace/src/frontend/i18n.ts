/**
 * Carica il solo catalogo richiesto e traduce il marketplace con le stesse chiavi
 * del navigator. L'italiano e' testo sorgente e ripiego finche' la rete non
 * risponde.
 */
declare const i18next: {
  init(options: Record<string, unknown>): Promise<unknown>;
  t(key: string, options?: Record<string, unknown>): string;
  addResourceBundle(
    lng: string,
    ns: string,
    resources: Record<string, string>,
  ): void;
};

import { LANG_KEY, SOURCE_LANG, pickLanguage } from '../../../shared/constants.js';

let pronto = false;
const caricate = new Set<string>();

export function linguaIniziale(): string {
  try {
    return pickLanguage(sessionStorage.getItem(LANG_KEY)).translate;
  } catch {
    return SOURCE_LANG;
  }
}

export function salvaLingua(codice: string) {
  try {
    sessionStorage.setItem(LANG_KEY, codice);
  } catch {}
}

export async function preparaLingua(codice: string): Promise<void> {
  if (typeof i18next === "undefined") return;

  if (!pronto) {
    await i18next.init({
      lng: codice,
      fallbackLng: false,
      keySeparator: false,
      nsSeparator: false,
      interpolation: { prefix: "{", suffix: "}", escapeValue: false },
      resources: {},
    });
    pronto = true;
  }

  if (codice === SOURCE_LANG || caricate.has(codice)) return;
  try {
    const risposta = await fetch(`/i18n/${codice}.json`, { cache: "no-cache" });
    if (!risposta.ok) return;
    i18next.addResourceBundle(codice, "translation", await risposta.json());
    caricate.add(codice);
  } catch (errore) {
    console.error("Catalogo della lingua non leggibile", errore);
  }
}

export function traduci(
  chiave: string,
  lingua: string,
  parametri?: Record<string, unknown>,
): string {
  if (typeof i18next === "undefined" || !pronto) return chiave;
  return i18next.t(chiave, { lng: lingua, ...parametri });
}
