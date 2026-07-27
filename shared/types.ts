/**
 * Tipi condivisi da server, navigator e marketplace.
 *
 * Il modello segue Schema.org: un Item e' un CreativeWork, una Visit e' una
 * ItemList. I nomi dei campi con la chiocciola ("@id", "@type") vengono da li'
 * e non vanno rinominati: sono il contratto con cui i dati sono serializzati.
 *
 * Note sui campi meno ovvi:
 * - Artwork.imageUri e' l'indirizzo remoto su Wikidata, Artwork.imagePath il
 *   percorso della copia scaricata sul server; i client provano il secondo e
 *   ripiegano sul primo.
 * - Artwork.locationId e' l'id del nodo dentro la mappa SVG del museo: e' cio'
 *   che lega un'opera alla sua posizione fisica.
 * - Item["@id"] ha la forma QID-autore-tono-durata ed e' OPACO: e' referenziato
 *   da Visit.itemListElement e da User.collezione, quindi non si riscrive
 *   nemmeno quando cambia il tono.
 * - Item.timeRequired sono secondi nudi in forma di stringa ("15"), non una
 *   durata ISO.
 * - Visit.duration e' la durata TOTALE in secondi, non quella per opera.
 * - Visit.accessKey, se presente, marca la visita come guidata: gratuita, fuori
 *   dal catalogo, accessibile solo digitando la parola chiave.
 * - L'identita' di un User e' la COPPIA (username, role): lo stesso username
 *   puo' esistere come autore e come visitatore, e sono due account distinti e
 *   non collegati.
 */

// ============================================================================
//                                  Utenti
// ============================================================================

export type UserRole = "autore" | "visitatore";

export interface User {
  username: string;
  role: UserRole;
  /** Budget d'acquisto: solo sugli account visitatore. */
  wallet?: number;
  /** ID dei contenuti posseduti. */
  collezione: string[];
}

// ============================================================================
//                                   Opere
// ============================================================================

export interface Author {
  name: string;
  qid: string;
}

export interface Style {
  name: string;
  qid: string;
}

export interface Artwork {
  "@id": string;
  qid: string;
  name: string;
  imageUri: string;
  imagePath: string;
  author: Author;
  style: Style;
  ofMuseum: string;
  locationId: string;
  lastUpdated: Date;
}

export interface Museum {
  "@id": string;
  qid: string;
  name: string;
  created: string;
  location: string;
  mapPath: string;
}

// ============================================================================
//                          Contenuti (item e visite)
// ============================================================================

export interface Item {
  "@id": string;
  about: string | Artwork;
  text: string;
  timeRequired: string;
  educationalLevel: string;
  author: string;
  license: string;
  price?: number;
  /** "privato": fuori dal catalogo e non vendibile, riservato alle visite guidate del suo autore. */
  visibility?: "pubblico" | "privato";
}

/**
 * Indicazione logistica dentro una visita ("prosegui a sinistra della scala
 * verso la sala 12"). Non e' un item e non fa parte di un item.
 * `after` e' l'@id della tappa dopo la quale mostrarla; null = nota d'apertura.
 */
export interface LogisticNote {
  after: string | null;
  text: string;
}

/** Domanda del quiz di fine visita. `correct` non lascia mai il server. */
export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

export interface Visit {
  "@id": string;
  name: string;
  level: string;
  duration: number;
  price?: number;
  license?: string;
  ofMuseum: string;
  itemListElement: string[];
  /** Sottoinsieme di itemListElement da mostrare solo se resta tempo. */
  optionalItems?: string[];
  /** Le stringhe nude sono documenti creati prima delle note posizionate. */
  logistics: (string | LogisticNote)[];
  author?: string;
  accessKey?: string;
  quiz?: QuizQuestion[];
}

/** Un item unito all'opera che descrive: la giunzione avviene sul server. */
export interface Match {
  artwork: Artwork;
  item: Item;
}

/** Unione usata dal marketplace, dove item e visite stanno negli stessi elenchi. */
export type Contenuto = Item | Visit;
