/**
 * Regola condivisa di lettura: un contenuto e' leggibile se gratuito, proprio o
 * posseduto. Autenticazione e ricerca del possesso restano ai chiamanti.
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
