import { Contenuto, Artwork } from '../../../shared/types.js';

/**
 * Servizio per la comunicazione con il server (Network Layer)
 */
export const ArtAPI = {
  // Recupera la lista di tutte le opere di un museo
  async fetchArtworks(museo: string): Promise<Artwork[]> {
    const response = await fetch(`/api/artworks?museum=${encodeURIComponent(museo)}`);
    if (!response.ok) throw new Error('Errore caricamento artworks');
    return response.json();
  },

  // Recupera i contenuti dal backend filtrati per museo
  async fetchOpere(museo: string): Promise<Contenuto[]> {
    const response = await fetch(`/api/opere?museum=${encodeURIComponent(museo)}`);
    if (!response.ok) throw new Error('Errore caricamento opere');
    // ritorna il risultato di fetch in formato json 
    return response.json();
  },

  // Invia un nuovo contenuto (opera o visita) al server per la persistenza
  async pubblica(opera: Contenuto): Promise<void> {
    const response = await fetch('/api/opere', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opera)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Errore durante la pubblicazione');
    }
  }
};
