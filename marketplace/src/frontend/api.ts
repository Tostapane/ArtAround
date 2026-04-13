import { Contenuto, Artwork, Item } from '../../../shared/types.js';

/**
 * Servizio per la comunicazione con il server (Network Layer)
 */
export const ArtAPI = {
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

  // Recupera i contenuti creati da uno specifico autore
  async fetchMyItems(authorName: string): Promise<Item[]> {
    const response = await fetch(`/api/items/author/${encodeURIComponent(authorName)}`);
    if (!response.ok) throw new Error('Errore caricamento tuoi contenuti');
    return response.json();
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
