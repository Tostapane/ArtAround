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

/**
 * Dove resta scritta la lingua scelta.
 *
 * La chiave sta qui perche' le due applicazioni devono leggerla e scriverla
 * uguale: sceglierla nel marketplace e ritrovarla nel navigator e' una scelta
 * sola, non due. Scritta in tutt'e due i file, prima o poi ne diventa due.
 */
export const LANG_KEY = "artaround-lang";

/**
 * La lingua con cui aprire: quella gia' scelta, poi quella del dispositivo,
 * poi l'italiano.
 *
 * Serve perche' la prima schermata si legge PRIMA di poter scegliere: aprendo
 * sempre in italiano, a un visitatore cinese si chiede di riconoscere la frase
 * «Lingua dei contenuti» per arrivare a 中文. Il suo dispositivo quella
 * risposta ce l'ha gia'.
 *
 * `preferite` sono le lingue del dispositivo in ordine di gradimento
 * (`navigator.languages`). Si prova prima il codice intero e poi la sola
 * radice, perche' un dispositivo dice `en-GB` o `pt-PT` dove il nostro elenco
 * ha `en` e `pt`, e all'incontrario dice `zh` dove noi abbiamo solo `zh-CN`.
 * Una radice che porta a piu' lingue prende la prima dell'elenco.
 *
 * La funzione non tocca la memoria e non guarda il dispositivo da se': i due
 * valori glieli passa chi chiama. Cosi' la stessa regola vale nel navigator e
 * nel marketplace, che quei due valori li prendono in posti diversi.
 *
 * Quella del dispositivo NON si salva: e' un ripiego, non una scelta, e
 * scrivendola le due cose diventerebbero indistinguibili.
 */
export function pickLanguage(
  saved: string | null,
  preferite: readonly string[],
): Language {
  for (const l of languages) {
    if (l.translate === saved) return l;
  }
  for (const p of preferite) {
    if (!p) continue;
    const codice = p.toLowerCase();
    for (const l of languages) {
      if (l.translate.toLowerCase() === codice) return l;
    }
    const radice = codice.split("-")[0];
    for (const l of languages) {
      if (l.translate.toLowerCase().split("-")[0] === radice) return l;
    }
  }
  const prima = languages[0];
  if (!prima) throw new Error("Nessuna lingua configurata");
  return prima;
}

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

/**
 * I due livelli che non sceglie nessun autore: li assegna il server a una visita
 * composta a mano e a una nata da una frase. Stanno accanto ai toni perche' sono
 * la stessa cosa vista da chi legge — un valore che il database conserva in
 * italiano e che a schermo si traduce — e stanno qui, e non nella rotta che li
 * scrive, perche' l'estrattore raccoglie da questo file le chiavi che nel codice
 * si leggono come `t(v.level)`.
 */
export const CUSTOM_LEVEL = "Personalizzata";
export const AI_LEVEL = "Su misura";
export const assignedLevels = [CUSTOM_LEVEL, AI_LEVEL];

/**
 * Le fasce di durata con cui si filtrano le visite: etichetta e prova nella
 * stessa riga, cosi' non possono dire due cose diverse. Sono minuti di LETTURA,
 * che e' quel che `Visit.duration` somma; quando contera' anche il cammino fra
 * le sale, i tre numeri qui vanno rialzati e non serve toccare altro.
 *
 * Stanno qui e non nel marketplace, che e' il solo a usarle, perche' le tre
 * etichette sono chiavi di traduzione lette come `t(b.label)`: l'estrattore
 * raccoglie le chiavi calcolate da questo file, e altrove resterebbero fuori
 * dal catalogo senza che niente lo segnali.
 */
export const visitDurationBands: {
  value: string;
  label: string;
  test: (min: number) => boolean;
}[] = [
  { value: "corta", label: "meno di 5 min", test: (m) => m < 5 },
  { value: "media", label: "da 5 a 15 min", test: (m) => m >= 5 && m <= 15 },
  { value: "lunga", label: "oltre 15 min", test: (m) => m > 15 },
];

/** I minuti che si mostrano: l'arrotondamento sta qui e non in chi disegna. */
export function durationMinutes(totalSeconds: number): number {
  return Math.round((Number(totalSeconds) || 0) / 60);
}

/**
 * Regola di prodotto: all'utente non si mostrano mai i secondi grezzi.
 * Risponde in italiano, quindi la usa chi non ha una lingua da rispettare: gli
 * script del server. Le due applicazioni compongono la stessa frase con le
 * proprie chiavi di traduzione, perche' "min" non e' "min" in tredici lingue.
 */
export function formatDuration(totalSeconds: number): string {
  const minutes = durationMinutes(totalSeconds);
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
