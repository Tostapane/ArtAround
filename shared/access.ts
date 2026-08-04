/**
 * Chi puo' leggere un contenuto. Una regola sola, per tutte e due le sponde.
 *
 * Si legge se il contenuto e' gratuito, se lo si e' scritto, o se lo si e'
 * comprato. La applica il server prima di mandare un testo (`server/access.ts`)
 * e il marketplace prima di dire che una tappa manca o che una descrizione va
 * comprata. Sta in `shared/` per lo stesso motivo per cui ci stanno i tipi: e' un
 * accordo fra client e server, e un accordo scritto in due posti si rompe da
 * solo senza che niente lo segnali.
 *
 * Il possesso lo risolve chi chiama e resta suo: il server lo cerca in un `Set`
 * costruito una volta per richiesta, il client in un array che ha gia' in
 * memoria. Passarlo come booleano tiene qui la regola e li' la ricerca, senza
 * obbligare nessuno dei due a costruire la struttura dell'altro.
 *
 * E' autorizzazione e non autenticazione: da' per buono il nome che riceve. Di
 * chi sia davvero lo stabilisce la sessione, prima che si arrivi qui.
 */

export interface ContenutoLeggibile {
  "@id": string;
  price?: number | string;
  author?: string;
}

export function isReadable(
  content: ContenutoLeggibile | null | undefined,
  username: string,
  posseduto: boolean,
): boolean {
  if (!content) return false;
  const prezzo = Number(content.price) || 0;
  if (prezzo === 0) return true;
  if (username && content.author === username) return true;
  return posseduto;
}
