// Tipi di base condivisi tra Navigator, Marketplace e Server
export type UserRole = "autore" | "visitatore";

// Livelli educativi (ex Tono)
export type EducationalLevel = "infantile" | "semplice" | "medio" | "avanzato" | "specialistico";

/**
 * Rappresenta l'oggetto fisico (VisualArtwork su Schema.org)
 */
export interface Artwork {
  _id?: string;
  "@context": string;
  "@type": string;
  "@id": string; // URI o QID
  wikiDataUri: string;
  name?: string;
  image?: string;
  author?: string;
  style?: string;
  museum?: string; // Il museo che ospita l'opera
  lastUpdated?: Date;
}

/**
 * Rappresenta il contenuto creativo/audioguida (CreativeWork su Schema.org)
 */
export interface Item {
  _id?: string;
  "@context": string;
  "@type": string;
  "@id": string; // ID unico generato (es. QID-Level-Time)
  about: string | Artwork; // ID dell'artwork o oggetto popolato
  text: string;
  timeRequired: string; // Durata (es. "30s")
  educationalLevel: EducationalLevel;
  author: string;
  license: string;
  price?: number; // Prezzo nel marketplace
}

/**
 * Rappresenta un percorso/lista di item (ItemList su Schema.org)
 */
export interface Visit {
  _id?: string;
  "@context": string;
  "@type": string;
  "@id": string;
  name: string;
  price?: number;
  itemListElement: string[]; // Array di ID di Item
  logistics: string[]; // Indicazioni testuali
  author: string;
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
