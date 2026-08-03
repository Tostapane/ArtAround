/**
 * Configurazione del navigator — il "file di configurazione" della specifica.
 *
 * Slide 25: la selezione del museo avviene via file di configurazione. Slide 33:
 * "attraverso un file di configurazione con immagini e titoli il curatore del
 * museo puo' creare una versione specifica del navigator". Il file vive in
 * public/config.json e si modifica senza ricompilare nulla: prima il museo era
 * una costante scritta nel codice, cioe' l'unico pezzo legato a UN museo dentro
 * un'app il cui pregio dichiarato e' di non esserlo.
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

export function apiBase(): string {
  if (config.apiBase) return config.apiBase.replace(/\/$/, "");
  return `${window.location.protocol}//${window.location.hostname}:8000/api`;
}

/** Origine da cui arrivano le immagini scaricate sul server. */
export function mediaOrigin(): string {
  return apiBase().replace(/\/api$/, "");
}

/**
 * La home del marketplace: lo stesso server che espone le API serve anche il
 * marketplace, quindi non c'e' un secondo indirizzo da configurare. E' li' che
 * si torna a fine visita.
 *
 * Non porta nessun biglietto, e non gli serve: si torna nella stessa scheda da
 * cui si e' partiti, dove la sessione del marketplace e' rimasta in
 * `sessionStorage`. Era il viaggio di ritorno a chiedere un biglietto quando di
 * sessione non ce n'era nessuna.
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
    const res = await fetch("/config.json", { cache: "no-cache" });
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
