/**
 * L'INTERFACCIA nella lingua del visitatore.
 *
 * I contenuti si traducevano gia' — titolo, sottotitolo e testo dell'opera passano
 * da `useTranslation`, e le risposte del modello nascono gia' nella lingua scelta.
 * Restava italiana la scorza: ogni bottone, ogni annuncio, ogni errore. Chi
 * sceglieva 中文 leggeva la descrizione in cinese dentro un'applicazione italiana.
 *
 * LA CHIAVE E' LA FRASE ITALIANA — `t("Esci")`, non `t("visita.esci")`. Cosi' non
 * si battezzano trecento chiavi, il codice resta leggibile senza avere il catalogo
 * accanto, e una traduzione che manca ricade su una frase vera invece che su un
 * identificatore. Per lo stesso motivo **non esiste un `it.json`**: l'italiano e'
 * gia' nel sorgente e non puo' ne' mancare ne' andare fuori sincrono.
 *
 * PERCHE' UN `t` GLOBALE e non `useI18n()` in ogni componente: diciassette dei
 * diciannove file hanno stringhe anche nello script, e alcuni sono moduli `.ts`
 * (`state.ts`, `api.ts`) dove `useI18n()` non si puo' chiamare — vuole un
 * componente vivo. Una funzione importata funziona in tutti e due i posti, e nei
 * `<script setup>` finisce da sola nel template.
 *
 * PERCHE' I CATALOGHI SI CARICANO TUTTI SUBITO: sono ~200 KB in dodici lingue,
 * cioe' un'immagine di un'opera, e l'applicazione e' servita dallo stesso server
 * su rete locale. Caricandoli a richiesta il cambio di lingua avrebbe un istante
 * in cui i contenuti sono gia' cinesi e i bottoni ancora italiani: si paga una
 * volta in byte per non avere mai quello sfasamento.
 *
 * IN ITALIANO OGNI CHIAVE E' "MANCANTE", ed e' la condizione normale: il
 * catalogo italiano non esiste perche' la chiave stessa e' la frase. Perche' i
 * segnaposto vengano sostituiti la chiave deve pero' passare dal compilatore dei
 * messaggi, ed e' quello che chiede `fallbackFormat`. Senza, la lingua predefinita
 * mostra `Tappa {n} di {m}` con le graffe — e solo lei, quindi provando in
 * inglese non si vede.
 *
 * L'AVVISO SULLE CHIAVI MANCANTI e' l'unico strumento che dice quali stringhe si
 * e' dimenticato di estrarre — il modo in cui questo lavoro fallisce non e' una
 * traduzione brutta, e' una frase rimasta italiana per sempre senza che niente lo
 * segnali. Tace pero' sulla lingua sorgente, dove "mancante" e' la condizione
 * normale di ogni chiave: se avvisasse anche li' sarebbero trecento righe di
 * rumore a ogni caricamento, e il rumore nasconde proprio quello che serve vedere.
 *
 * ⚠️ QUESTO MODULO NON IMPORTA NIENTE DEL NAVIGATOR, ed e' una regola, non un
 * caso. Traducendo `api.ts` si era chiuso un anello — i18n → state → api → i18n —
 * e all'avvio `language` non era ancora inizializzato: pagina bianca con
 * «Cannot access 'language' before initialization». Un import circolare compila
 * benissimo, quindi non c'e' nessun controllo che lo fermi. Ora la lingua la
 * SPINGE `state.ts` chiamando `setLocale`, invece di essere letta da qui: cosi'
 * `i18n` resta una foglia e chiunque puo' importarlo senza pensarci.
 */
import { createI18n } from "vue-i18n";
import { SOURCE_LANG, languages } from "../../shared/constants";

// I file sono in `shared/` e non dentro il navigator perche' un giorno li leggera'
// anche il marketplace: il catalogo e' un dato delle due applicazioni, il modo di
// leggerlo no. Il formato dei messaggi e' documentato in `shared/i18n/README.md`.
const cataloghi = import.meta.glob<{ default: Record<string, string> }>(
  "../../shared/i18n/*.json",
  { eager: true },
);

const messages: Record<string, Record<string, string>> = {};
for (const percorso in cataloghi) {
  const codice = percorso.split("/").pop()!.replace(".json", "");
  const modulo = cataloghi[percorso];
  if (modulo) messages[codice] = modulo.default;
}

export const i18n = createI18n({
  legacy: false,
  locale: SOURCE_LANG,
  fallbackLocale: SOURCE_LANG,
  fallbackWarn: false,
  // La chiave e' la frase italiana, e in italiano non c'e' nessun catalogo:
  // ogni chiave risulta quindi "mancante", ed e' il caso normale, non un guasto.
  // `fallbackFormat` dice a `vue-i18n` di COMPILARE la chiave come se fosse il
  // messaggio, che e' l'unico modo perche' i segnaposto vengano sostituiti:
  // restituendo la chiave da `missing` si salta il compilatore, e a schermo
  // finisce `Tappa {n} di {m}` con le graffe.
  fallbackFormat: true,
  messages,
  missing(locale: string, key: string) {
    if (locale !== SOURCE_LANG) {
      console.warn(`[i18n] manca "${key}" in ${locale}`);
    }
  },
});

export const t = i18n.global.t;

/**
 * Una lingua offerta ma senza catalogo mostrerebbe l'interfaccia in italiano
 * senza che niente lo dica: e' il difetto silenzioso che questo file esiste per
 * evitare, quindi si segnala all'avvio invece di aspettare che qualcuno lo noti.
 */
for (const l of languages) {
  if (l.translate === SOURCE_LANG) continue;
  if (!messages[l.translate]) {
    console.warn(`[i18n] nessun catalogo per ${l.name} (${l.translate})`);
  }
}

/** La chiama `state.ts` quando la lingua cambia, e una volta all'avvio. */
export function setLocale(codice: string) {
  i18n.global.locale.value = codice;
  document.documentElement.lang = codice;
}
