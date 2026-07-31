/**
 * Il quiz della visita guidata, costruito DALLE OPERE della visita.
 *
 * La slide 33 chiede che almeno una visita sincronizzata abbia "un test sensato
 * di competenza alla fine": sensato vuol dire che le domande parlano di cio' che
 * si e' appena visto, e i distrattori sono altri autori e altri stili dello
 * stesso museo — non nomi inventati. Nessuna domanda e' scritta a mano, percio'
 * la regola vale per qualunque museo si configuri in `data/museums/`.
 *
 * Se il museo non offre abbastanza autori o stili diversi per fare tre
 * distrattori, la domanda semplicemente non viene prodotta: meglio un quiz
 * corto di uno con due opzioni identiche.
 */
export type SeedQuiz = { question: string; options: string[]; correct: number };

function mescola<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copia[i];
    const b = copia[j];
    if (a !== undefined && b !== undefined) {
      copia[i] = b;
      copia[j] = a;
    }
  }
  return copia;
}

/**
 * Wikidata restituisce "Unknown" quando l'autore o lo stile non sono noti.
 * Come risposta e' una non-risposta, e come distrattore e' un regalo: si scarta.
 */
function valido(nome: unknown): nome is string {
  if (typeof nome !== "string") return false;
  const pulito = nome.trim();
  if (pulito === "") return false;
  return pulito.toLowerCase() !== "unknown";
}

/** Una domanda a quattro opzioni: la giusta piu' tre distrattori distinti. */
function domanda(
  testo: string,
  giusta: string,
  candidati: string[],
): SeedQuiz | null {
  const distrattori: string[] = [];
  for (const c of mescola(candidati)) {
    if (c === giusta) continue;
    if (distrattori.includes(c)) continue;
    distrattori.push(c);
    if (distrattori.length === 3) break;
  }
  if (distrattori.length < 3) return null;
  const opzioni = mescola([giusta, ...distrattori]);
  return { question: testo, options: opzioni, correct: opzioni.indexOf(giusta) };
}

export function costruisciQuiz(opere: any[]): SeedQuiz[] {
  const autori: string[] = [];
  const stili: string[] = [];
  for (const o of opere) {
    if (o.author && valido(o.author.name)) autori.push(o.author.name);
    if (o.style && valido(o.style.name)) stili.push(o.style.name);
  }

  const quiz: SeedQuiz[] = [];
  const scelte = mescola(opere);

  for (const opera of scelte) {
    if (quiz.length >= 1) break;
    if (!opera.author || !valido(opera.author.name)) continue;
    if (!valido(opera.name)) continue;
    const d = domanda(
      `Chi è l'autore di «${opera.name}»?`,
      opera.author.name,
      autori,
    );
    if (d) quiz.push(d);
  }

  for (const opera of scelte) {
    if (quiz.length >= 2) break;
    if (!opera.style || !valido(opera.style.name)) continue;
    if (!valido(opera.name)) continue;
    const d = domanda(
      `A quale stile appartiene «${opera.name}»?`,
      opera.style.name,
      stili,
    );
    if (d) quiz.push(d);
  }

  for (const opera of scelte) {
    if (quiz.length >= 3) break;
    if (!opera.author || !valido(opera.author.name)) continue;
    if (!valido(opera.name)) continue;
    const altre = opere
      .filter(
        (o) =>
          o.author &&
          o.author.name !== opera.author.name &&
          valido(o.name),
      )
      .map((o) => o.name);
    const d = domanda(
      `Quale di queste opere è di ${opera.author.name}?`,
      opera.name,
      altre,
    );
    if (d) quiz.push(d);
  }

  return quiz;
}
