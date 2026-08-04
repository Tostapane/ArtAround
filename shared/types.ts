/**
 * Tipi condivisi da server, navigator e marketplace.
 *
 * Il modello segue Schema.org: un Item e' un CreativeWork, una Visit una
 * ItemList. I campi con la chiocciola vengono da li' e non si rinominano: sono
 * il contratto con cui i dati sono serializzati.
 *
 * I campi meno ovvi: `imageUri` e' l'indirizzo remoto e `imagePath` la copia
 * scaricata; `locationId` e' il nodo sulla mappa SVG, cioe' cio' che lega
 * un'opera al suo posto; `Item["@id"]` e' opaco, perche' lo referenziano le
 * visite e le collezioni; `timeRequired` sono secondi nudi in stringa;
 * `Visit.duration` e' il totale, non il per-opera; `accessKey` marca una visita
 * come guidata, quindi gratuita e fuori dal catalogo.
 *
 * L'identita' di un User e' la coppia (username, role): lo stesso nome puo'
 * esistere come autore e come visitatore, e sono due account scollegati.
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
  /** Una stringa nuda vale come nota d'apertura, senza ancoraggio a una tappa. */
  logistics: (string | LogisticNote)[];
  author?: string;
  accessKey?: string;
  quiz?: QuizQuestion[];
  /*
   * Il conto per chi la sta chiedendo, che `GET /visits` allega alla risposta:
   * quante tappe gli mancano, quanto costano e quanto pagherebbe in tutto. Non
   * stanno nel documento su Mongo e cambiano da persona a persona; stanno qui
   * perche' sono forma dello scambio, come il resto del tipo.
   */
  mancanti?: number;
  costoMancanti?: number;
  totale?: number;
}

/**
 * Una tappa della visita. `anchor` e' l'opera davanti a cui si sta mentre la si
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
 * `Content` e' un'unione, e un campo che esiste solo su una delle due meta'
 * (`level`, `itemListElement`, `kind`) non si puo' leggere prima di sapere quale
 * delle due sia.
 *
 * Si distinguono per un campo obbligatorio di ciascuna e non per `@type`, che
 * non fa parte di questi tipi: esiste solo come default dello schema Mongoose,
 * quindi un documento inserito per altra via ne sarebbe privo.
 *
 * Il campo obbligatorio dell'item e' `kind`, non `about`: cercare `about`
 * farebbe sparire dagli elenchi ogni contenuto che non parla di un'opera.
 */
export function isVisit(c: Content | Artwork): c is Visit {
  return "itemListElement" in c;
}

export function isItem(c: Content | Artwork): c is Item {
  return "kind" in c;
}

/** L'unica domanda che il codice pone sul genere: gli altri si mostrano e basta. */
export function isAboutArtwork(i: Item): boolean {
  return i.kind === "opera";
}

export function isArtwork(c: Content | Artwork): c is Artwork {
  return "qid" in c;
}
