/**
 * Configurazione del navigator: il "file di configurazione" della specifica.
 *
 * Slide 25: la selezione del museo avviene via file di configurazione. Slide 33:
 * "attraverso un file di configurazione con immagini e titoli il curatore del
 * museo puo' creare una versione specifica del navigator". Il file vive in
 * public/config.json e si modifica senza ricompilare nulla: e' l'unico posto in
 * cui l'applicazione nomina un museo, e serve a tenerla generica ovunque.
 *
 * Nello stesso posto sta l'indirizzo del server. Se `apiBase` e' vuoto lo si
 * ricava dall'host da cui la pagina e' stata aperta: cosi' il navigator
 * funziona anche aprendolo dal telefono con l'IP della rete locale, dove
 * "localhost" sarebbe sbagliato per definizione.
 *
 * Il caricamento non fallisce mai in modo rumoroso: se il file manca si
 * prosegue con valori vuoti e decide chi chiama.
 */

// ============================================================================
//                                  Forma
// ============================================================================

export interface NavigatorConfig {
  museumQid: string;
  museumTitle: string;
  apiBase: string;
}

const DEFAULT_CONFIG: NavigatorConfig = {
  museumQid: "",
  museumTitle: "",
  apiBase: "",
};

let config: NavigatorConfig = { ...DEFAULT_CONFIG };
let loaded = false;

// ============================================================================
//                                 Lettura
// ============================================================================

/**
 * Dove sta il server. Tre casi, e nessuno indovinato:
 *
 * 1. `apiBase` scritto nel file di configurazione: comanda lui. Serve a chi apre
 *    il navigator dal telefono con l'IP della rete locale, dove "localhost"
 *    sarebbe sbagliato per definizione.
 * 2. In sviluppo il navigator ha un server suo, Vite, e il server sta su un'altra
 *    porta: l'indirizzo va scritto per intero.
 * 3. In deploy li serve la stessa origine, perche' il dipartimento pubblica una
 *    porta sola per sito, quindi basta un percorso. Scrivere host e porta qui
 *    romperebbe anche in un altro modo: la pagina arriva in https e una chiamata
 *    in http verso una porta esplicita e' contenuto misto, che il browser blocca.
 */
export function apiBase(): string {
  if (config.apiBase) return config.apiBase.replace(/\/$/, "");
  if (import.meta.env.DEV) {
    return `${window.location.protocol}//${window.location.hostname}:8000/api`;
  }
  return "/api";
}

export function mediaOrigin(): string {
  return apiBase().replace(/\/api$/, "");
}

/**
 * La home del marketplace: lo stesso server che espone le API serve anche il
 * marketplace, quindi non c'e' un secondo indirizzo da configurare. E' li' che
 * si torna a fine visita.
 *
 * Non porta nessun biglietto e non gli serve: si torna nella stessa scheda da
 * cui si e' partiti, dove la sessione del marketplace e' rimasta viva in
 * `sessionStorage`.
 */
export function marketplaceHome(): string {
  return `${mediaOrigin()}/#/home`;
}

export function museumQid(): string {
  return config.museumQid;
}

export function museumTitle(): string {
  return config.museumTitle;
}

// ============================================================================
//                                Caricamento
// ============================================================================

export async function loadConfig(): Promise<NavigatorConfig> {
  if (loaded) return config;
  try {
    // `BASE_URL` e' `/` in sviluppo e `/navigator/` compilato: un percorso
    // assoluto scritto a mano finirebbe sulla radice, cioe' sul marketplace.
    const res = await fetch(`${import.meta.env.BASE_URL}config.json`, {
      cache: "no-cache",
    });
    if (res.ok) {
      const raw = await res.json();
      config = {
        museumQid: typeof raw.museumQid === "string" ? raw.museumQid : "",
        museumTitle: typeof raw.museumTitle === "string" ? raw.museumTitle : "",
        apiBase: typeof raw.apiBase === "string" ? raw.apiBase : "",
      };
    }
  } catch (err) {
    console.error("Configurazione del museo non leggibile", err);
  }
  loaded = true;
  return config;
}
