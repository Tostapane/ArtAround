/**
 * Raccoglie dai sorgenti le chiavi italiane, verifica i cataloghi e traduce quelle
 * mancanti. La radice deriva da questo file perche' deve scandire .ts e .vue e gira
 * quindi soltanto con ts-node.
 */
import "../env";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import {
  SOURCE_LANG,
  languages,
  options,
  educationalLevels,
  educationalLevelHints,
  assignedLevels,
  visitDurationBands,
} from "../../../shared/constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-3.1-flash-lite";

const ROOT = path.resolve(__dirname, "../../..");
const CATALOGS_DIR = path.join(ROOT, "shared/i18n");

const SOURCE_DIRS = [
  path.join(ROOT, "navigator/src"),
  path.join(ROOT, "marketplace/src/frontend"),
];
const SOURCE_FILES = [path.join(ROOT, "marketplace/public/index.html")];

function allSources(): string[] {
  const files: string[] = [];
  for (const dir of SOURCE_DIRS) {
    if (fs.existsSync(dir)) walkFiles(dir, files);
  }
  for (const f of SOURCE_FILES) {
    if (fs.existsSync(f)) files.push(f);
  }
  return files;
}

// ============================================================================

function keysFromSource(): string[] {
  const found = new Set<string>();

  for (const o of options) {
    found.add(o.label);
    if (o.hint) found.add(o.hint);
  }

  for (const livello of educationalLevels) found.add(livello);
  for (const livello of educationalLevels) {
    const aiuto = educationalLevelHints[livello];
    if (aiuto) found.add(aiuto);
  }

  for (const livello of assignedLevels) found.add(livello);

  for (const banda of visitDurationBands) found.add(banda.label);

  for (const file of allSources()) {
    const text = withoutComments(fs.readFileSync(file, "utf8"));
    const re = /\b(?:t|tKey)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*?)\1\s*[,)]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const key = m[2].replace(/\\(['"`])/g, "$1");
      if (key.includes("${")) {
        console.warn(`[lingue] chiave calcolata, non traducibile: ${key.slice(0, 60)}`);
        continue;
      }
      if (key.trim()) found.add(key);
    }
  }

  return [...found].sort((a, b) => a.localeCompare(b, "it"));
}

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

function strayStrings(): { file: string; text: string }[] {
  const stray: { file: string; text: string }[] = [];
  const ITALIANO = /[a-zA-ZàèéìòùÀÈÉÌÒÙ]{2,}/;

  for (const file of allSources()) {
    if (file.endsWith("i18n.ts")) continue;
    const src = fs.readFileSync(file, "utf8");

    let grezzo: string;
    if (file.endsWith(".html")) {
      grezzo = (src.match(/<body[^>]*>([\s\S]*)<\/body>/) || ["", ""])[1]!;
    } else {
      grezzo = (src.match(/<template>([\s\S]*)<\/template>/) || ["", ""])[1]!;
    }
    const tpl = grezzo
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

const GLOSSARY = `
- "tappa" = una sosta del percorso di visita davanti a un'opera; NON un tappo, non una
  frazione di gara, non una fermata di mezzi pubblici
- "opera" = un'opera d'arte esposta nel museo
- "visita" = un percorso a piedi fra piu' opere del museo. Scegli UN termine della lingua
  d'arrivo, con le sue forme di singolare e plurale, e usa quello in ogni chiave che la
  nomina: l'etichetta di un filtro e il conto dei risultati stanno uno sotto l'altro nella
  stessa schermata, e due termini diversi li' sembrano due cose diverse. La parola italiana
  non va mai lasciata com'e'
- "scheda" = il pannello che mostra la descrizione dell'opera
- "pianta" = il disegno delle sale del museo visto dall'alto
- "sala" = una stanza del museo
- "tono" = il registro in cui una descrizione e' scritta
- "curatore" = la persona che risponde del museo e del suo catalogo
- "vetrina" = la sezione dove si sfoglia quel che il museo offre, visite e descrizioni;
  e' il nome di una schermata, NON un mobile con i ripiani ne' una teca
- "libreria" = la raccolta personale di quel che si e' preso o comprato; NON un negozio
  di libri e NON una libreria di programmazione
- "Infantile" = il tono di chi racconta a un bambino, con parole semplici e affetto;
  NON vuol dire puerile, sciocco o offensivo
- "Semplice" = il tono per un adulto che dell'argomento non sa nulla
- "Medio" = il tono intermedio, per un visitatore curioso e gia' un po' informato;
  NON vuol dire mediocre o scadente
- "Avanzato" = il tono per chi la materia la conosce gia', col lessico degli studiosi
`.trim();

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
- se una stringa e' gia' comprensibile come nome proprio, lasciala.

Rispondi con un oggetto JSON che ha per chiavi ESATTAMENTE le stringhe italiane qui
sotto e per valori la traduzione. Nient'altro.

${JSON.stringify(missing, null, 1)}`;

  const answer = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  const raw = answer.text;
  if (!raw) {
    console.log(`  ${name.padEnd(12)} un blocco senza risposta, rilancia`);
    return 0;
  }

  let translated: Record<string, string>;
  try {
    translated = JSON.parse(raw);
  } catch {
    console.log(`  ${name.padEnd(12)} un blocco non e' JSON valido, rilancia`);
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

  writeCatalog(code, catalog);
  return written;
}

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
          (orphans ? `  ${orphans} orfane` : ""),
      );
    }
    const stray = strayStrings().length;
    console.log(
      `\n${stray} frasi italiane fuori dal catalogo (vedi "residui")` +
        (orphansTotal ? `\n${orphansTotal} traduzioni orfane (vedi "pota")` : ""),
    );
    return;
  }

  if (command === "pota") {
    const conferma = process.argv.includes("--conferma");

    const perLingua: { lingua: string; orfane: string[] }[] = [];
    for (const l of languages) {
      if (l.translate === SOURCE_LANG) continue;
      const c = readCatalog(l.translate);
      const orphans = Object.keys(c).filter((k) => !keys.includes(k));
      if (orphans.length > 0) perLingua.push({ lingua: l.name, orfane: orphans });
    }
    if (perLingua.length === 0) {
      console.log("Nessuna orfana.");
      return;
    }

    const distinte = new Set<string>();
    for (const r of perLingua) for (const k of r.orfane) distinte.add(k);
    console.log(`${distinte.size} chiavi orfane, in ${perLingua.length} lingue:\n`);
    for (const k of [...distinte].sort()) console.log(`  - ${k.slice(0, 90)}`);

    if (!conferma) {
      console.log(
        "\nNiente e' stato cancellato. Rileggi l'elenco: una frase che sta " +
          "ancora\na schermo, qui dentro, vuol dire che l'estrattore non la vede " +
          "non che e' morta.\nIn quel caso marcala con tKey() invece di " +
          "potarla (vedi in testa a questo file).\n\nPer procedere:  npx ts-node " +
          "src/scripts/languages.ts pota --conferma",
      );
      return;
    }

    let removed = 0;
    for (const l of languages) {
      if (l.translate === SOURCE_LANG) continue;
      const c = readCatalog(l.translate);
      const orphans = Object.keys(c).filter((k) => !keys.includes(k));
      if (orphans.length === 0) continue;
      for (const k of orphans) delete c[k];
      writeCatalog(l.translate, c);
      removed += orphans.length;
      console.log(`  ${l.name.padEnd(12)} -${orphans.length}`);
    }
    console.log(`\n${removed} traduzioni tolte.`);
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
    }
    return;
  }

  console.log("Comandi: chiavi · residui · traduci [codice] [--tutto] · pota · stato");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
