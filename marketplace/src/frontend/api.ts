import { Contenuto, Artwork, Item, Museum, User } from '../../../shared/types.js';

// Utente restituito dal server (senza password)
export type UserDTO = Pick<User, 'username' | 'wallet' | 'collezione'>;

async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => ({} as any));
  return data.error || fallback;
}

/**
 * Servizio per la comunicazione con il server (Network Layer)
 */
export const ArtAPI = {
  // --- Autenticazione / utenti (persistiti su MongoDB) ---
  async login(username: string, password: string): Promise<UserDTO> {
    const response = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw new Error(await readError(response, 'Credenziali non valide'));
    return response.json();
  },

  async register(username: string, password: string): Promise<UserDTO> {
    const response = await fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw new Error(await readError(response, 'Errore in registrazione'));
    return response.json();
  },

  // Acquisto persistente: il server scala il wallet, aggiorna la collezione e
  // accredita l'autore. Il prezzo passato è solo un fallback (il server usa
  // quello autoritativo del contenuto).
  async buy(username: string, itemId: string, price: number): Promise<UserDTO> {
    const response = await fetch(`/api/users/${encodeURIComponent(username)}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, price }),
    });
    if (!response.ok) throw new Error(await readError(response, 'Errore nell\'acquisto'));
    return response.json();
  },

  // Visita guidata: lo studente entra nella sala d'attesa digitando la parola
  // chiave. Ritorna la vista sessione (con id + visitName) o lancia se 404/errore.
  async joinGuidedSession(accessKey: string, username: string): Promise<any> {
    const response = await fetch('/api/guided-sessions/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey, username }),
    });
    if (!response.ok)
      throw new Error(
        await readError(response, 'Nessuna visita guidata attiva con questa parola chiave'),
      );
    return response.json();
  },

  // Vendite/adozioni dei contenuti pubblicati da un autore
  async fetchSales(username: string): Promise<any[]> {
    const response = await fetch(`/api/users/${encodeURIComponent(username)}/sales`);
    if (!response.ok) throw new Error('Errore caricamento vendite');
    return response.json();
  },

  // Recupera la lista dei musei disponibili (per il pannello di selezione)
  async fetchMuseums(): Promise<Museum[]> {
    const response = await fetch('/api/museums');
    if (!response.ok) throw new Error('Errore caricamento musei');
    return response.json();
  },

  // Recupera la lista di tutte le opere dal database (per la selezione nell'editor)
  async fetchArtworks(): Promise<Artwork[]> {
    const response = await fetch('/api/artworks');
    if (!response.ok) throw new Error('Errore caricamento artworks');
    return response.json();
  },

  // Recupera le visite (tour) dal marketplace
  async fetchVisite(): Promise<Contenuto[]> {
    const response = await fetch('/api/visits');
    if (!response.ok) throw new Error('Errore caricamento visite');
    return response.json();
  },

  // Recupera tutti gli item (contenuti) in vendita, con l'artwork popolato
  async fetchItems(): Promise<Item[]> {
    const response = await fetch('/api/items');
    if (!response.ok) throw new Error('Errore caricamento item');
    return response.json();
  },

  // Recupera i contenuti creati da uno specifico autore
  async fetchMyItems(authorName: string): Promise<Item[]> {
    const response = await fetch(`/api/items/author/${encodeURIComponent(authorName)}`);
    if (!response.ok) throw new Error('Errore caricamento tuoi contenuti');
    return response.json();
  },

  // Elimina una visita creata dall'utente
  async eliminaVisita(id: string): Promise<void> {
    const response = await fetch(`/api/visits/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Errore durante l'eliminazione della visita");
    }
  },

  // Invia un nuovo contenuto al server
  async pubblica(payload: any): Promise<void> {
    // Determina l'endpoint in base al tipo di contenuto
    const endpoint = payload.tipo === 'Visita' ? '/api/visits' : '/api/items';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Errore durante la pubblicazione');
    }
  }
};
