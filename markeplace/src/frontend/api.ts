import { Contenuto } from '../shared/types.js';

/**
 * Servizio per la comunicazione con il server (Network Layer)
 */
export const ArtAPI = {
  // Recupera i contenuti dal backend filtrati per museo
  async fetchOpere(museo: string): Promise<Contenuto[]> {
    const response = await fetch(`/api/opere?museo=${encodeURIComponent(museo)}`);
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
    if (!response.ok) throw new Error('Errore durante la pubblicazione');
  }
};
