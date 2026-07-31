/**
 * Chi puo' leggere il TESTO di una descrizione.
 *
 * Il marketplace vende contenuti, quindi il testo di una descrizione a pagamento
 * non puo' viaggiare verso chi non l'ha comprata: gli elenchi ne mandavano il
 * documento intero, e bastava guardare la risposta per leggere quel che era in
 * vendita. Qui sta la regola, una sola, perche' le tre rotte che servono testi
 * (`GET /items`, `GET /visits/:id/items`, `GET /artworks/:qid/preview`) non
 * possano rispondere in tre modi diversi alla stessa domanda.
 *
 * Si legge un testo se il contenuto e' GRATUITO, se lo si e' SCRITTO, o se lo si
 * e' COMPRATO. Il resto del documento (tono, durata, autore, prezzo) resta
 * pubblico: e' quel che serve per decidere se comprare, ed e' il catalogo.
 *
 * ⚠️ Questo e' un controllo di AUTORIZZAZIONE, non di autenticazione: il nome
 * utente arriva dalla richiesta e nessuno verifica che sia davvero suo (le
 * slide danno le password in chiaro e chiamano il login «parte marginale»).
 * Quindi difende dal vedere per sbaglio, non da chi si spaccia per un altro.
 */
import { UserModel } from "./models/user";

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
  const price = Number(item.price) || 0;
  if (price === 0) return true;
  if (username && item.author === username) return true;
  return owned.has(item["@id"]);
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
