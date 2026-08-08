/**
 * I file di configurazione dei musei: uno per museo, in `public/allestimento/`.
 *
 * E' il file che la slide 19 chiede, "adattarsi a musei diversi solo cambiando
 * qualche immagine e file di configurazione", quindi e' un ingresso e non un
 * prodotto: niente qui dentro viene mai riscritto dal seed, o le scelte del
 * curatore andrebbero perse.
 *
 * **Aggiungere un museo = posare TRE file omonimi in `public/allestimento/`**,
 * e nient'altro:
 *
 *     public/allestimento/Galleria degli Uffizi.json    la configurazione
 *     public/allestimento/Galleria degli Uffizi.svg     la pianta annotata
 *     public/allestimento/Galleria degli Uffizi.jpg     la copertina (facoltativa)
 *
 * Piu' le copertine delle visite, una per tono, se le si vuole: sono file come
 * gli altri, e il JSON dice come si chiamano (`visitImages`).
 *
 * La cartella NON si chiama `musei`, e non e' un caso: `musei` e' anche il
 * nome della schermata che sceglie il museo (`shared/constants.ts`), e il server
 * rimanda il guscio del marketplace agli indirizzi delle schermate. Le due cose
 * si sarebbero divise la stessa radice: un file davvero mancante qui sotto
 * avrebbe risposto 200 con dentro `index.html` invece di 404, cioe' un'immagine
 * rotta che si presenta come pagina buona. Un nome di cartella sotto `public/`
 * non deve mai coincidere con un nome di schermata.
 *
 * Stanno tutti e tre sotto `public/` perche' due dei tre devono arrivare al
 * browser: la pianta la scarica il navigator, la copertina la mostra il
 * marketplace. `mapPath` e `imagePath` sono percorsi relativi a quella radice, e
 * valgono a un tempo come indirizzo HTTP e come percorso su disco — il grafo
 * della pianta li risolve contro `public/`, il browser contro l'origine. Sono
 * dichiarati e non dedotti dal nome del file: e' il curatore a decidere come si
 * chiamano i suoi file, non noi.
 *
 * Il file dice solo quel che non si puo' dedurre: il qid, il nome (che vince su
 * Wikidata, perche' e' una scelta e non un dato), luogo e anno, la pianta, la
 * copertina, le indicazioni logistiche del museo e le opere da mettere in
 * vetrina. Tutto lo spazio - sale, opere, servizi, ostacoli, metri - sta dentro
 * il disegno.
 *
 * `visitImages` e' tagliato per TONO e non per visita perche' le venti visite di
 * catalogo di un museo contengono le stesse opere: cambiano tono e durata, e
 * delle due e' il tono a cambiare a chi la visita parla. Le cinque durate di uno
 * stesso tono condividono percio' la figura, e a distinguerle resta il titolo.
 *
 * `loadMuseumConfigs` rilegge la cartella a ogni chiamata: cambiare un file non
 * richiede di riavviare il server, e un errore di sintassi ferma il file che lo
 * contiene invece di far sparire tutti i musei. `validate` rende il primo campo
 * che manca, oppure la stringa vuota: un museo mezzo configurato non entra,
 * perche' la sua assenza si legge nel log mentre un museo senza mappa o senza
 * opere e' una schermata vuota senza spiegazione. La copertina resta pero'
 * facoltativa — pretenderla vorrebbe dire che aggiungere un museo ha un requisito
 * grafico.
 */
import fs from "fs";
import path from "path";

export interface MuseumConfig {
  qid: string;
  name: string;
  location: string;
  created: string;
  mapPath: string; // la pianta annotata, relativa a `public/`
  imagePath?: string; // la copertina del museo, mostrata sulla sua carta
  visitImages?: Record<string, string>; // una copertina per TONO, per le visite del seed
  logistics?: string[]; // le indicazioni valide per tutto il museo
  activeArtworks: string[]; // i qid delle opere da seminare, in ordine di vetrina
}

const CONFIG_DIR = path.join(__dirname, "..", "..", "public", "allestimento");

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
