/*
 * TODO:
 * - definire il passaggio di visite custom tra marketplace e navigator
 * - definire un modo per assegnare piu' item allo stesso artwork
 * - definire un modo per selezionare il museo nel navigator via file di configurazione
 * - implementare la gestione di mappe svg lato server, definendo routes e api per servire il navigator
 * - debloatare alcune routes
 */

export type UserRole = "autore" | "visitatore";

export interface Author {
  name: string;
  qid: string;
}

export interface Style {
  name: string;
  qid: string;
}

export interface Artwork {
  "@id": string; // link a wikidata
  qid: string; // QXXXXXXX
  name: string;
  imageUri: string; // link all'immagine di wikidata
  imagePath: string; // percorso dell'immagine dentro il server
  author: Author;
  style: Style;
  ofMuseum: string; // indica il museo
  locationId: string;
  lastUpdated: Date;
}

/**
 * Rappresenta il contenuto creativo/audioguida (CreativeWork su Schema.org)
 */
export interface Item {
  "@id": string; // ID unico generato (es. QID-Level-Time)
  about: string | Artwork; // ID dell'artwork o oggetto popolato
  text: string;
  timeRequired: string; // Durata (es. "30s")
  educationalLevel: string;
  author: string;
  license: string;
  price?: number; // Prezzo nel marketplace
}

/*
 * Rappresenta l'unione tra item selezionati e il corrispettivo artwork
 */
export interface Match {
  artwork: Artwork;
  item: Item;
}

/**
 * Rappresenta un percorso/lista di item
 * NOTA: aggiungere un identificativo per distinguere
 * le visite fornite dal museo e quelle personalizzate
 */
export interface Visit {
  "@id": string;
  name: string;
  level: string;
  duration: number;
  price?: number;
  ofMuseum: string; // indica il museo a cui appartiene
  itemListElement: string[]; // Array di ID di Item
  logistics: string[]; // Indicazioni testuali
  author?: string;
}

// Unione per il Marketplace
export type Contenuto = Item | Visit;

// Profilo utente (esteso)
export interface User {
  username: string;
  role: UserRole;
  wallet: number;
  collezione: string[]; // ID degli item/visit acquistati
}

export interface Museum {
  "@id": string;
  qid: string; // uri di wikidata QXXXXXXX
  name: string;
  created: string;
  location: string;
  mapPath: string;
}
