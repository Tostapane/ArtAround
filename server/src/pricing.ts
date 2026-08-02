/**
 * Quanto costa a TE prendere un contenuto, adesso.
 *
 * Il conto dipende da chi lo chiede — quel che hai gia' non si ripaga, quel che
 * e' gratuito non si paga affatto — quindi lo fa il server, che e' l'unico a
 * sapere che cosa hai. Il client lo mostra e basta: quando lo calcolava anche
 * lui, il numero scritto sul bottone e quello addebitato erano due conti
 * distinti che nessuno confrontava.
 *
 * Una funzione sola, e la usano tutte e due le strade che toccano i soldi:
 * `GET /visits` la applica a ogni visita per dire in anticipo quanto verrebbe a
 * costare, e `POST /users/:nome/buy` per addebitare. Cosi' la cifra mostrata e
 * la cifra addebitata non sono d'accordo per fortuna: sono la stessa riga.
 *
 * NON FA I/O apposta: i documenti delle tappe arrivano gia' caricati in una
 * mappa. Chi la chiama su un elenco di visite li prende tutti con UNA query e
 * poi conta in memoria — una query per visita crescerebbe col catalogo, che e'
 * l'errore gia' pagato una volta nel resoconto delle vendite.
 */
import { isReadable } from "../../shared/access";

export interface Conto {
  /** Gli id da mettere in collezione: il contenuto, se non e' gia' tuo, piu' le tappe da comprare. */
  daPrendere: string[];
  /** Quante tappe mancano. Una tappa che non si risolve conta come mancante: non si potrebbe leggere. */
  mancanti: number;
  /** Quanto costano le tappe mancanti. */
  costoMancanti: number;
  /** Il conto: le tappe mancanti piu' il contenuto stesso, se non e' gia' tuo. */
  totale: number;
}

export function conto(
  content: any,
  username: string,
  owned: Set<string>,
  itemsById: Map<string, any>,
): Conto {
  const daPrendere: string[] = [];
  let mancanti = 0;
  let costoMancanti = 0;
  let totale = 0;

  if (content && !owned.has(content["@id"])) {
    daPrendere.push(content["@id"]);
    totale += Number(content.price) || 0;
  }

  let tappe: string[] = [];
  if (content && Array.isArray(content.itemListElement)) {
    tappe = content.itemListElement;
  }

  for (const id of tappe) {
    const tappa = itemsById.get(id);
    // Una tappa che non esiste piu' non si compra e non si legge: manca e basta.
    if (!tappa) {
      mancanti++;
      continue;
    }
    if (isReadable(tappa, username, owned.has(id))) continue;
    if (daPrendere.includes(id)) continue;
    mancanti++;
    costoMancanti += Number(tappa.price) || 0;
    daPrendere.push(id);
  }

  totale += costoMancanti;
  return { daPrendere, mancanti, costoMancanti, totale };
}
