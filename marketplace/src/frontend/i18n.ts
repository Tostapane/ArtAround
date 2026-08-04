/**
 * L'interfaccia del marketplace nella lingua di chi la usa.
 *
 * Legge gli stessi cataloghi del navigator, che il server pubblica sotto
 * `/i18n/`. Le chiavi sono le frasi italiane, quindi l'italiano non ha nessun
 * file: sta gia' nel sorgente e non puo' andare fuori sincrono.
 *
 * La libreria e' la stessa del navigator, perche' due letture degli stessi file
 * che smettono di essere d'accordo non danno un errore ma una schermata
 * sbagliata. Qui pero' non si importa da npm, dato che non c'e' un
 * impacchettatore: arriva da `public/vendor/` come Alpine.
 *
 * Si carica una lingua sola, e prima di disegnare qualcosa: altrimenti la pagina
 * comparirebbe in italiano per un istante e cambierebbe sotto gli occhi.
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

/** La stessa chiave del navigator: la lingua si sceglie una volta per tutte. */
const LANG_KEY = "artaround-lang";
const SOURCE_LANG = "it";

let pronto = false;
const caricate = new Set<string>();

export function linguaSalvata(): string {
  try {
    return localStorage.getItem(LANG_KEY) || SOURCE_LANG;
  } catch {
    return SOURCE_LANG;
  }
}

export function salvaLingua(codice: string) {
  try {
    localStorage.setItem(LANG_KEY, codice);
  } catch {
    // Un browser che nega la memoria locale non deve impedire di leggere.
  }
}

/**
 * Prepara `i18next` e scarica il catalogo della lingua chiesta.
 *
 * Le opzioni sono le stesse del navigator, e devono restarlo. `keySeparator` e
 * `nsSeparator` spenti perche' le chiavi sono frasi, con i loro punti e i loro
 * due punti; `interpolation` con le graffe singole perche' i cataloghi usano
 * `{nome}`; `escapeValue` spento perche' i valori li scriviamo noi come testo, e
 * con l'escape acceso un nome con l'apostrofo arriverebbe a schermo come
 * `L&#39;Ange`. Ne segue una regola: nessuna di queste stringhe puo' finire in un
 * `x-html`, solo in `x-text` e nel testo dei nodi.
 */
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

/**
 * Traduce una frase. La lingua si passa a ogni chiamata invece di cambiarla
 * nell'istanza perche' `changeLanguage` e' asincrona: subito dopo averla
 * chiamata si otterrebbe ancora la lingua di prima.
 *
 * In italiano il catalogo non esiste e ogni chiave risulta mancante, che qui e'
 * la condizione normale: `i18next` in quel caso compila la chiave stessa, ed e'
 * l'unico modo perche' i segnaposto vengano sostituiti anche nella lingua
 * sorgente.
 */
export function traduci(
  chiave: string,
  lingua: string,
  parametri?: Record<string, unknown>,
): string {
  if (typeof i18next === "undefined" || !pronto) return chiave;
  return i18next.t(chiave, { lng: lingua, ...parametri });
}
