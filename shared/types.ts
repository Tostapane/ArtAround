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
 * - Un item non parla per forza di un'opera (slide 21: anche stili, movimenti,
 *   artisti, periodi). Lo dice `kind`: con "opera" c'e' `about`, altrimenti c'e'
 *   `subject` — il nome scritto dall'autore — con la sua `imagePath`, perche'
 *   non c'e' nessuna opera da cui prenderla.
 * - Visit.duration e' la durata TOTALE in secondi, non quella per opera.
 * - Visit.accessKey, se presente, marca la visita come guidata: gratuita, fuori
 *   dal catalogo, accessibile solo digitando la parola chiave.
 * - L'identita' di un User e' la COPPIA (username, role): lo stesso username
 *   puo' esistere come autore e come visitatore, e sono due account distinti e
 *   non collegati.
 * - I ruoli sono tre e non si sovrappongono: il visitatore consuma, l'autore
 *   produce contenuti, il curatore risponde del MUSEO — ne sorveglia il
 *   catalogo e puo' ritirare o eliminare quel che non ci deve stare. Il
 *   curatore non ha ne' portafoglio ne' collezione.
 */

// ============================================================================
//                                  Utenti
// ============================================================================

export type UserRole = "autore" | "visitatore" | "curatore";

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
  /**
   * Quante opere e quante visite in vetrina ha il museo. Li conta il server,
   * perche' il client scarica il catalogo di UN museo alla volta e quindi non
   * potrebbe piu' contare quelli che non ha scaricato.
   */
  opere?: number;
  visite?: number;
}

// ============================================================================
//                          Contenuti (item e visite)
// ============================================================================

export interface Item {
  "@id": string;
  /** Di che cosa parla: uno degli `itemKinds`. */
  kind: string;
  /** L'opera descritta: c'e' SOLO se `kind` e' "opera". */
  about?: string | Artwork;
  /** Il nome del soggetto: c'e' solo se NON e' un'opera. */
  subject?: string;
  /** Immagine propria dell'item; vince su quella dell'opera dove c'e' l'una e l'altra. */
  imagePath?: string;
  /** Il museo nel cui catalogo sta. */
  ofMuseum: string;
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
  /*
   * Il conto per CHI l'ha chiesta, che `GET /visits?user=` aggiunge alla
   * risposta: quante tappe gli mancano, quanto costano, e quanto pagherebbe in
   * tutto adesso. Non stanno nel documento su Mongo e cambiano da persona a
   * persona — sono qui perche' sono forma dello scambio, come il resto.
   */
  mancanti?: number;
  costoMancanti?: number;
  totale?: number;
}

/**
 * Una TAPPA della visita. `anchor` e' l'opera davanti a cui si sta mentre la si
 * ascolta: un contenuto su uno stile non ha un posto sulla pianta, ma chi lo
 * ascolta ce l'ha, ed e' la prossima opera del percorso.
 */
export interface Match {
  item: Item;
  artwork: Artwork | null;
  anchor: Artwork | null;
}

/** Unione usata dal marketplace, dove item e visite stanno negli stessi elenchi. */
export type Content = Item | Visit;

/**
 * Le guardie di tipo con cui si stabilisce che cosa si ha in mano.
 *
 * `Content` e' un'unione: un campo che esiste solo su una delle due meta'
 * (`level`, `itemListElement`, `kind`) non si puo' leggere senza prima stabilire
 * quale delle due si ha in mano. Le guardie fanno quello.
 *
 * Si distinguono per un campo OBBLIGATORIO di ciascuna e non per `@type`: `@type`
 * non fa parte di questi tipi, esiste solo come default dello schema Mongoose, e
 * un documento inserito per altra via ne sarebbe privo.
 *
 * ⚠️ Il campo obbligatorio dell'item e' `kind`, non `about`: cercare `about`
 * farebbe sparire dagli elenchi ogni contenuto che non parla di un'opera.
 */
export function isVisit(c: Content | Artwork): c is Visit {
  return "itemListElement" in c;
}

export function isItem(c: Content | Artwork): c is Item {
  return "kind" in c;
}

/** L'UNICA domanda che il codice pone sul genere: gli altri si mostrano e basta. */
export function isAboutArtwork(i: Item): boolean {
  return i.kind === "opera";
}

export function isArtwork(c: Content | Artwork): c is Artwork {
  return "qid" in c;
}
