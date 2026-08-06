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

/**
 * I toni, e cosa comporta ciascuno: l'autore sceglie sulla CONSEGUENZA, non
 * sull'etichetta, quindi un tono senza la sua riga e' un tono che nessuno sa
 * quando usare.
 *
 * Per aggiungerne uno si scrive qui una riga sola, e l'ordine di questo oggetto
 * e' l'ordine in cui i toni compaiono ovunque. `educationalLevels` si ricava di
 * qui invece di essere un secondo elenco da tenere allineato: due elenchi che
 * devono coincidere, il giorno che smettono, non danno un errore ma una casella
 * vuota nell'editor e una chiave senza traduzione.
 *
 * ⚠️ Dopo averne aggiunto uno serve il giro delle traduzioni (`traduci`): il
 * tono e la sua riga sono chiavi di catalogo, raccolte da `languages.ts` proprio
 * da qui perche' nel codice si leggono come `t(v.level)` e `t(toneHints[tono])`.
 */
export const educationalLevelHints: Record<string, string> = {
  Infantile: "Per bambini: frasi brevi, immagini concrete, niente tecnicismi.",
  Semplice: "Per chi visita per la prima volta: chiaro e senza gergo.",
  Medio: "Per un pubblico curioso: contesto storico e qualche termine tecnico.",
  Avanzato: "Per chi conosce la materia: lessico specialistico e riferimenti.",
};

export const educationalLevels = Object.keys(educationalLevelHints);

/**
 * Durate di una singola descrizione usate da seed e pianificatore, in secondi.
 *
 * ⚠️ Il costo del seed e' opere x toni x durate, e ogni item e' una chiamata al
 * modello con una pausa: aggiungere una durata qui costa, sul museo piu' grande,
 * quanto un intero tono. Il conto lo stampa il seed prima di cominciare.
 */
export const secPerArt = [15, 30, 60, 120, 180];

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

/**
 * Con che diritti un autore pubblica quel che ha SCRITTO lui: il testo di una
 * descrizione, il percorso di una visita. Non riguarda le immagini delle opere,
 * che arrivano da Wikimedia con la licenza loro.
 *
 * Non sono licenze da software (MIT, GPL, Apache). Quelle sono scritte per il
 * codice sorgente -- parlano di codice oggetto, di collegamento, di
 * distribuzione dei sorgenti -- e su un testo divulgativo non dicono niente di
 * sensato; Creative Commons lo sconsiglia esplicitamente in tutt'e due i versi.
 *
 * ⚠️ La prima voce NON e' una licenza, ed e' il motivo per cui e' scritta cosi'.
 * "Tutti i diritti riservati" non e' una cosa che si concede: e' l'assenza di
 * concessione, cioe' lo stato in cui il diritto d'autore mette un'opera da se'.
 * Serviva pero' un valore dichiarabile e leggibile da una macchina, e quello
 * che il mondo dei musei usa e' `In Copyright` di RightsStatements.org, il
 * vocabolario che Europeana e DPLA hanno fatto per questo campo. Sta accanto
 * alle CC perche' e' la stessa domanda -- "che cosa posso farci?" -- e Europeana
 * le tiene infatti nello stesso campo.
 *
 * Le sei combinazioni CC 4.0 ci sono tutte: le tre condizioni sono indipendenti
 * e ognuna dice una cosa che le altre non sanno dire.
 *   BY    attribuzione, sempre presente nella 4.0
 *   SA    chi rimescola ridistribuisce con la stessa licenza
 *   NC    non commerciale
 *   ND    nessuna opera derivata: si diffonde, non si riscrive
 * Senza le tre voci ND un autore non poteva chiedere "diffondetelo, ma non
 * cambiate le mie parole", che per un testo di museo e' una richiesta comune.
 *
 * In coda CC0, che e' l'estremo opposto della prima voce: la rinuncia a tutto.
 *
 * ⚠️ Sono IDENTIFICATORI e non si traducono, come il marchio e come gli id dei
 * comandi vocali. `In Copyright` e' un nome proprio, non una frase inglese.
 */
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

/**
 * L'indirizzo canonico di ogni voce: e' li' che sta il testo che vale, e nessuno
 * dei due vocabolari e' nostro. Serve a chi vuole leggere che cosa ha davvero
 * accettato, e a un domani in cui questi dati uscissero verso Europeana, che il
 * campo lo vuole proprio come URI.
 */
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

