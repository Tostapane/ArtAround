/**
 * L'INTERFACCIA nella lingua del visitatore.
 *
 * LA CHIAVE E' LA FRASE ITALIANA — `t("Esci")`, non `t("visita.esci")`. Cosi' non
 * si battezzano duecento chiavi, il codice si legge senza avere il catalogo
 * accanto, e una traduzione che manca ricade su una frase vera invece che su un
 * identificatore. Per lo stesso motivo **non esiste un `it.json`**: l'italiano sta
 * gia' nel sorgente e non puo' ne' mancare ne' andare fuori sincrono.
 *
 * PERCHE' `i18next` E NON UN PLUGIN DI VUE: gli stessi cataloghi li leggera' il
 * marketplace, dove un framework non ci puo' andare. Due letture degli stessi
 * file, quando smettono di essere d'accordo, non danno un errore: danno una
 * schermata sbagliata.
 *
 * PERCHE' UN `t` GLOBALE e non un composable: diciassette dei diciannove file
 * hanno stringhe anche nello script, e alcuni sono moduli `.ts` (`state.ts`,
 * `api.ts`) dove un composable non si puo' chiamare — vuole un componente vivo.
 *
 * LA LINGUA SI PASSA A OGNI CHIAMATA invece di cambiarla nell'istanza:
 * `changeLanguage` e' asincrona, quindi subito dopo averla chiamata `t`
 * risponderebbe ancora nella lingua di prima. Leggere `locale` dentro `t` fa due
 * cose in una riga: sceglie la lingua giusta, e registra la dipendenza reattiva
 * che ridisegna i componenti quando cambia.
 *
 * ⚠️ QUESTO MODULO NON IMPORTA NIENTE DEL NAVIGATOR, ed e' una regola: `i18n` →
 * `state` → `api` → `i18n` e' un anello che compila benissimo e fa partire
 * l'applicazione bianca, con `language` letto prima di essere inizializzato. La
 * lingua la SPINGE `state.ts` chiamando `setLocale`, cosi' `i18n` resta foglia.
 */
import i18next from "i18next";
import { ref } from "vue";
import { SOURCE_LANG, languages } from "../../shared/constants";

// I cataloghi stanno in `shared/` e non dentro il navigator perche' li leggera'
// anche il marketplace: sono un dato delle due applicazioni, non di una. Il
// formato dei messaggi e' documentato in `shared/i18n/README.md`.
const cataloghi = import.meta.glob<{ default: Record<string, string> }>(
  "../../shared/i18n/*.json",
  { eager: true },
);

const resources: Record<string, { translation: Record<string, string> }> = {};
for (const percorso in cataloghi) {
  const codice = percorso.split("/").pop()!.replace(".json", "");
  const modulo = cataloghi[percorso];
  if (modulo) resources[codice] = { translation: modulo.default };
}

i18next.init({
  lng: SOURCE_LANG,
  fallbackLng: false,
  // La chiave e' una frase: i suoi punti non sono percorsi dentro un oggetto e i
  // suoi due punti non sono un namespace.
  keySeparator: false,
  nsSeparator: false,
  // I cataloghi usano `{n}`; e i valori NON si passano da un escape HTML, o un
  // nome d'opera con l'apostrofo arriverebbe a schermo come `L&#39;Ange`. A
  // difendere dal marcatore ci pensa Vue, che il testo lo interpola sempre come
  // testo — quindi nessuno di questi messaggi deve mai finire in un `v-html`.
  interpolation: { prefix: "{", suffix: "}", escapeValue: false },
  // Non salva niente da nessuna parte: e' l'aggancio per accorgersi di una
  // stringa mai tradotta. Tace sulla lingua sorgente, dove "mancante" e' la
  // condizione normale di ogni chiave — avvisare anche li' sarebbero duecento
  // righe di rumore a ogni caricamento, e il rumore nasconde quel che serve.
  saveMissing: true,
  missingKeyHandler(lngs, _ns, key) {
    for (const l of lngs) {
      if (l !== SOURCE_LANG) console.warn(`[i18n] manca "${key}" in ${l}`);
    }
  },
  resources,
});

const locale = ref(SOURCE_LANG);

export function t(key: string, params?: Record<string, unknown>): string {
  return i18next.t(key, { lng: locale.value, ...params });
}

/** La chiama `state.ts` quando la lingua cambia, e una volta all'avvio. */
export function setLocale(codice: string) {
  locale.value = codice;
  document.documentElement.lang = codice;
}

// Una lingua offerta ma senza catalogo mostrerebbe l'interfaccia in italiano
// senza che niente lo dica: e' il difetto silenzioso che questo file esiste per
// evitare, quindi si segnala all'avvio.
for (const l of languages) {
  if (l.translate === SOURCE_LANG) continue;
  if (!resources[l.translate]) {
    console.warn(`[i18n] nessun catalogo per ${l.name} (${l.translate})`);
  }
}
