/**
 * Carica la configurazione pubblica che adatta il navigator al museo e all'host
 * senza ricompilazione. Una base API vuota significa stessa origine.
 */
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

export function marketplaceHome(): string {
  return `${mediaOrigin()}/home`;
}

export function museumQid(): string {
  return config.museumQid;
}

export function museumTitle(): string {
  return config.museumTitle;
}

// ============================================================================

export async function loadConfig(): Promise<NavigatorConfig> {
  if (loaded) return config;
  try {

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
