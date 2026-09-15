/**
 * Regola condivisa di lettura: un contenuto privato e' riservato all'autore;
 * quello pubblico e' leggibile se gratuito, proprio o posseduto. Autenticazione
 * e ricerca del possesso restano ai chiamanti.
 */
export interface ContenutoLeggibile {
  "@id": string;
  price?: number | string;
  author?: string;
  visibility?: "pubblico" | "privato";
}

export function isReadable(
  content: ContenutoLeggibile | null | undefined,
  username: string,
  posseduto: boolean,
): boolean {
  if (!content) return false;
  if (content.visibility === "privato" && content.author !== username)
    return false;
  const prezzo = Number(content.price) || 0;
  if (prezzo === 0) return true;
  if (username && content.author === username) return true;
  return posseduto;
}
