/**
 * LINGUE — i cataloghi dell'interfaccia del navigator.
 *
 * Non tocca il database: per questo non sta in `testers.ts`, che dichiara in testa
 * di essere l'utilita' che i dati esistenti li riallinea. Qui si legge il sorgente
 * e si scrivono dodici file JSON.
 *
 * IL MODELLO GIRA UNA VOLTA SOLA, QUI, e non in faccia al visitatore. Tradurre a
 * runtime darebbe la stessa frase in due modi in due caricamenti, dipenderebbe da
 * una quota che si e' gia' esaurita una volta spegnendo i comandi vocali, e non
 * lascerebbe nessun file da correggere quando una parola esce storta. L'app
 * pronuncia le proprie etichette: una parola che oscilla e' peggio di una sbagliata.
 *
 * PERCHE' IL MODELLO E NON IL SERVIZIO DI TRADUZIONE che il progetto gia' usa per i
 * contenuti: qui le stringhe sono corte e senza contesto, ed e' proprio dove una
 * traduzione automatica sbaglia. "Tappa" da sola e' un tappo, una sosta o una
 * frazione di gara; "Vetrina" e' una finestra di negozio. Al modello si passa il
 * glossario e si dice che museo e' — cosa che a `translateTexts` non si puo' dire.
 * I contenuti restano dove sono: sono DATI, crescono quando un autore pubblica e
 * non si possono enumerare prima. L'interfaccia e' PROGRAMMA, sta nel sorgente, e
 * quindi si enumera. E' quella la riga che divide le due strade, non il gusto.
 *
 * LE REVISIONI A MANO NON SI PERDONO: `traduci` riempie solo le chiavi mancanti.
 * Per rifare una traduzione si cancella quella riga dal file, o si passa `--tutto`.
 *
 * Uso:
 *   npx ts-node src/scripts/languages.ts chiavi     elenca le chiavi trovate nel sorgente
 *   npx ts-node src/scripts/languages.ts residui    le frasi italiane NON ancora avvolte in t()
 *   npx ts-node src/scripts/languages.ts traduci    riempie i buchi nei cataloghi
 *   npx ts-node src/scripts/languages.ts traduci en riempie i buchi di una lingua sola
 *   npx ts-node src/scripts/languages.ts pota       toglie le traduzioni di chiavi che non esistono piu'
 *   npx ts-node src/scripts/languages.ts stato      quante chiavi, quante tradotte, quante orfane
 */

// `./env` va importato PRIMA del client: legge il .env, e senza di lui la chiave
// arriva vuota e il modello risponde "API key should be set" a ogni richiesta.
import "../env";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { SOURCE_LANG, languages, options } from "../../../shared/constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-3.1-flash-lite";

const ROOT = path.resolve(__dirname, "../../..");
const SOURCE_DIR = path.join(ROOT, "navigator/src");
const CATALOGS_DIR = path.join(ROOT, "shared/i18n");

// ============================================================================
//                          Raccolta delle chiavi
// ============================================================================

/**
 * Le chiavi sono le stringhe passate a `t(...)`, piu' quelle del vocabolario
 * controllato. Queste ultime vanno prese a parte perche' nel codice compaiono come
 * `t(o.label)`: la chiave sta nei DATI di `shared/constants.ts`, e una scansione
 * del testo non la vedrebbe mai. E' il prezzo di una chiave calcolata, ed e' anche
 * il solo punto del navigator in cui succede.
 */
