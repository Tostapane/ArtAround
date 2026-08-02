/**
 * Chi puo' LEGGERE un contenuto. Una regola sola, per tutte e due le sponde.
 *
 * Si legge se il contenuto e' GRATUITO, se lo si e' SCRITTO, o se lo si e'
 * COMPRATO. Il server la applica prima di mandare un testo (`server/access.ts`),
 * il marketplace prima di dire che una tappa manca o che una descrizione va
 * comprata — e finche' erano due regole scritte due volte hanno finito col dire
 * cose diverse: il client contava le descrizioni GRATUITE fra quelle da
 * comprare, e chiedeva soldi per quel che il server regalava gia'.
 *
 * Sta in `shared/` per lo stesso motivo per cui ci stanno i tipi: e' un accordo
 * fra client e server, e un accordo scritto in due posti e' un accordo che
 * prima o poi si rompe da solo, senza che niente lo segnali.
 *
 * IL POSSESSO LO SA IL CHIAMANTE, e resta suo: il server lo cerca in un `Set`
 * costruito una volta per richiesta, il client in un array che ha gia' in
 * memoria. Passarlo come booleano tiene qui la REGOLA e li' la ricerca, senza
 * obbligare nessuno dei due a costruire la struttura dell'altro.
 *
 * ⚠️ E' AUTORIZZAZIONE, NON AUTENTICAZIONE: il nome utente arriva dalla
 * richiesta e nessuno verifica che sia davvero suo. Difende dal vedere per
 * sbaglio, non da chi scrive un altro nome.
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
