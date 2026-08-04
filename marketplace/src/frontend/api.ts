/**
 * Chiamate al server.
 *
 * Tutti i percorsi sono relativi: il marketplace e' servito dallo stesso server
 * delle API, quindi qui non compaiono host ne' porte.
 *
 * Chi chiede non sta nell'indirizzo. L'unica cosa che dice chi siamo e' il
 * biglietto coniato dal server all'accesso, che `call` attacca da se' a ogni
 * richiesta: nessuna funzione qui sotto ha un parametro `user`, quindi non c'e'
 * nessun posto in cui dimenticarselo e nessun nome che si possa riscrivere a
 * mano per leggere i testi a pagamento di un altro o spenderne il portafoglio.
 *
 * Il biglietto sta in `sessionStorage` e non in `localStorage`: muore chiudendo
 * la scheda, cosi' riaprire l'applicazione mostra di nuovo la soglia. Sopravvive
 * pero' al ricaricamento e all'andata e ritorno verso il navigator, che stanno
 * nella stessa scheda: e' proprio quel viaggio a non funzionare senza.
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

// --- Il biglietto -------------------------------------------------------------

const TOKEN_KEY = 'artaround-sessione';
let token = sessionStorage.getItem(TOKEN_KEY) || '';
let onExpired: () => void = () => {};

export function setToken(value: string): void {
  token = value;
  sessionStorage.setItem(TOKEN_KEY, value);
}

export function clearToken(): void {
  token = '';
  sessionStorage.removeItem(TOKEN_KEY);
}

export function hasToken(): boolean {
  return token !== '';
}

export function onSessionExpired(handler: () => void): void {
  onExpired = handler;
}

/**
 * Il 401 si gestisce QUI e non nelle ~25 chiamate: una sola di quelle
 * dimenticata darebbe una schermata vuota invece di riportare alla soglia.
 * Si avvisa solo se un biglietto c'era davvero, altrimenti il 401 di una
 * password sbagliata butterebbe fuori chi non e' ancora entrato.
 */
async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  if (response.status === 401 && token) {
    clearToken();
    onExpired();
  }
  return response;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => ({}) as any);
  return data.error || fallback;
}

