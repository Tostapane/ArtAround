/**
 * Il TESTO di una descrizione: chi lo riceve e chi no.
 *
 * Il marketplace vende contenuti, quindi il testo di una descrizione a pagamento
 * non puo' viaggiare verso chi non l'ha comprata: gli elenchi ne mandavano il
 * documento intero, e bastava guardare la risposta per leggere quel che era in
 * vendita. Qui c'e' l'applicazione della regola alle tre rotte che servono testi
 * (`GET /items`, `GET /visits/:id/items`, `GET /artworks/:qid/preview`), che
 * cosi' non possono rispondere in tre modi diversi alla stessa domanda.
 *
 * **La regola in se' sta in `shared/access.ts`**, perche' la applica anche il
 * marketplace e vale solo se le due sponde ne usano una sola. Qui restano le
 * due cose che sono del server: dove si va a vedere che cosa uno ha comprato, e
 * come si toglie un testo da un documento lasciandone il resto.
 *
 * Il resto del documento (tono, durata, autore, prezzo) resta pubblico: e' quel
 * che serve per decidere se comprare, ed e' il catalogo.
 */
import { UserModel } from "./models/user";
import { isReadable as regolaDiLettura } from "../../shared/access";

export async function purchasedBy(username: string): Promise<Set<string>> {
  const owned = new Set<string>();
  if (!username) return owned;
  const accounts = await UserModel.find({ username });
  for (const a of accounts) {
    for (const id of a.collezione || []) owned.add(id);
  }
  return owned;
}

export function isReadable(
  item: any,
  username: string,
  owned: Set<string>,
): boolean {
  if (!item) return false;
  return regolaDiLettura(item, username, owned.has(item["@id"]));
}

/**
 * Il documento senza il testo, piu' `locked` per dire che manca apposta: un
 * testo vuoto e un testo tolto si distinguono solo cosi'.
 */
export function withoutText(item: any): any {
  let plain = item;
  if (item && typeof item.toObject === "function") plain = item.toObject();
  return { ...plain, text: "", locked: true };
}

export function readableItems(
  items: any[],
  username: string,
  owned: Set<string>,
): any[] {
  const out: any[] = [];
  for (const it of items) {
    if (isReadable(it, username, owned)) out.push(it);
    else out.push(withoutText(it));
  }
  return out;
}
