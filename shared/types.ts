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
 * Rappresenta un percorso/lista di item (ItemList su Schema.org)
 */
export interface Visit {
  "@id": string;
  name: string;
  level: string;
  duration: number;
  price?: number;
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
