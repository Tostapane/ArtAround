/**
 * Configurazione del navigator — il "file di configurazione" della specifica.
 *
 * Slide 25: la selezione del museo avviene "via file di configurazione".
 * Slide 33: "attraverso un file di configurazione con immagini e titoli il
 * curatore del museo può creare una versione specifica del navigator".
 *
 * Fino a ieri il museo era una costante scritta nel codice (`DEFAULT_MUSEUM_QID
 * = "Q6373"`): l'unico pezzo di codice legato a UN museo dentro un'app il cui
 * pregio dichiarato e' di non esserlo. Ora sta in `public/config.json`, che si
 * modifica senza ricompilare nulla.
 *
 * Nello stesso posto finisce l'indirizzo del server: `localhost` scritto a mano
 * e' sbagliato per definizione su qualunque macchina che non sia quella dello
 * sviluppatore — telefono compreso.
 */

export interface NavigatorConfig {
  /** QID del museo mostrato quando non arriva nulla dall'URL */
  museumQid: string;
  /** Titolo da mostrare al posto del nome dal database (facoltativo) */
  museumTitle: string;
  /** Base delle API. Vuota = stesso host del navigator, porta 8000. */
  apiBase: string;
}

const DEFAULT_CONFIG: NavigatorConfig = {
  museumQid: "",
  museumTitle: "",
  apiBase: "",
};

let config: NavigatorConfig = { ...DEFAULT_CONFIG };
let caricata = false;

/** Base delle API risolta: se il file non la fissa, si ricava dall'host da cui
 *  la pagina e' stata aperta — cosi' funziona anche aprendo il navigator dal
 *  telefono con l'IP della rete locale. */
export function apiBase(): string {
  if (config.apiBase) return config.apiBase.replace(/\/$/, "");
  return `${window.location.protocol}//${window.location.hostname}:8000/api`;
}

/** Origine da cui arrivano le immagini scaricate sul server (imagePath e'
 *  relativo). E' la base delle API senza il suffisso /api. */
export function mediaOrigin(): string {
  return apiBase().replace(/\/api$/, "");
}

export function museumQid(): string {
  return config.museumQid;
}

export function museumTitle(): string {
  return config.museumTitle;
}

/** Carica il file di configurazione. Non fallisce mai in modo rumoroso: se il
 *  file manca si prosegue con i valori vuoti e chi chiama decide come reagire. */
export async function loadConfig(): Promise<NavigatorConfig> {
  if (caricata) return config;
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
  caricata = true;
  return config;
}
