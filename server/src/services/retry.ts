/**
 * Ritenta i servizi esterni con attesa crescente e rende l'ultimo errore utile. Nel
 * seed una risposta transitoria non deve perdere il lavoro gia' completato.
 */
export const TENTATIVI = 3;
const ATTESA_MS = 3000;

function pausa(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function messaggio(err: unknown): string {
  if (err instanceof Error) {
    const causa = (err as { cause?: unknown }).cause;
    if (causa instanceof Error) return `${err.message} (${causa.message})`;
    return err.message;
  }
  return String(err);
}

export async function conTentativi<T>(
  cosa: string,
  azione: () => Promise<T>,
): Promise<T> {
  let ultimoErrore: unknown = new Error(`${cosa}: nessun tentativo eseguito`);

  for (let tentativo = 1; tentativo <= TENTATIVI; tentativo++) {
    try {
      return await azione();
    } catch (err) {
      ultimoErrore = err;
      if (tentativo === TENTATIVI) break;
      const attesa = ATTESA_MS * tentativo;
      console.warn(
        `[rete] ${cosa}: tentativo ${tentativo}/${TENTATIVI} fallito ` +
          `(${messaggio(err)}). Riprovo fra ${attesa / 1000}s.`,
      );
      await pausa(attesa);
    }
  }

  console.error(
    `[rete] ${cosa}: falliti tutti e ${TENTATIVI} i tentativi. ` +
      `Ultimo errore: ${messaggio(ultimoErrore)}`,
  );
  throw ultimoErrore;
}
