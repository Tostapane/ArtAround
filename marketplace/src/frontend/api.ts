/**
 * Chiamate al server.
 *
 * Tutti i percorsi sono relativi: il marketplace e' servito dallo stesso server
 * delle API, quindi qui non compaiono host ne' porte.
 *
 * Il login puo' rispondere 300 quando le stesse credenziali valgono per due
 * profili: non e' un errore, e' una domanda.
 */
import {
  Content,
  Artwork,
  Item,
  Museum,
  User,
  UserRole,
  Visit,
} from '../../../shared/types.js';

export type UserDTO = Pick<User, 'username' | 'role' | 'wallet' | 'collezione'>;

/** Risposta del login quando le stesse credenziali valgono per due profili:
 *  il server non sceglie al posto nostro, restituisce le opzioni. */
export type ScelteRuolo = { scelta: true; ruoli: UserRole[] };

async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => ({}) as any);
  return data.error || fallback;
}

export const ArtAPI = {
  async fetchConfig(): Promise<{ navigatorOrigin: string }> {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('Configurazione non disponibile');
    return response.json();
  },

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
    if (response.status === 300) return response.json(); 
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

  async fetchArtworks(museumQid?: string): Promise<Artwork[]> {
    const q = museumQid ? `?museum=${encodeURIComponent(museumQid)}` : '';
    const response = await fetch(`/api/artworks${q}`);
    if (!response.ok) throw new Error('Errore caricamento opere');
    return response.json();
  },

  async fetchVisite(museumQid?: string): Promise<Visit[]> {
    const q = museumQid ? `?museum=${encodeURIComponent(museumQid)}` : '';
    const response = await fetch(`/api/visits${q}`);
    if (!response.ok) throw new Error('Errore caricamento visite');
    return response.json();
  },

  async redeemHandoff(handoff: string): Promise<any> {
    const response = await fetch('/api/users/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handoff }),
    });
    if (!response.ok) throw new Error('Biglietto non valido');
    return response.json();
  },

  async fetchItems(museumQid?: string, user?: string): Promise<Item[]> {
    const params = new URLSearchParams();
    if (museumQid) params.set('museum', museumQid);
    if (user) params.set('user', user);
    const q = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`/api/items${q}`);
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

  // --- Gestione del museo -------------------------------------------------------------

  async fetchOverview(qid: string): Promise<any> {
    const response = await fetch(`/api/museums/${encodeURIComponent(qid)}/overview`);
    if (!response.ok) throw new Error("Errore caricamento del quadro d'insieme");
    return response.json();
  },

  async fetchCuratedItems(qid: string): Promise<Item[]> {
    const response = await fetch(`/api/museums/${encodeURIComponent(qid)}/items`);
    if (!response.ok) throw new Error('Errore caricamento del catalogo');
    return response.json();
  },


  async impattoItem(id: string): Promise<any> {
    const response = await fetch(`/api/items/${encodeURIComponent(id)}/impact`);
    if (!response.ok)
      throw new Error(await readError(response, "Errore nel calcolo dell'impatto"));
    return response.json();
  },

  async eliminaItem(id: string): Promise<any> {
    const response = await fetch(`/api/items/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok)
      throw new Error(await readError(response, "Errore durante l'eliminazione"));
    return response.json();
  },

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
