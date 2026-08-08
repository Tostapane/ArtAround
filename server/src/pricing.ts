/**
 * Quanto costa a chi chiede prendere un contenuto.
 *
 * Il conto dipende dalla persona, perche' quel che ha gia' non si ripaga e quel
 * che e' gratuito non si paga affatto, quindi lo fa il server, che e' l'unico a
 * sapere che cosa hai. Il client lo mostra e basta: quando lo calcolava anche
 * lui, il numero scritto sul bottone e quello addebitato erano due conti
 * distinti che nessuno confrontava.
 *
 * Una funzione sola, e la usano tutte e due le strade che toccano i soldi:
 * `GET /visits` la applica a ogni visita per dire in anticipo quanto verrebbe a
 * costare, e `POST /users/:nome/buy` per addebitare. Cosi' la cifra mostrata e
 * la cifra addebitata non sono d'accordo per fortuna: sono la stessa riga.
 *
 * Non fa I/O apposta: i documenti delle tappe arrivano gia' caricati in una
 * mappa. Chi la chiama su un elenco di visite li prende tutti con una query sola
 * e conta in memoria, perche' una query per visita crescerebbe col catalogo.
 *
 * Una tappa che non esiste piu' non si compra e non si legge: conta come
 * mancante e basta.
 */
import { isReadable } from "../../shared/access";

export interface Conto {
  daPrendere: string[]; // gli id da mettere in collezione: il contenuto se non e' gia' tuo, piu' le tappe
  mancanti: number; // quante tappe mancano; una che non si risolve conta come mancante
  costoMancanti: number;
  totale: number; // le tappe mancanti piu' il contenuto stesso, se non e' gia' tuo
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
