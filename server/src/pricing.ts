/**
 * Calcola sul server il costo ancora dovuto per item o visita. Non fa I/O: elenco e
 * acquisto condividono lo stesso conto senza introdurre una query per visita.
 */
import { isReadable } from "../../shared/access";

export interface Conto {
  daPrendere: string[];
  mancanti: number;
  costoMancanti: number;
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
