/**
 * Costanti condivise da server, navigator e marketplace.
 *
 * I TONI sono quelli della specifica (slide 22: infantile, elementare, medio,
 * specialistico) e sono l'unico vocabolario del sistema: li usano l'editor, il
 * seed, il pianificatore delle visite su misura e tutti i filtri. Cambiarli qui
 * non ribalta da solo il database: per riallineare i documenti esistenti si usa
 * server/src/scripts/testers.ts.
 *
 * Il vocabolario controllato (`options`) e' la sorgente unica sia dei pulsanti a
 * schermo sia della mappatura dei comandi vocali. `id` e' il token canonico: i
 * gestori confrontano quello, e su quello il modello mappa le richieste libere.
 * `label` e' soltanto il testo mostrato, ed e' un campo separato perche' altrimenti
 * gli id andrebbero scritti in italiano corretto, con accenti e apostrofi, dove
 * invece devono restare stabili e facili da confrontare.
 * `surface` dice dove vive il pulsante equivalente al comando vocale, che la
 * specifica richiede sempre presente.
 */

// ============================================================================
//                             Toni e durate
// ============================================================================

export const educationalLevels = ["Infantile", "Semplice", "Medio", "Avanzato"];

/** Cosa comporta ogni tono: l'autore sceglie sulla conseguenza, non sull'etichetta. */
export const educationalLevelHints: Record<string, string> = {
  Infantile: "Per bambini: frasi brevi, immagini concrete, niente tecnicismi.",
  Semplice: "Per chi visita per la prima volta: chiaro e senza gergo.",
  Medio: "Per un pubblico curioso: contesto storico e qualche termine tecnico.",
  Avanzato: "Per chi conosce la materia: lessico specialistico e riferimenti.",
};

/** Durate di una singola descrizione usate da seed e pianificatore, in secondi. */
export const secPerArt = [15, 60];

// ============================================================================
//                            Di cosa parla un item
// ============================================================================

/**
 * I generi di soggetto: e' l'elenco della slide 21 ("movimenti culturali, stili,
 * artisti, eventi storici"). `opera` e' l'unico che il codice confronta, perche'
 * e' l'unico che sta in una sala; aggiungerne uno qui non chiede un ramo nuovo
 * da nessuna parte.
 */
export interface ItemKind {
  id: string;
  /** Risposta alla domanda "di che cosa parli?", nell'editor. */
  label: string;
  /** Il genere da solo, sulla pastiglia di un contenuto. */
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
  "Tutti i diritti riservati",
  "CC BY 4.0",
  "CC BY-SA 4.0",
  "CC BY-NC 4.0",
  "CC0 (Pubblico dominio)",
];

// ============================================================================
//                                  Lingue
// ============================================================================

export const SOURCE_LANG = "it";

/**
 * Frequenza dell'audio del comando vocale, in Hz.
 *
 * Sta qui e non nei due file che la usano perche' e' un accordo fra client e
 * server: il navigator ricampiona a questo valore (`useSTT.ts`) e il server lo
 * dichiara a Google (`services/stt.ts`), che non guarda i byte e crede a quel
 * che gli si dice. Se i due numeri divergono non arriva nessun errore, arriva
 * una trascrizione vuota.
 */
export const STT_SAMPLE_RATE = 16000;

export interface Language {
  name: string;
  translate: string;
  tts: string;
  stt: string;
}

/** Solo lingue con supporto completo: traduzione, sintesi e riconoscimento. */
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

// ============================================================================
//                          Vocabolario controllato
// ============================================================================

export interface CommandOption {
  id: string;
  label: string;
  surface: "chiedi" | "orientati" | "scheda";
  /** Aiuto per lo screen reader quando l'etichetta da sola e' ambigua. */
  hint?: string;
}

/**
 * L'id del comando che chiede la strada per la tappa successiva.
 *
 * E' esportato perche' e' l'unico comando d'orientamento la cui destinazione non
 * e' un servizio scritto sulla mappa ma un'opera della visita: chi lo riceve deve
 * riconoscerlo per risolverne il qid, e chi disegna i pulsanti per spegnerlo dove
 * una tappa successiva non c'e'. Va confrontato con questa costante e non con la
 * stringa riscritta a mano, o le due meta' smettono di essere d'accordo.
 */
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
//                                 Formato
// ============================================================================

export function labelForCommand(id: string): string {
  for (const option of options) {
    if (option.id === id) return option.label;
  }
  return id;
}

/** Regola di prodotto: all'utente non si mostrano mai i secondi grezzi. */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round((Number(totalSeconds) || 0) / 60);
  if (minutes < 1) return "meno di 1 min";
  return `${minutes} min`;
}

/**
 * Quante parole si leggono in un minuto: il cambio fra la durata di una
 * descrizione e la lunghezza del suo testo. Lo usano le due sponde per la stessa
 * cosa vista da lati opposti, il server per generare un testo che stia in N
 * secondi e il marketplace per dire a chi scrive se il suo sta nella durata che
 * ha dichiarato, quindi il numero deve essere uno solo.
 */
export const WORDS_PER_MINUTE = 100;
