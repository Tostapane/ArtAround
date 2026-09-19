/**
 * Legge e valida gli allestimenti che rendono generico il sistema. Ogni museo e'
 * configurazione, pianta e copertina facoltativa; i file vengono riletti e non sono
 * mai riscritti dal seed.
 */
import fs from "fs";
import path from "path";
import { SERVER_ROOT } from "../env";

export interface MuseumConfig {
  qid: string;
  name: string;
  location: string;
  created: string;
  mapPath: string;
  imagePath?: string;
  visitImages?: Record<string, string>;
  logistics?: string[];
  activeArtworks: string[];
}

const CONFIG_DIR = path.join(SERVER_ROOT, "public/allestimento");

// --- Lettura ---------------------------------------------------------------

export function loadMuseumConfigs(): MuseumConfig[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(CONFIG_DIR).filter((f) => f.endsWith(".json"));
  } catch (err) {
    console.error(`[musei] cartella di configurazione illeggibile: ${CONFIG_DIR}`, err);
    return [];
  }

  const configs: MuseumConfig[] = [];
  for (const file of files.sort()) {
    const full = path.join(CONFIG_DIR, file);
    let parsed: any;
    try {
      parsed = JSON.parse(fs.readFileSync(full, "utf-8"));
    } catch (err) {
      console.error(`[musei] ${file}: JSON non valido, museo saltato`, err);
      continue;
    }
    const problema = validate(parsed);
    if (problema) {
      console.error(`[musei] ${file}: ${problema}, museo saltato`);
      continue;
    }
    configs.push(parsed as MuseumConfig);
  }
  return configs;
}

export function findMuseumConfig(qid: string): MuseumConfig | null {
  for (const config of loadMuseumConfigs()) {
    if (config.qid === qid) return config;
  }
  return null;
}

function validate(config: any): string {
  if (!config || typeof config !== "object") return "non e' un oggetto";
  if (!config.qid) return "manca qid";
  if (!config.name) return "manca name";
  if (!config.mapPath) return "manca mapPath";
  if (config.imagePath !== undefined && typeof config.imagePath !== "string") {
    return "imagePath non e' una stringa";
  }
  if (config.visitImages !== undefined) {
    if (typeof config.visitImages !== "object" || Array.isArray(config.visitImages))
      return "visitImages non e' un oggetto tono -> percorso";
    for (const [tono, percorso] of Object.entries(config.visitImages)) {
      if (typeof percorso !== "string")
        return `visitImages["${tono}"] non e' una stringa`;
    }
  }
  if (!Array.isArray(config.activeArtworks) || config.activeArtworks.length === 0) {
    return "activeArtworks assente o vuoto";
  }
  if (config.logistics !== undefined && !Array.isArray(config.logistics)) {
    return "logistics non e' un elenco";
  }
  return "";
}