export const ArtAPI = {
  async fetchConfig(): Promise<{ navigatorOrigin: string }> {
    const response = await call('/api/config');
    if (!response.ok) throw new Error('Configurazione non disponibile');
    return response.json();
  },

  async login(
    username: string,
    password: string,
    role?: UserRole,
  ): Promise<UserDTO | ScelteRuolo> {
    const response = await call('/api/users/login', {
      method: 'POST',
      headers: JSON_HEADERS,
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
    const response = await call('/api/users/register', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ username, password, role }),
    });
    if (!response.ok)
      throw new Error(await readError(response, 'Errore in registrazione'));
    return response.json();
  },

  async fetchMe(): Promise<UserDTO> {
    const response = await call('/api/users/me');
    if (!response.ok) throw new Error('Sessione non valida');
    return response.json();
  },

  async logout(): Promise<void> {
    await call('/api/users/logout', { method: 'POST' });
  },

  /** Un biglietto nuovo per un solo viaggio verso il navigator. */
  async newHandoff(): Promise<string> {
    const response = await call('/api/users/handoff', { method: 'POST' });
    if (!response.ok) throw new Error('Non riesco ad aprire il navigator');
    const data = await response.json();
    return data.handoff;
  },

  async buy(itemId: string): Promise<UserDTO> {
    const response = await call('/api/users/buy', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ itemId }),
    });
    if (!response.ok)
      throw new Error(await readError(response, "Non è stato possibile completare l'acquisto"));
    return response.json();
  },

  async joinGuidedSession(accessKey: string, museum?: string): Promise<any> {
    const response = await call('/api/guided-sessions/join', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ accessKey, museum }),
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

  async fetchSales(): Promise<any[]> {
    const response = await call('/api/users/sales');
    if (!response.ok) throw new Error('Errore caricamento vendite');
    return response.json();
  },

  async fetchMuseums(): Promise<Museum[]> {
    const response = await call('/api/museums');
    if (!response.ok) throw new Error('Errore caricamento musei');
    return response.json();
  },

  async fetchArtworks(museumQid?: string): Promise<Artwork[]> {
    const q = museumQid ? `?museum=${encodeURIComponent(museumQid)}` : '';
    const response = await call(`/api/artworks${q}`);
    if (!response.ok) throw new Error('Errore caricamento opere');
    return response.json();
  },

  /** Ogni visita torna col suo conto: quanto costerebbe a chi sta chiedendo. */
  async fetchVisite(museumQid?: string): Promise<Visit[]> {
    const q = museumQid ? `?museum=${encodeURIComponent(museumQid)}` : '';
    const response = await call(`/api/visits${q}`);
    if (!response.ok) throw new Error('Errore caricamento visite');
    return response.json();
  },

  async fetchItemsMetadata(museumQid?: string): Promise<Item[]> {
    const q = museumQid ? `?museum=${encodeURIComponent(museumQid)}` : '';
    const response = await call(`/api/items/metadata${q}`);
    if (!response.ok) throw new Error('Errore caricamento contenuti');
    return response.json();
  },

  async fetchArtworkItems(artworkQid: string): Promise<Item[]> {
    const response = await call(
      `/api/artworks/${encodeURIComponent(artworkQid)}/items`,
    );
    if (!response.ok) throw new Error('Errore caricamento delle descrizioni');
    return response.json();
  },

  async fetchItemText(id: string): Promise<{ text: string; locked: boolean }> {
    const response = await call(`/api/items/${encodeURIComponent(id)}/text`);
    if (!response.ok) throw new Error('Errore caricamento del testo');
    return response.json();
  },

  async uploadItemImage(file: File): Promise<string> {
    const form = new FormData();
    form.append('immagine', file);
    const response = await call('/api/items/image', { method: 'POST', body: form });
    if (!response.ok)
      throw new Error(await readError(response, "Errore nel caricamento dell'immagine"));
    const data = await response.json();
    return data.path;
  },

  async fetchMuseumTopics(qid: string): Promise<{ name: string; kind: string }[]> {
    const response = await call(`/api/museums/${encodeURIComponent(qid)}/topics`);
    if (!response.ok) throw new Error('Errore caricamento dei soggetti');
    return response.json();
  },

  async fetchMyItems(authorName: string): Promise<Item[]> {
    const response = await call(`/api/items/author/${encodeURIComponent(authorName)}`);
    if (!response.ok) throw new Error('Errore caricamento dei tuoi contenuti');
    return response.json();
  },

  async eliminaVisita(id: string): Promise<void> {
    const response = await call(`/api/visits/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok)
      throw new Error(await readError(response, "Errore durante l'eliminazione"));
  },

  // --- Gestione del museo -------------------------------------------------------------

  async fetchOverview(qid: string): Promise<any> {
    const response = await call(`/api/museums/${encodeURIComponent(qid)}/overview`);
    if (!response.ok) throw new Error("Errore caricamento del quadro d'insieme");
    return response.json();
  },

  async fetchCuratedItems(qid: string): Promise<Item[]> {
    const response = await call(`/api/museums/${encodeURIComponent(qid)}/items`);
    if (!response.ok) throw new Error('Errore caricamento del catalogo');
    return response.json();
  },

  async impattoItem(id: string): Promise<any> {
    const response = await call(`/api/items/${encodeURIComponent(id)}/impact`);
    if (!response.ok)
      throw new Error(await readError(response, "Errore nel calcolo dell'impatto"));
    return response.json();
  },

  async eliminaItem(id: string): Promise<any> {
    const response = await call(`/api/items/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok)
      throw new Error(await readError(response, "Errore durante l'eliminazione"));
    return response.json();
  },

  async pubblica(payload: any): Promise<void> {
    const endpoint = payload.tipo === 'Visita' ? '/api/visits' : '/api/items';
    const response = await call(endpoint, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
    if (!response.ok)
      throw new Error(await readError(response, 'Errore durante la pubblicazione'));
  },
};
