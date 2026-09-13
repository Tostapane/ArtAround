/**
 * Contratto dati comune a server, marketplace e navigator. I campi del payload
 * restano in italiano perche' rinominarli richiede una migrazione coordinata di
 * database e tre applicazioni.
 */
// ============================================================================

export type UserRole = "autore" | "visitatore" | "curatore";

export interface User {
  username: string;
  role: UserRole;
  wallet?: number;
  collezione: string[];
}

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

export interface MapLocation {
  room: string;
  floor: number;
  tone: string;
}

export interface Museum {
  "@id": string;
  qid: string;
  name: string;
  created: string;
  location: string;
  mapPath: string;
  imagePath?: string;
  opere?: number;
  visite?: number;
  logistics?: string[];
  mapLocations?: Record<string, MapLocation>;
}

// ============================================================================

export interface Item {
  "@id": string;
  kind: string;
  about?: string | Artwork;
  subject?: string;
  imagePath?: string;
  ofMuseum: string;
  text: string;
  timeRequired: string;
  educationalLevel: string;
  author: string;
  license: string;
  price?: number;
  visibility?: "pubblico" | "privato";
}

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
  imagePath?: string;
  itemListElement: string[];
  optionalItems?: string[];
  logistics: (string | LogisticNote)[];
  author?: string;
  visibility?: "pubblico" | "privato";
  accessKey?: string;
  quiz?: QuizQuestion[];
  mancanti?: number;
  costoMancanti?: number;
  totale?: number;
}

// ============================================================================

export interface VisitaCitata {
  id: string;
  name: string;
  author: string | null;
  guidata: boolean;
}

export interface VisitaNominata {
  id: string;
  name: string;
}

export interface ImpactReport {
  id: string;
  author: string;
  educationalLevel: string;
  visite: VisitaCitata[];
  svuotate: VisitaNominata[];
  adozioni: number;
}

export interface ArtworkImpactReport {
  qid: string;
  nome: string;
  descrizioni: number;
  visite: VisitaCitata[];
  svuotate: VisitaNominata[];
  adozioni: number;
}

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

export interface SaleRow {
  id: string;
  type: "Item" | "Visita";
  name: string;
  ofMuseum?: string;
  educationalLevel?: string;
  price: number;
  license: string;
  adozioni: number;
  ricavo: number;
}

export interface Match {
  item: Item;
  artwork: Artwork | null;
  anchor: Artwork | null;
}

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