/**
 * Il valore di chi non ne ha scelto uno: i contenuti generati dal seed e
 * qualunque scrittura che arrivi senza il campo.
 *
 * E' il piu' restrittivo di proposito. Un diritto non si cede per distrazione:
 * chi non ha detto niente non ha detto "prendete pure". Nell'altro verso il
 * danno sarebbe irreparabile, perche' una CC concessa non si revoca a chi l'ha
 * gia' ricevuta.
 */
export const DEFAULT_LICENSE = "In Copyright";

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
 *
 * ⚠️ Sta in `sessionStorage` e NON in `localStorage`, ed e' la differenza fra
 * "questa volta" e "per sempre": la lingua vale finche' la scheda resta aperta,
 * quindi ogni apertura nuova riparte in italiano. In `localStorage` una scelta
 * fatta una volta vinceva su ogni apertura successiva, anche mesi dopo, e
 * l'unico modo di tornare indietro era cancellare una chiave a mano.
 *
 * Il passaggio al navigator avviene nella stessa scheda (`location.href`),
 * quindi in produzione -- unica origine -- la scelta lo raggiunge lo stesso. In
 * sviluppo le due applicazioni stanno su due porte diverse e non se la
 * passavano nemmeno prima.
 */
export const LANG_KEY = "artaround-lang";

/**
 * La lingua con cui aprire: quella gia' SCELTA, altrimenti l'italiano.
 *
 * Solo due casi, e la sola cosa che li distingue e' se qualcuno ha scelto: si
 * apre nella lingua del progetto finche' non lo fa qualcuno, e da quel momento
 * in quella scelta, in ogni scheda e anche dopo aver chiuso il browser.
 *
 * ⚠️ Prima veniva provata anche la lingua del DISPOSITIVO (`navigator.languages`),
 * fra le due. Era pensata per la prima schermata, che si legge prima di poter
 * scegliere, ma leggeva nel pensiero: un browser configurato in inglese apriva
 * in inglese un'applicazione italiana, senza che nessuno l'avesse chiesto e
 * senza che si vedesse perche'. Il ripiego e' ora un CONTROLLO: il selettore
 * della lingua sta sulla soglia, cioe' proprio nella schermata che il ripiego
 * voleva coprire, e chi non legge l'italiano lo trova li' senza dover entrare.
 * Se un giorno quel selettore sparisse dalla soglia, questa scelta andrebbe
 * ridiscussa insieme a lui.
 *
 * La funzione non tocca la memoria: il valore glielo passa chi chiama, perche'
 * il navigator e il marketplace lo leggono in posti diversi. Serve comunque a
 * tutt'e due, perche' un codice rimasto in memoria puo' non essere piu' fra le
 * lingue configurate, e quello si scarta qui.
 */
export function pickLanguage(saved: string | null): Language {
  for (const l of languages) {
    if (l.translate === saved) return l;
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
 * Stanno qui perche' le usano TUTT'E DUE le applicazioni, e finche' erano solo
 * del marketplace le due non erano d'accordo: il navigator aveva la stessa
 * domanda scritta come catena di `if` con soglie 30 e 60, il marketplace 5 e 15,
 * quindi "visita breve" voleva dire due cose diverse nelle due meta' dello
 * stesso prodotto.
 *
 * Le tre etichette sono anche chiavi di traduzione, lette come `t(b.label)`:
 * l'estrattore raccoglie le chiavi calcolate da questo file, e altrove
 * resterebbero fuori dal catalogo senza che niente lo segnali.
 *
 * Le soglie sono tarate sul catalogo vero e non a occhio: sulle 84 visite in
 * database stanno 40 sotto la mezz'ora, 20 in mezzo e 24 oltre l'ora, cioe' le
 * tre voci restituiscono tutte qualcosa. Le soglie di prima (5 e 15) erano
 * giuste quando le visite erano nove e lunghe pochi minuti; con gli Uffizi
 * dentro, la terza voce si prendeva tutto. Rimisurare quando il catalogo
 * cambia taglia fa parte del lavoro.
 */
export const visitDurationBands: {
  value: string;
  label: string;
  test: (min: number) => boolean;
}[] = [
  { value: "breve", label: "Meno di 30 min", test: (m) => m < 30 },
  { value: "media", label: "Da 30 a 60 min", test: (m) => m >= 30 && m <= 60 },
  { value: "lunga", label: "Più di 60 min", test: (m) => m > 60 },
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
