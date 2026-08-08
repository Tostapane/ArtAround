/**
 * I file di configurazione dei musei: uno per museo, in `data/museums/`.
 *
 * E' il file che la slide 19 chiede, "adattarsi a musei diversi solo cambiando
 * qualche immagine e file di configurazione", quindi e' un ingresso e non un
 * prodotto: aggiungere un museo vuol dire posare un JSON qui e una SVG in
 * `public/maps/`, senza toccare una riga di codice. Niente qui dentro viene mai
 * riscritto dal seed, o le scelte del curatore andrebbero perse.
 *
 * Il file dice solo quel che non si puo' dedurre: il qid, il nome (che vince su
 * Wikidata, perche' e' una scelta e non un dato), luogo e anno, la pianta, le
 * indicazioni logistiche del museo e le opere da mettere in vetrina. Tutto lo
 * spazio - sale, opere, servizi, ostacoli, metri - sta dentro il disegno.
 */
import fs from "fs";
import path from "path";

export interface MuseumConfig {
  qid: string;
  name: string;
  location: string;
  created: string;
  mapPath: string;
  logistics?: string[];
  activeArtworks: string[];
}

const CONFIG_DIR = path.join(__dirname, "museums");

// --- Lettura ---------------------------------------------------------------

/**
 * Tutti i musei configurati, in ordine di nome file.
 *
 * Si rilegge a ogni chiamata: cambiare un file non richiede di riavviare il
 * server, e un errore di sintassi ferma il file che lo contiene invece di far
 * sparire tutti i musei.
 */
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

/**
 * Ritorna il primo campo che manca, oppure la stringa vuota se il file va bene.
 * Un museo mezzo configurato non entra: la sua assenza si legge nel log, mentre
 * un museo senza mappa o senza opere e' una schermata vuota senza spiegazione.
 */
function validate(config: any): string {
  if (!config || typeof config !== "object") return "non e' un oggetto";
  if (!config.qid) return "manca qid";
  if (!config.name) return "manca name";
  if (!config.mapPath) return "manca mapPath";
  if (!Array.isArray(config.activeArtworks) || config.activeArtworks.length === 0) {
    return "activeArtworks assente o vuoto";
  }
  if (config.logistics !== undefined && !Array.isArray(config.logistics)) {
    return "logistics non e' un elenco";
  }
  return "";
}
