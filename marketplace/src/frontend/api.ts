import {
  Contenuto,
  Artwork,
  Item,
  Museum,
  User,
  UserRole,
} from '../../../shared/types.js';

// Utente restituito dal server (senza password)
export type UserDTO = Pick<User, 'username' | 'role' | 'wallet' | 'collezione'>;

/** Risposta del login quando le stesse credenziali valgono per due profili:
 *  il server non sceglie al posto nostro, restituisce le opzioni. */
export type ScelteRuolo = { scelta: true; ruoli: UserRole[] };

async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => ({}) as any);
  return data.error || fallback;
}

/**
 * Servizio per la comunicazione con il server (Network Layer).
 * Tutti i percorsi sono RELATIVI: il marketplace e' servito dallo stesso
 * server delle API, quindi nessun host e nessuna porta compaiono qui.
 */
export const ArtAPI = {
  /** Configurazione d'ambiente (origine del navigator): niente porte scritte
   *  a mano nel codice del client. */
  async fetchConfig(): Promise<{ navigatorOrigin: string }> {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('Configurazione non disponibile');
    return response.json();
  },

  /**
   * Accesso. Il ruolo NON e' una domanda: lo risolve il server dalle
   * credenziali. Viene passato solo al secondo tentativo, quando lo stesso
   * username+password esiste sia come autore sia come visitatore.
   */
  async login(
    username: string,
    password: string,
    role?: UserRole,
  ): Promise<UserDTO | ScelteRuolo> {
    const response = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    if (response.status === 300) return response.json(); // due profili possibili
    if (!response.ok)
      throw new Error(
        await readError(response, 'Credenziali non valide. Controlla username e password.'),
      );
    return response.json();
  },

  async register(
    username: string,
    password: string,
    role: UserRole,
  ): Promise<UserDTO> {
    const response = await fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    if (!response.ok)
      throw new Error(await readError(response, 'Errore in registrazione'));
    return response.json();
  },

  // Acquisto persistente (solo visitatori): il server scala il wallet del
  // compratore e aggiorna la sua collezione, usando il prezzo autoritativo.
  async buy(username: string, itemId: string, price: number): Promise<UserDTO> {
    const response = await fetch(`/api/users/${encodeURIComponent(username)}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, price }),
    });
    if (!response.ok)
      throw new Error(await readError(response, "Non è stato possibile completare l'acquisto"));
    return response.json();
  },

  // Visita guidata: lo studente entra in sala d'attesa con la parola chiave.
  async joinGuidedSession(
    accessKey: string,
    username: string,
    museum?: string,
  ): Promise<any> {
    const response = await fetch('/api/guided-sessions/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey, username, museum }),
    });
    if (!response.ok)
      throw new Error(
        await readError(
          response,
          'Nessuna visita guidata aperta con questa parola chiave',
        ),
      );
    return response.json();
  },

  async fetchSales(username: string): Promise<any[]> {
    const response = await fetch(`/api/users/${encodeURIComponent(username)}/sales`);
    if (!response.ok) throw new Error('Errore caricamento vendite');
    return response.json();
  },

  async fetchMuseums(): Promise<Museum[]> {
    const response = await fetch('/api/museums');
    if (!response.ok) throw new Error('Errore caricamento musei');
    return response.json();
  },

  async fetchArtworks(): Promise<Artwork[]> {
    const response = await fetch('/api/artworks');
    if (!response.ok) throw new Error('Errore caricamento opere');
    return response.json();
  },

  async fetchVisite(): Promise<Contenuto[]> {
    const response = await fetch('/api/visits');
    if (!response.ok) throw new Error('Errore caricamento visite');
    return response.json();
  },

  async fetchItems(): Promise<Item[]> {
    const response = await fetch('/api/items');
    if (!response.ok) throw new Error('Errore caricamento contenuti');
    return response.json();
  },

  async fetchMyItems(authorName: string): Promise<Item[]> {
    const response = await fetch(`/api/items/author/${encodeURIComponent(authorName)}`);
    if (!response.ok) throw new Error('Errore caricamento dei tuoi contenuti');
    return response.json();
  },

  async eliminaVisita(id: string): Promise<void> {
    const response = await fetch(`/api/visits/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok)
      throw new Error(await readError(response, "Errore durante l'eliminazione"));
  },

  // Pubblica un contenuto: l'endpoint dipende dal tipo.
  async pubblica(payload: any): Promise<void> {
    const endpoint = payload.tipo === 'Visita' ? '/api/visits' : '/api/items';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok)
      throw new Error(await readError(response, 'Errore durante la pubblicazione'));
  },
};
