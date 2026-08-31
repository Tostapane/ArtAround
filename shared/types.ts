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
 * L'identita' di un User e' l'USERNAME, e un nome vale per un account solo: non
 * possono esistere un autore e un visitatore omonimi. E' la regola che tiene in
 * piedi ogni guardia sui contenuti, perche' `Item.author` e `Visit.author` sono
 * un nome nudo e non portano il ruolo accanto: chi firma una descrizione la
 * firma col nome, e quel nome identifica una persona sola. Finche' la coppia
 * (username, role) e' stata l'identita', entrare con l'altro profilo omonimo
 * bastava a cancellare le descrizioni del primo e a leggerne le private.
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

// ============================================================================
//                   Risposte calcolate: conti, non documenti
// ============================================================================

/**
 * Le risposte che il server non legge da Mongo ma CALCOLA per chi chiede:
 * l'impatto di un'eliminazione, il quadro d'insieme del museo, il resoconto
 * vendite. Non sono documenti e non hanno un modello, ma sono lo stesso un
 * accordo fra le due sponde, quindi stanno qui per la ragione dei tipi accanto
 * e di `access.ts`: un accordo scritto in due posti si rompe da solo senza che
 * niente lo segnali.
 *
 * Che quel silenzio non sia teorico lo dice la storia di `svuotate`: il server
 * ha cominciato a mandarlo, il tipo dalla parte del client non l'ha mai saputo,
 * e chi doveva leggerlo se l'e' preso con un `as any` — cioe' spegnendo proprio
 * il controllo che avrebbe segnalato lo scarto. Le rotte qui sotto DICHIARANO
 * ora quel che rispondono, cosi' togliere un campo da una parte accende un
 * errore dall'altra invece di una colonna vuota a schermo.
 */

/** Una visita che nomina il contenuto che si sta per eliminare. */
export interface VisitaCitata {
  id: string;
  name: string;
  author: string | null;
  guidata: boolean;
}

/** Una visita ridotta a nome e id: quelle che resterebbero senza tappe. */
export interface VisitaNominata {
  id: string;
  name: string;
}

/** Cosa sparirebbe eliminando una DESCRIZIONE: `GET /api/items/:id/impact`. */
export interface ImpactReport {
  id: string;
  author: string;
  educationalLevel: string;
  visite: VisitaCitata[];
  svuotate: VisitaNominata[]; // quelle che resterebbero a zero tappe: spariscono comunque
  adozioni: number;
}

/**
 * Cosa sparirebbe togliendo un'OPERA: `GET /api/artworks/:qid/impact`.
 * E' un'altra forma e non una variante della precedente: un'opera non ha un
 * tono ne' un autore che l'abbia scritta, e porta invece il conto delle
 * descrizioni che ne parlano.
 */
export interface ArtworkImpactReport {
  qid: string;
  nome: string;
  descrizioni: number;
  visite: VisitaCitata[];
  svuotate: VisitaNominata[];
  adozioni: number;
}

/** Il quadro d'insieme del curatore: `GET /api/museums/:qid/overview`. */
export interface MuseumOverview {
  conteggi: {
    opere: number;
    item: number;
    itemPrivati: number;
    visite: number;
    visiteGuidate: number;
  };
  copertura: {
    opereTotali: number;
    senzaDescrizione: { qid: string; name: string }[];
    perTono: { tono: string; opere: number }[];
  };
  account: { autori: number; visitatori: number; curatori: number };
}

/** Una riga del resoconto vendite: `GET /api/users/sales`. */
export interface SaleRow {
  id: string;
  type: "Item" | "Visita";
  name: string;
  ofMuseum?: string;
  educationalLevel?: string; // solo sulle descrizioni: una visita non ha un tono suo
  price: number;
  license: string;
  adozioni: number; // quante collezioni lo contengono
  ricavo: number; // adozioni x prezzo
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
