export type UserRole = 'autore' | 'visitatore';

export interface Artwork {
  "@id": string; // URI o QID
  wikiDataUri: string;
  name: string;
  imageUri: string;
  image: string;
  author: string;
  style: string;
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
  price?: number;
  itemListElement: string[]; // Array di ID di Item
  logistics: string[]; // Indicazioni testuali
  author?: string;
}

export type EducationalLevel = 'infantile' | 'semplice' | 'medio' | 'avanzato' | string;

// Unione per il Marketplace
export type Contenuto = Item | Visit;

// Profilo utente (esteso)
export interface User {
  username: string;
  role: UserRole;
  wallet: number;
  collezione: string[]; // ID degli item/visit acquistati
}
