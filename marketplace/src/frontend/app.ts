import { UserRole } from '../../../shared/types.js';
import { state } from './state.js';

/**
 * Logica di collegamento tra Alpine.js e lo Stato Professionale
 */
export function appData() {
    // Restituiamo direttamente l'istanza dello stato.
    // Alpine.js la renderà "reattiva" automaticamente.
    return state;
}

// Esposizione globale per Alpine.js
(window as any).appData = appData;

// Inizializzazione manuale se Alpine è già caricato
if ((window as any).Alpine) {
    (window as any).Alpine.data('appData', appData);
}
