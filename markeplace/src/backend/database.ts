import { Contenuto } from '../shared/types.js';

/**
 * Gestione dei dati in memoria (prossimo step: database reale)
 */
class Database {
  private contenuti: Contenuto[] = [];

  // Ottieni tutti i contenuti nel database
  getAll(): Contenuto[] {
    return this.contenuti;
  }

  // Filtra i contenuti per museo di appartenenza
  getByMuseum(museum: string): Contenuto[] {
    return this.contenuti.filter(c => c.museo === museum);
  }

  // Salva una nuova opera o visita nel catalogo
  save(item: Contenuto): void {
    this.contenuti.push(item);
  }
}

// Esporta un'istanza singola (singleton) per l'intera app
export const db = new Database();
