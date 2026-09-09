/**
 * Vocabolari condivisi: toni, durate, licenze, lingue, comandi e schermate. Gli
 * identificatori restano stabili e non tradotti; cambiare toni o chiavi persistite
 * richiede una migrazione dei dati.
 */
// ============================================================================

export const educationalLevelHints: Record<string, string> = {
  Infantile: "Per bambini: frasi brevi, immagini concrete, niente tecnicismi.",
  Semplice: "Per chi visita per la prima volta: chiaro e senza gergo.",
  Medio: "Per un pubblico curioso: contesto storico e qualche termine tecnico.",
  Avanzato: "Per chi conosce la materia: lessico specialistico e riferimenti.",
};

export const educationalLevels = Object.keys(educationalLevelHints);

export const priceByTone: Record<string, number> = {
  Infantile: 0,
  Semplice: 0,
  Medio: 0.15,
  Avanzato: 0.25,
};

export function priceForTone(tone: string): number {
  const prezzo = priceByTone[tone];
  if (typeof prezzo !== "number") return 0;
  return prezzo;
}

export const secPerArt = [15, 30, 60, 120, 180];

// ============================================================================

export interface ItemKind {
  id: string;
  label: string;
  name: string;
}

export const itemKinds: ItemKind[] = [
  { id: "opera", label: "Un'opera del museo", name: "Opera" },
  { id: "stile", label: "Uno stile", name: "Stile" },
  { id: "movimento", label: "Un movimento culturale", name: "Movimento" },
  { id: "artista", label: "Un artista", name: "Artista" },
  { id: "periodo", label: "Un periodo storico", name: "Periodo" },
  { id: "evento", label: "Un evento storico", name: "Evento" },
];

export function kindById(id: string): ItemKind | null {
  for (const k of itemKinds) {
    if (k.id === id) return k;
  }
  return null;
}

export const licenses = [
  "In Copyright",
  "CC BY 4.0",
  "CC BY-SA 4.0",
  "CC BY-NC 4.0",
  "CC BY-ND 4.0",
  "CC BY-NC-SA 4.0",
  "CC BY-NC-ND 4.0",
  "CC0 1.0",
];

export const licenseUri: Record<string, string> = {
  "In Copyright": "http://rightsstatements.org/vocab/InC/1.0/",
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC BY-NC 4.0": "https://creativecommons.org/licenses/by-nc/4.0/",
  "CC BY-ND 4.0": "https://creativecommons.org/licenses/by-nd/4.0/",
  "CC BY-NC-SA 4.0": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  "CC BY-NC-ND 4.0": "https://creativecommons.org/licenses/by-nc-nd/4.0/",
  "CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
};

export const DEFAULT_LICENSE = "In Copyright";

// ============================================================================

export const SOURCE_LANG = "it";

export const STT_SAMPLE_RATE = 16000;

export interface Language {
  name: string;
  translate: string;
  tts: string;
  stt: string;
}

export const languages: Language[] = [
  { name: "Italiano", translate: "it", tts: "it-IT", stt: "it-IT" },
  { name: "English", translate: "en", tts: "en-US", stt: "en-US" },
  { name: "Français", translate: "fr", tts: "fr-FR", stt: "fr-FR" },
  { name: "Español", translate: "es", tts: "es-ES", stt: "es-ES" },
  { name: "Deutsch", translate: "de", tts: "de-DE", stt: "de-DE" },
  { name: "Português", translate: "pt", tts: "pt-BR", stt: "pt-BR" },
  { name: "中文", translate: "zh-CN", tts: "cmn-CN", stt: "cmn-Hans-CN" },
  { name: "日本語", translate: "ja", tts: "ja-JP", stt: "ja-JP" },
  { name: "한국어", translate: "ko", tts: "ko-KR", stt: "ko-KR" },
  { name: "Русский", translate: "ru", tts: "ru-RU", stt: "ru-RU" },
  { name: "Nederlands", translate: "nl", tts: "nl-NL", stt: "nl-NL" },
  { name: "Polski", translate: "pl", tts: "pl-PL", stt: "pl-PL" },
  { name: "Türkçe", translate: "tr", tts: "tr-TR", stt: "tr-TR" },
];

export const LANG_KEY = "artaround-lang";

export const THEME_KEY = "artaround-theme";

export const SESSION_KEY = "artaround-sessione";

