export interface BaseArtwork {
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
export interface BaseItem {
  "@id": string; // ID unico generato (es. QID-Level-Time)
  about: string | BaseArtwork; // ID dell'artwork o oggetto popolato
  text: string;
  timeRequired: string; // Durata (es. "30s")
  educationalLevel: string;
  author: string;
  license: string;
  price?: number; // Prezzo nel marketplace
}

/**
 * Rappresenta un percorso/lista di item (ItemList su Schema.org)
 */
export interface BaseVisit {
  "@id": string;
  name: string;
  price?: number;
  itemListElement: string[]; // Array di ID di Item
  logistics: string[]; // Indicazioni testuali
  author?: string;
}

// Unione per il Marketplace
export type Contenuto = BaseItem | BaseVisit;

// Profilo utente (esteso)
export interface User {
  username: string;
  role: string;
  wallet: number;
  collezione: string[]; // ID degli item/visit acquistati
}
