/**
 * Ritentativi per le chiamate di rete.
 *
 * Il seed fa centinaia di chiamate a Gemini e a Wikidata di fila e dura quasi
 * un'ora, e un singolo timeout di connessione, che capita, non deve costare
 * l'intera esecuzione. Qui si riprova, e solo dopo l'ultimo tentativo si lascia
 * passare l'errore, cosi' chi chiama continua a gestire il fallimento come
 * prima: questa funzione aggiunge i tentativi, non cambia chi decide che cosa
 * fare quando non c'e' piu' niente da fare.
 *
 * Si riprova su QUALSIASI errore, senza distinguere i casi transitori dagli
 * altri: distinguerli vorrebbe dire leggere la forma degli errori di due
 * librerie diverse, e sbagliare la lettura significherebbe non riprovare
 * proprio quando serve. Una richiesta malformata costa due tentativi in piu' e
 * fallisce lo stesso; un timeout di rete invece si salva.
 */

/** Quante volte si prova in tutto, primo tentativo compreso. */
export const TENTATIVI = 3;

/** L'attesa cresce a ogni tentativo: 3s, poi 6s. */
const ATTESA_MS = 3000;

function pausa(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function messaggio(err: unknown): string {
  if (err instanceof Error) {
    // I timeout di undici tengono il motivo vero dentro `cause`.
    const causa = (err as { cause?: unknown }).cause;
    if (causa instanceof Error) return `${err.message} (${causa.message})`;
    return err.message;
  }
  return String(err);
}

/**
 * Esegue `azione`, riprovando fino a TENTATIVI volte.
 * Se falliscono tutti, rilancia l'errore dell'ultimo tentativo.
 *
 * `cosa` compare nel log ed e' l'unica cosa che, a seed finito, dice DOVE la
 * rete ha fatto le bizze.
 */
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
