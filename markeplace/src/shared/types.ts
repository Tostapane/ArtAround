// Tipi di base per l'applicazione
export type UserRole = 'autore' | 'visitatore';
export type ItemType = 'Item' | 'Visita';
export type Tono = 'infantile' | 'semplice' | 'medio' | 'avanzato';

// Varianti audioguida
export interface Descrizione {
    tono: Tono;
    lunghezza: string;
    testo: string;
}

// Tappe per i percorsi (Visita)
export interface Tappa {
    tipo: 'item' | 'logistica';
    id_item?: string;
    indicazione?: string;
}

/**
 * Base comune per tutto ciò che è presente nel Marketplace
 */
export interface BaseContenuto {
    id: string;
    titolo: string;
    autore: string;
    museo: string;
    prezzo: number;
}

/**
 * Rappresenta un'opera d'arte (Item)
 */
export interface Opera extends BaseContenuto {
    tipo: 'Item';
    immagine?: string;
    id_oper_universale?: string;
    descrizioni: Descrizione[];
}

/**
 * Rappresenta un percorso museale (Visita)
 */
export interface Visita extends BaseContenuto {
    tipo: 'Visita';
    percorso: Tappa[];
}

/**
 * Tipo "Unione": un Contenuto può essere o un'Opera o una Visita.
 * Questo obbliga TypeScript a controllare il campo 'tipo' prima di accedere 
 * a proprietà specifiche come 'descrizioni' o 'percorso'.
 */
export type Contenuto = Opera | Visita;

// Profilo utente
export interface User {
    username: string;
    role: UserRole;
    wallet: number;
}