export function pickLanguage(saved: string | null): Language {
  for (const l of languages) {
    if (l.translate === saved) return l;
  }
  const prima = languages[0];
  if (!prima) throw new Error("Nessuna lingua configurata");
  return prima;
}

// ============================================================================

const CARTELLA_OPERE = "/images/artworks/";

export function percorsoMiniatura(figura: string): string {
  if (!figura.startsWith(CARTELLA_OPERE)) return figura;
  const punto = figura.lastIndexOf(".");
  if (punto < 0) return figura;
  return `${figura.slice(0, punto)}-c${figura.slice(punto)}`;
}

// ============================================================================

export interface CommandOption {
  id: string;
  label: string;
  surface: "chiedi" | "orientati" | "scheda";
  hint?: string;
}

export const NEXT_STOP_COMMAND = "Dove e la prossima tappa?";

export const options: CommandOption[] = [
  { id: "Leggi", label: "Leggi", surface: "scheda" },
  { id: "Ferma lettura", label: "Ferma lettura", surface: "scheda" },
  { id: "Prossimo", label: "Prossimo", surface: "scheda" },
  { id: "Precedente", label: "Precedente", surface: "scheda" },

  {
    id: "Approfondisci",
    label: "Dimmi di più",
    surface: "chiedi",
    hint: "Racconta l'opera più in profondità",
  },
  {
    id: "Sintetizza",
    label: "Dimmi di meno",
    surface: "chiedi",
    hint: "Riassumi in poche parole",
  },
  {
    id: "Non ho capito",
    label: "Non ho capito",
    surface: "chiedi",
    hint: "Rispiega con parole diverse",
  },
  {
    id: "Semplifica",
    label: "Più semplice",
    surface: "chiedi",
    hint: "Spiega in modo più semplice",
  },
  { id: "Chi e' l'autore?", label: "Chi è l'autore?", surface: "chiedi" },
  { id: "Che stile e?", label: "Che stile è?", surface: "chiedi" },

  {
    id: NEXT_STOP_COMMAND,
    label: "Dov'è la prossima tappa?",
    surface: "orientati",
    hint: "Indicazioni per raggiungere l'opera della tappa successiva",
  },
  { id: "Dove esco?", label: "Dove esco?", surface: "orientati" },
  { id: "Dove e il bagno?", label: "Dov'è il bagno?", surface: "orientati" },
  { id: "Dove e il bar?", label: "Dov'è il bar?", surface: "orientati" },
  { id: "Dove e lo shop?", label: "Dov'è lo shop?", surface: "orientati" },
  {
    id: "Ci sono ostacoli?",
    label: "Ci sono ostacoli?",
    surface: "orientati",
    hint: "Segnala scalini, porte e oggetti nella sala",
  },
];

// ============================================================================

export function labelForCommand(id: string): string {
  for (const option of options) {
    if (option.id === id) return option.label;
  }
  return id;
}

export const CUSTOM_LEVEL = "Personalizzata";
export const AI_LEVEL = "Su misura";
export const assignedLevels = [CUSTOM_LEVEL, AI_LEVEL];

export const visitDurationBands: {
  value: string;
  label: string;
  test: (min: number) => boolean;
}[] = [
  { value: "breve", label: "Meno di 30 min", test: (m) => m < 30 },
  { value: "media", label: "Da 30 a 60 min", test: (m) => m >= 30 && m <= 60 },
  { value: "lunga", label: "Più di 60 min", test: (m) => m > 60 },
];

export function durationMinutes(totalSeconds: number): number {
  return Math.round((Number(totalSeconds) || 0) / 60);
}

export function formatDuration(totalSeconds: number): string {
  const minutes = durationMinutes(totalSeconds);
  if (minutes < 1) return "meno di 1 min";
  return `${minutes} min`;
}

export const WORDS_PER_MINUTE = 100;

export const MAX_VISITE_VISITATORE = 5;

// ============================================================================

export const marketplaceViews = [
  "soglia",
  "accedi",
  "registrati",
  "musei",
  "home",
  "vetrina",
  "opera",
  "visita",
  "libreria",
  "componi",
  "sumisura",
  "nuovo",
  "lavori",
  "vendite",
  "gestione",
  "catalogo",
] as const;

export const marketplaceLegacyViews = ["visite", "opere"] as const;

// ============================================================================

export const SEED_AUTHOR = "Museo";

export const SEED_ID_TOKEN = "sistema";
