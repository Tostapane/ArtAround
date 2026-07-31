/**
 * I file di configurazione dei musei: uno per museo, in `data/museums/`.
 *
 * E' il file che la slide 19 chiede — "adattarsi a musei e esposizioni diverse
 * solo cambiando qualche immagine e file di configurazione" — quindi e' un
 * INGRESSO, non un prodotto: aggiungere un museo vuol dire posare un JSON qui e
 * una SVG in `public/maps/`, e non toccare una riga di codice. Prima l'elenco
 * dei musei stava in un modulo TypeScript e questi file venivano riscritti dal
 * seed a partire da Wikidata: chi aggiungeva un museo doveva ricompilare, e le
 * scelte del curatore venivano sovrascritte.
 *
 * Il file dice solo quel che non si puo' dedurre da nient'altro:
 *
 *   qid             l'identificatore universale (Wikidata) del museo. E' la
 *                   chiave con cui opere, visite e configurazione si ritrovano.
 *   name            come si chiama per chi guarda, e come si chiama la sua mappa.
 *                   Vince su Wikidata, che per gli Uffizi restituisce "Palazzo
 *                   degli Uffizi", cioe' l'edificio e non la galleria.
 *   location        dove si trova, in chiaro.
 *   created         anno di fondazione.
 *   mapPath         la pianta SVG, servita da `public/`. Tutto lo spazio —
 *                   sale, opere, servizi, ostacoli, collegamenti, metri —
 *                   e' dentro quel disegno: qui non se ne ripete niente.
 *   logistics       le indicazioni valide per il museo intero (ingresso,
 *                   biglietto, guardaroba: l'esempio della slide 21). Il seed
 *                   le mette in apertura a ogni visita che genera.
 *   activeArtworks  i qid delle opere che il curatore espone nell'app. Non sono
 *                   tutte quelle del museo: sono quelle scelte.
 *
 * La POSIZIONE di un'opera non sta qui ma nella mappa, sul nodo che porta il suo
 * `data-qid`: due elenchi paralleli da tenere allineati a mano sono un elenco di
 * troppo, e con centoquattro opere e' il primo posto in cui si sbaglia.
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
