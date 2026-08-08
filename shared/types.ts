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
 *
 * Tre campi hanno un perche' che non sta in una riga:
 *
 * `Visit.visibility` si SCRIVE alla creazione e non si ricava dal ruolo a ogni
 * lettura. Le visite che nascono da un visitatore sono private perche' quello
 * compone un itinerario per se' e non un prodotto da mettere in vendita —
 * vendere e' il mestiere dell'autore (slide 22: licenza, prezzo, adozioni,
 * vendite). Ricavarla dal ruolo vorrebbe dire che chi diventasse autore domani
 * si ritroverebbe pubblicati gli itinerari che aveva scritto per se'.
 *
 * `Museum.opere` e `Museum.visite` li conta il server perche' il client scarica
 * il catalogo di UN museo alla volta, e quindi non potrebbe piu' contare quelli
 * che non ha scaricato.
 *
 * `Visit.mancanti`, `costoMancanti` e `totale` non stanno nel documento su Mongo:
 * sono il conto per chi sta chiedendo (quante tappe gli mancano, quanto costano,
 * quanto pagherebbe in tutto), cambiano da persona a persona e li allega
 * `GET /visits`. Stanno nel tipo perche' sono forma dello scambio, come il resto.
 *
 * `Match.anchor` esiste perche' un contenuto su uno stile non ha un posto sulla
 * pianta, ma chi lo ascolta ce l'ha: e' la prossima opera del percorso.
 *
 * Le GUARDIE in fondo servono perche' `Content` e' un'unione, e un campo che
 * esiste solo su una delle due meta' (`level`, `itemListElement`, `kind`) non si
 * puo' leggere prima di sapere quale delle due si ha in mano. Distinguono per un
 * campo obbligatorio di ciascuna e non per `@type`, che non fa parte di questi
 * tipi — esiste solo come valore di scorta dello schema Mongoose, quindi un
 * documento inserito per altra via ne sarebbe privo. Il campo obbligatorio
 * dell'item e' `kind` e non `about`: cercare `about` farebbe sparire dagli
 * elenchi ogni contenuto che non parla di un'opera. `isAboutArtwork` e' l'unica
 * domanda che il codice pone sul genere; gli altri si mostrano e basta.
 */

// ============================================================================
//                                  Utenti
// ============================================================================

export type UserRole = "autore" | "visitatore" | "curatore";

export interface User {
  username: string;
  role: UserRole;
  wallet?: number; // budget d'acquisto: solo sugli account visitatore
  collezione: string[]; // gli `@id` dei contenuti posseduti
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
  imagePath?: string; // la copertina scelta dal curatore; senza, la carta resta di solo testo
  opere?: number; // quante opere ha il museo, contate dal server
  visite?: number; // quante visite ha in vetrina, contate dal server
  logistics?: string[]; // le indicazioni valide per tutto il museo: ingresso, biglietto, guardaroba
}

// ============================================================================
//                          Contenuti (item e visite)
// ============================================================================

export interface Item {
  "@id": string;
  kind: string; // di che cosa parla: uno degli `itemKinds`
  about?: string | Artwork; // l'opera descritta: c'e' SOLO se `kind` e' "opera"
  subject?: string; // il nome del soggetto: c'e' solo se NON e' un'opera
  imagePath?: string; // immagine propria dell'item; vince su quella dell'opera
  ofMuseum: string;
  text: string;
  timeRequired: string;
  educationalLevel: string;
  author: string;
  license: string;
  price?: number;
  visibility?: "pubblico" | "privato"; // "privato": fuori dal catalogo, per le guidate del suo autore
}

/**
 * Indicazione logistica dentro una visita ("prosegui a sinistra della scala
 * verso la sala 12"). Non e' un item e non fa parte di un item.
 */
export interface LogisticNote {
  after: string | null; // l'`@id` della tappa dopo la quale mostrarla; null = nota d'apertura
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
  imagePath?: string; // la copertina caricata da chi compone; senza, la tessera resta il titolo
  itemListElement: string[];
  optionalItems?: string[]; // sottoinsieme di itemListElement da mostrare solo se resta tempo
  logistics: (string | LogisticNote)[]; // una stringa nuda vale come nota d'apertura
  author?: string;
  visibility?: "pubblico" | "privato"; // "privato": la vede solo chi l'ha composta
  accessKey?: string;
  quiz?: QuizQuestion[];
  mancanti?: number; // quante tappe mancano a chi chiede: calcolato, non salvato
  costoMancanti?: number; // quanto costano quelle tappe: calcolato, non salvato
  totale?: number; // quanto pagherebbe in tutto: calcolato, non salvato
}

/** Una tappa della visita. */
export interface Match {
  item: Item;
  artwork: Artwork | null;
  anchor: Artwork | null; // l'opera davanti a cui si sta mentre si ascolta l'item
}

/** Unione usata dal marketplace, dove item e visite stanno negli stessi elenchi. */
export type Content = Item | Visit;

// --- Guardie di tipo --------------------------------------------------------

export function isVisit(c: Content | Artwork): c is Visit {
  return "itemListElement" in c;
}

export function isItem(c: Content | Artwork): c is Item {
  return "kind" in c;
}

export function isAboutArtwork(i: Item): boolean {
  return i.kind === "opera";
}

export function isArtwork(c: Content | Artwork): c is Artwork {
  return "qid" in c;
}