function keysFromSource(): string[] {
  const found = new Set<string>();

  for (const o of options) {
    found.add(o.label);
    if (o.hint) found.add(o.hint);
  }

  for (const file of walkFiles(SOURCE_DIR)) {
    const text = withoutComments(fs.readFileSync(file, "utf8"));
    // t("…"), t('…') o t(`…`): la chiave e' letterale, mai un'espressione — una
    // chiave calcolata qui non si potrebbe raccogliere, e resterebbe non tradotta.
    // I backtick servono nei template: `:aria-label="t(`Scheda dell'opera`)"` e'
    // l'unico modo di scrivere una stringa con un apostrofo dentro un attributo
    // gia' delimitato da virgolette doppie.
    const re = /\bt\(\s*(['"`])((?:\\.|(?!\1)[^\\])*?)\1\s*[,)]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const key = m[2].replace(/\\(['"`])/g, "$1");
      // Un backtick con dentro `${}` sarebbe una chiave che cambia a ogni
      // esecuzione: la si segnala invece di metterla in catalogo.
      if (key.includes("${")) {
        console.warn(`[lingue] chiave calcolata, non traducibile: ${key.slice(0, 60)}`);
        continue;
      }
      if (key.trim()) found.add(key);
    }
  }

  return [...found].sort((a, b) => a.localeCompare(b, "it"));
}

/**
 * Toglie i commenti prima di scandire. Non e' una pulizia: le intestazioni di
 * questo progetto spiegano il codice CITANDOLO, quindi un `t("Esci")` scritto in
 * un commento d'esempio finirebbe nei cataloghi come chiave vera — e' successo, ed
 * e' la stessa trappola in cui e' caduto lo script di rinominazione (`guidelines.md`).
 * Le stringhe vanno saltate per intero, o un apostrofo italiano dentro un commento
 * ("perche'") aprirebbe un letterale che non si chiude piu'.
 */
function withoutComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "<" && src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      out += c;
      i++;
      while (i < n && src[i] !== q) {
        if (src[i] === "\\") {
          out += src[i];
          i++;
        }
        out += src[i];
        i++;
      }
      out += q;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Le frasi italiane che nessuno ha avvolto in `t()`.
 *
 * E' il complemento dell'avviso del runtime, e i due non si sostituiscono: quello
 * dice che una chiave non ha traduzione, questo che una frase non e' MAI diventata
 * una chiave — e una stringa scritta a mano non chiede nessuna traduzione, quindi
 * il runtime non la vedra' mai. E' il modo in cui questo lavoro si sfalda quando
 * si aggiunge una schermata.
 *
 * ⚠️ Guarda solo dove finisce il testo che si VEDE: i nodi dei template, i quattro
 * attributi visibili, `announce()`, `riferisci()` e le assegnazioni a `*.value`.
 * Non e' pigrizia. Una prima versione prendeva ogni letterale italiano e riportava
 * venti risultati tutti deliberati — gli id dei comandi (`"Dove e il bagno?"`, che
 * il modello confronta), i prompt scritti per il modello e non per il visitatore,
 * i `console.error`. Un controllo che va rigiudicato a mano ogni volta non e' un
 * controllo: meglio che dica zero quando e' pulito.
 */
function strayStrings(): { file: string; text: string }[] {
  const stray: { file: string; text: string }[] = [];
  const ITALIANO = /[a-zA-ZàèéìòùÀÈÉÌÒÙ]{2,}/;

  for (const file of walkFiles(SOURCE_DIR)) {
    if (file.endsWith("i18n.ts")) continue;
    const src = fs.readFileSync(file, "utf8");

    // Le espressioni `{{ }}` si tolgono PRIMA dei tag: un `<` dentro un confronto
    // (`{{ n < 0 ? … }}`) sembrerebbe l'inizio di un tag e mangerebbe fino al primo
    // `>` utile. E il taglio dei tag salta le virgolette, o un `>` dentro un
    // attributo (`v-if="n > 0"`) spezzerebbe il tag a meta'.
    const tpl = (src.match(/<template>([\s\S]*)<\/template>/) || ["", ""])[1]!
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\{\{[\s\S]*?\}\}/g, "⟦⟧");

    for (const chunk of tpl.split(/<(?:"[^"]*"|'[^']*'|[^>])*>/)) {
      const text = chunk.replace(/⟦⟧/g, " ").replace(/\s+/g, " ").trim();
      if (text.length > 1 && ITALIANO.test(text)) {
        stray.push({ file: path.relative(ROOT, file), text });
      }
    }

    for (const attr of ["placeholder", "aria-label", "title", "alt"]) {
      const re = new RegExp(`(?<![:\\w-])${attr}\\s*=\\s*"([^"]*)"`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(tpl))) {
        const v = m[1]!.trim();
        if (v.length > 3 && /\s/.test(v) && ITALIANO.test(v)) {
          stray.push({ file: path.relative(ROOT, file), text: `${attr}="${v}"` });
        }
      }
    }

    const script = withoutComments(src.replace(/<template>[\s\S]*<\/template>/, ""));
    const visible = /(?:announce|riferisci)\(\s*(['"])|\.value\s*=\s*(['"])/g;
    let m: RegExpExecArray | null;
    while ((m = visible.exec(script))) {
      const q = m[1] || m[2]!;
      const end = script.indexOf(q, visible.lastIndex);
      if (end < 0) continue;
      const v = script.slice(visible.lastIndex, end).trim();
      if (v.length > 3 && /\s/.test(v) && ITALIANO.test(v)) {
        stray.push({ file: path.relative(ROOT, file), text: v });
      }
    }
  }
  return stray;
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, acc);
    else if (/\.(vue|ts)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

// ============================================================================
//                              Traduzione
// ============================================================================

function catalogPath(code: string): string {
  return path.join(CATALOGS_DIR, `${code}.json`);
}

function readCatalog(code: string): Record<string, string> {
  const p = catalogPath(code);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeCatalog(code: string, data: Record<string, string>) {
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(data).sort((a, b) => a.localeCompare(b, "it"))) {
    sorted[k] = data[k]!;
  }
  fs.writeFileSync(catalogPath(code), JSON.stringify(sorted, null, 2) + "\n");
}

/**
 * Il glossario e' la ragione per cui qui c'e' un modello e non un traduttore: sono
 * le parole che, prese da sole, questa applicazione le fa dire sbagliate.
 *
 * ⚠️ Le voci si SPIEGANO, non si traducono. Scrivendoci accanto una resa inglese
 * il modello la ricopia invece di cercare la parola della lingua d'arrivo: da
 * «tappa (stop)» il giapponese e' uscito ステーション, cioe' la fermata del treno.
 */
const GLOSSARY = `
- "tappa" = una sosta del percorso di visita davanti a un'opera; NON un tappo, non una
  frazione di gara, non una fermata di mezzi pubblici
- "opera" = un'opera d'arte esposta nel museo
- "visita" = un percorso a piedi fra piu' opere del museo
- "scheda" = il pannello che mostra la descrizione dell'opera
- "pianta" = il disegno delle sale del museo visto dall'alto
- "sala" = una stanza del museo
- "vetrina" = il catalog dei contenuti in vendita; NON la finestra di un negozio
- "tono" = il registro del text (infantile, semplice, medio, avanzato)
- "curatore" = la persona che risponde del museo e del suo catalog
`.trim();

/**
 * Quante chiavi per richiesta. Non e' una manopola di prestazione: con tutte e
 * duecento in un colpo la risposta sfonda il tetto dei token e arriva un JSON
 * troncato, cioe' NON VALIDO — ed e' successo su cinese, giapponese e coreano,
 * dove i valori sono piu' lunghi in token di quanto sembrino in caratteri. Il
 * blocco piccolo costa qualche richiesta in piu' e non fallisce.
 */
const PER_BATCH = 40;

async function translateLanguage(code: string, name: string, keys: string[], all: boolean) {
  const catalog = readCatalog(code);
  const missing = all ? keys : keys.filter((k) => !(k in catalog));

  if (missing.length === 0) {
    console.log(`  ${name.padEnd(12)} gia' completo (${keys.length})`);
    return;
  }

  let writtenTotal = 0;
  for (let i = 0; i < missing.length; i += PER_BATCH) {
    const batch = missing.slice(i, i + PER_BATCH);
    writtenTotal += await translateBatch(code, name, batch, catalog);
    if (i + PER_BATCH < missing.length) await new Promise((r) => setTimeout(r, 6000));
  }
  const lost = missing.length - writtenTotal;
  console.log(
    `  ${name.padEnd(12)} +${writtenTotal}` +
      (lost > 0 ? `  (${lost} non tornate, rilancia)` : ""),
  );
}

async function translateBatch(
  code: string,
  name: string,
  missing: string[],
  catalog: Record<string, string>,
): Promise<number> {
  const prompt = `Traduci dall'italiano al ${name} le stringhe dell'interfaccia di
un'applicazione museale: un'audioguida che un visitatore usa sul telefono dentro il
museo. Sono etichette di pulsanti, titoli, messaggi di stato e frasi che l'app
PRONUNCIA ad alta voce, quindi devono suonare naturali dette a voce.

Glossario, da rispettare:
${GLOSSARY}

Regole:
- mantieni i segnaposto {cosi'} identici, senza tradurne il nome;
- mantieni la punteggiatura finale e le maiuscole iniziali come nell'originale;
- un'etichetta di pulsante resta corta almeno quanto l'originale;
- non aggiungere spiegazioni: traduci e basta;
- se una stringa e' gia' comprensibile come name proprio, lasciala.

Rispondi con un oggetto JSON che ha per keys ESATTAMENTE le stringhe italiane qui
sotto e per valori la traduzione. Nient'altro.

${JSON.stringify(missing, null, 1)}`;

  const answer = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  const raw = answer.text;
  if (!raw) {
    console.log(`  ${name.padEnd(12)} un blocco senza risposta — rilancia`);
    return 0;
  }

  let translated: Record<string, string>;
  try {
    translated = JSON.parse(raw);
  } catch {
    console.log(`  ${name.padEnd(12)} un blocco non e' JSON valido — rilancia`);
    return 0;
  }

  let written = 0;
  for (const k of missing) {
    const v = translated[k];
    if (typeof v === "string" && v.trim()) {
      catalog[k] = v.trim();
      written++;
    }
  }
  // Si scrive a ogni blocco, non alla fine: un'interruzione a meta' lascia
  // tradotto quel che era gia' tornato invece di buttarlo via.
  writeCatalog(code, catalog);
  return written;
}

// ============================================================================
//                                  CLI
// ============================================================================

async function main() {
  const command = process.argv[2] || "stato";
  const argument = process.argv[3];
  const keys = keysFromSource();

  if (!fs.existsSync(CATALOGS_DIR)) fs.mkdirSync(CATALOGS_DIR, { recursive: true });

  if (command === "chiavi") {
    for (const k of keys) console.log(k);
    console.log(`\n${keys.length} chiavi`);
    return;
  }

  if (command === "residui") {
    const stray = strayStrings();
    const byFile = new Map<string, string[]>();
    for (const r of stray) {
      if (!byFile.has(r.file)) byFile.set(r.file, []);
      byFile.get(r.file)!.push(r.text);
    }
    for (const [file, texts] of [...byFile].sort()) {
      console.log(`\n${file}  (${texts.length})`);
      for (const t of texts) console.log(`   ${t.slice(0, 90)}`);
    }
    console.log(
      stray.length === 0
        ? "Nessuna frase italiana fuori dal catalogo."
        : `\n${stray.length} frasi da avvolgere in t(), in ${byFile.size} file`,
    );
    return;
  }

  if (command === "stato") {
    console.log(`Chiavi nel sorgente: ${keys.length}\n`);
    let orphansTotal = 0;
    for (const l of languages) {
      if (l.translate === SOURCE_LANG) continue;
      const c = readCatalog(l.translate);
      const present = keys.filter((k) => k in c).length;
      const orphans = Object.keys(c).filter((k) => !keys.includes(k)).length;
      orphansTotal += orphans;
      const bar = "█".repeat(Math.round((present / Math.max(keys.length, 1)) * 20));
      console.log(
        `  ${l.name.padEnd(12)} ${String(present).padStart(4)}/${keys.length} ${bar}` +
          (orphans ? `  ${orphans} orphans` : ""),
      );
    }
    const stray = strayStrings().length;
    console.log(
      `\n${stray} frasi italiane stray dal catalog (vedi "residui")` +
        (orphansTotal ? `\n${orphansTotal} traduzioni orphans (vedi "pota")` : ""),
    );
    return;
  }

  /**
   * Toglie dai cataloghi le traduzioni di chiavi che nel sorgente non esistono
   * piu'. Non e' pulizia estetica: una chiave orfana e' una frase che qualcuno ha
   * riscritto, e lasciarla fa credere a `stato` che il lavoro sia piu' avanti di
   * quanto sia. Si stampa quel che si toglie, perche' cancellare in silenzio una
   * traduzione corretta a mano sarebbe il modo peggiore di risparmiare righe.
   */
  if (command === "pota") {
    let removed = 0;
    for (const l of languages) {
      if (l.translate === SOURCE_LANG) continue;
      const c = readCatalog(l.translate);
      const orphans = Object.keys(c).filter((k) => !keys.includes(k));
      if (orphans.length === 0) continue;
      for (const k of orphans) delete c[k];
      writeCatalog(l.translate, c);
      removed += orphans.length;
      console.log(`  ${l.name.padEnd(12)} −${orphans.length}`);
      for (const k of orphans) console.log(`      ${k.slice(0, 70)}`);
    }
    console.log(removed === 0 ? "Nessuna orfana." : `\n${removed} traduzioni tolte.`);
    return;
  }

  if (command === "traduci") {
    const all = process.argv.includes("--tutto");
    const targets = languages.filter((l) => {
      if (l.translate === SOURCE_LANG) return false;
      if (argument && !argument.startsWith("--")) return l.translate === argument;
      return true;
    });
    if (targets.length === 0) {
      console.log(`Nessuna lingua "${argument}". Codici: ` +
        languages.filter((l) => l.translate !== SOURCE_LANG).map((l) => l.translate).join(" "));
      return;
    }
    console.log(`${keys.length} chiavi, ${targets.length} lingue\n`);
    for (const l of targets) {
      await translateLanguage(l.translate, l.name, keys, all);
      // Le pause del seed esistono per la stessa ragione: la quota gratuita si
      // esaurisce, e quando succede ogni richiesta seguente spende i suoi
      // ritentativi senza produrre niente.
      await new Promise((r) => setTimeout(r, 6000));
    }
    return;
  }

  console.log("Comandi: chiavi · residui · traduci [codice] [--tutto] · pota · stato");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
