/**
 * Il deposito: l'unico stato del marketplace, piu' i metodi che i binding Alpine
 * chiamano. Quel che serve per leggerlo:
 *
 *  1. la navigazione e' un router su percorsi veri (`/vetrina`, non `#/vetrina`).
 *     `view` dice quale schermata e' attiva e la decide l'indirizzo, non un
 *     click, quindi il tasto "indietro" funziona e un ricaricamento non perde il
 *     posto. Le finestre modali sono riservate alle conferme.
 *     Il prezzo di quei percorsi e' che il server deve rimandare il guscio per
 *     ognuno — l'elenco delle schermate sta in `shared/constants.ts` proprio
 *     perche' lo leggono in due — e che i click sui collegamenti interni vanno
 *     intercettati, o il browser ricarica invece di cambiare schermata;
 *  2. ruolo e museo arrivano prima dei dati, perche' il catalogo si scarica per
 *     museo (`initApp`);
 *  3. la vetrina e' un elenco solo con dentro visite e opere, quindi una serie
 *     sola di ricerca e filtri: due copie tornerebbero a divergere. Il livello di
 *     una visita si legge dai toni delle sue tappe, non da `Visit.level`, che per
 *     una visita composta a mano dice "Personalizzata";
 *  4. i ruoli sono tre ma le diramazioni sono scritte `role === "autore" ? …`,
 *     col visitatore nel ramo altrimenti: un ruolo nuovo ci cade dentro senza
 *     che nulla protesti, quindi va nominato dove conta.
 *
 * L'ordine di `draft.tappe` e' l'ancoraggio delle note logistiche: il server non
 * riceve una posizione, la ricava percorrendo `percorso` e legando ogni nota alla
 * tappa che la precede. Ricostruire un percorso nell'ordine sbagliato non e'
 * quindi un difetto di visualizzazione: al primo salvataggio la nota si riancora.
 *
 * Nel catalogo del curatore la durata e' in secondi esatti e non in
 * `formatDuration()`: le descrizioni sono uniche per (opera, autore, tono,
 * DURATA), e i minuti arrotondati renderebbero due righe indistinguibili.
 */

import {
  UserRole,
  Content,
  Item,
  Visit,
  Artwork,
  Museum,
  isItem,
  isVisit,
  isArtwork,
} from "../../../shared/types.js";
import {
  licenses,
  licenseUri,
  DEFAULT_LICENSE,
  educationalLevels,
  educationalLevelHints,
  durationMinutes,
  visitDurationBands,
  secPerArt,
  itemKinds,
  kindById,
  languages,
  percorsoMiniatura,
  SOURCE_LANG,
  WORDS_PER_MINUTE,
  marketplaceViews,
  marketplaceLegacyViews,
} from "../../../shared/constants.js";
import { isReadable } from "../../../shared/access.js";
import {
  linguaIniziale,
  preparaLingua,
  salvaLingua,
  traduci,
} from "./i18n.js";
import {
  ArtAPI,
  clearToken,
  hasToken,
  onSessionExpired,
  setToken,
} from "./api.js";



/** Cio' su cui valgono gli aiutanti comuni (cercare, dire di che museo e', il tono). */
export type Catalogabile = Content | Artwork;

/**
 * Riga della tabella del catalogo del curatore.
 *
 * `kind` dice CHE COSA e' la riga, e sono tre cose diverse: l'opera (la
 * Gioconda), la descrizione che ne parla, la visita che la mette in fila. La
 * colonna "autore" vuol dire due cose a seconda della riga, ed e' voluto: di
 * un'opera interessa chi l'ha dipinta, di una descrizione chi l'ha scritta.
 */
export interface CatalogRow {
  kind: "opera" | "item" | "visita";
  id: string;
  name: string;
  author: string;
  tone: string;
  duration: number;
  price: number;
  privato?: boolean;
  guidata?: boolean;
  /** Solo per le opere: il codice Wikidata e quante descrizioni ne parlano. */
  qid?: string;
  descrizioni?: number;
  raw: any;
}

/** Cosa sparirebbe eliminando una descrizione: risposta di GET /items/:id/impact. */
export interface ImpactReport {
  id: string;
  author: string;
  educationalLevel: string;
  visite: { id: string; name: string; author: string | null; guidata: boolean }[];
  adozioni: number;
}

/** Quadro d'insieme del museo: risposta di GET /museums/:qid/overview. */
export interface MuseumOverview {
  conteggi: {
    opere: number;
    item: number;
    itemPrivati: number;
    visite: number;
    visiteGuidate: number;
  };
  copertura: {
    opereTotali: number;
    senzaDescrizione: { qid: string; name: string }[];
    perTono: { tono: string; opere: number }[];
  };
  account: { autori: number; visitatori: number; curatori: number };
}

export interface SaleRow {
  id: string;
  type: string;
  name: string;
  ofMuseum?: string;
  educationalLevel?: string;
  price: number;
  license: string;
  adozioni: number;
  ricavo: number;
}

/**
 * Il soggetto di un gruppo del catalogo. Uno stile o un periodo non sono un
 * documento del database: portano solo quel che l'item ne dice. `kind` ce l'hanno
 * loro e nessun altro, quindi e' anche il modo di distinguerli da un'opera.
 */
export interface Soggetto {
  "@id": string;
  qid: string;
  name: string;
  imagePath?: string;
  imageUri?: string;
  kind?: string;
  author?: { name: string; qid: string };
  style?: { name: string; qid: string };
}

export interface ArtworkGroup {
  artwork: Soggetto;
  items: Item[];
}

/**
 * Le schermate. Si RICAVANO dall'elenco condiviso invece di essere riscritte
 * qui: quell'elenco lo legge anche il server, per sapere a quali indirizzi deve
 * rimandare il guscio, e due elenchi da tenere allineati a mano il giorno che
 * divergono non danno un errore ma una schermata che si apre cliccandola e da'
 * 404 ricaricandola. Aggiungerne una si fa in `shared/constants.ts`, e da li'
 * arriva sia il tipo sia la rotta.
 *
 * `avvio` sta invece qui perche' non e' un indirizzo: finche' `start()` non ha
 * risposto non si sa che schermata sia — c'e' un biglietto in sessionStorage da
 * spendere — e finche' non si sa niente si disegna niente. Senza questo stato la
 * soglia comparirebbe per un istante a ogni ricaricamento per poi saltare alla
 * home, cioe' direbbe "non sei entrato" a chi e' entrato.
 */
export type View = "avvio" | (typeof marketplaceViews)[number];

/**
 * I contenuti per `@id`: descrizioni del museo, propri e visite.
 *
 * Sta FUORI dallo stato, ed e' la parte da sapere. Quel che Alpine rende
 * reattivo viaggia dentro un Proxy, e questa mappa si consulta migliaia di volte
 * per ogni disegnata della vetrina: una tappa per visita, per ogni visita
 * dell'elenco, a ogni filtro che cambia. Fuori dallo stato una lettura resta una
 * lettura, e nessuno si mette in ascolto di una mappa che si rifa' intera.
 *
 * Cercare a ogni chiamata scorrendo gli elenchi costa quanto il catalogo, non
 * quanto la risposta: alla Galleria degli Uffizi sono 832 descrizioni per 36
 * visite, e la scelta del museo passava otto secondi qui dentro.
 */
const indiceContenuti = new Map<string, Content>();

export class AppState {
  // --- Rotta corrente -------------------------------------------------------
  view: View = "avvio";
  param: string = ""; 

  currentUser: string | null = null;
  currentUserRole: UserRole | null = null;

  announcement: string = "";

  // --- Ricerca e filtri -----------------------------------------------------
  marketSearch: string = "";
  marketType: "tutti" | "visite" | "opere" | "meta" = "tutti";
  marketLevelFilter: string = "tutti";
  marketDurationFilter: string = "tutti";

  librarySearch: string = "";
  libraryTypeFilter: "tutti" | "item" | "visite" = "tutti";

  worksSearch: string = "";
  worksTypeFilter: "tutti" | "item" | "visite" = "tutti";

  catalogSearch: string = "";
  /**
   * Che cosa elencare: le OPERE (la Gioconda), le DESCRIZIONI che ne parlano,
   * le VISITE. Prima "Opere" elencava le descrizioni delle opere, cioe' venti
   * righe con lo stesso titolo e nessuna riga per l'opera: il curatore non
   * poteva vedere il proprio catalogo di opere da qui.
   */
  catalogTypeFilter: "tutti" | "opere" | "descrizioni" | "visite" = "tutti";
  /**
   * Di che cosa parla la descrizione: di un'opera, oppure di un soggetto del
   * museo (un autore, uno stile, un movimento). E' l'asse `kind` degli item, e
   * ha senso solo dove ci sono descrizioni in tabella.
   */
  catalogSubjectFilter: "tutti" | "opera" | "meta" = "tutti";
  catalogToneFilter: string = "tutti";
  catalogDurationFilter: string = "tutti";
  catalogAuthorFilter: string = "tutti";

  editorSearch: string = "";
  editorFilter: "tutti" | "disponibili" | "da_acquistare" = "tutti";

  // --- Visita su misura -----------------------------------------------------
  customRequest: string = "";

  // --- Visita guidata (studente) --------------------------------------------
  passkeyInput: string = "";
  guidedSession: { id: string; visitName: string } | null = null;

  // --- Portafoglio e possesso ----------------------------------------------
  wallet: number = 0;
  userCollection: string[] = [];

  // --- Conferme (l'unica finestra modale rimasta) ---------------------------
  confirmOpen: boolean = false;
  itemToBuy: Content | null = null;
  visitToComplete: Visit | null = null;
  visitToDelete: Visit | null = null;
  /** Il museo di cui si sta per svuotare il catalogo (solo curatore). */
  museoToWipe: Museum | null = null;
  /** Il qid scritto dal curatore per aggiungere un'opera, e l'opera che sta togliendo. */
  nuovaOperaQid = "";
  aggiungendoOpera = false;
  operaToDelete: any = null;
  operaImpact: any = null;
  /**
   * Che fare delle visite che contengono quel che si sta togliendo. E' una
   * scelta di curatela, non una conseguenza tecnica: accorciarle lascia in piedi
   * il percorso di qualcun altro, eliminarle lo butta via. Si riparte sempre
   * dall'opzione che distrugge meno.
   */
  visiteScelta: "accorcia" | "elimina" = "accorcia";
  itemToDelete: CatalogRow | null = null;
  itemImpact: ImpactReport | null = null;

  // --- Notifiche ------------------------------------------------------------
  toast: { messaggio: string; tipo: "success" | "error" } | null = null;
  private toastTimer: any = null;

  // --- Dati -----------------------------------------------------------------
  visits: Visit[] = []; 
  marketItems: Item[] = []; 
  myItems: Item[] = []; 
  availableArtworks: Artwork[] = [];
  museums: Museum[] = [];
  selectedMuseum: Museum | null = null;
  sales: SaleRow[] = [];
  loading: boolean = false;

  // --- Gestione del museo -------------------------------------------------------------
  overview: MuseumOverview | null = null;
  curatedItems: Item[] = [];

  private navigatorOrigin: string = "";

  /**
   * La lingua dell'interfaccia. E' una proprieta' dello stato, non una variabile
   * di modulo, perche' `t()` la legge a ogni chiamata: leggerla dentro un
   * binding di Alpine registra la dipendenza, e cambiarla ridisegna da se' tutto
   * quel che e' tradotto. Fuori dallo stato Alpine non se ne accorgerebbe.
   *
   * PARTE DALL'ITALIANO ANCHE QUANDO NON E' LA LINGUA SCELTA, e la vera si
   * assegna in `start()` quando il catalogo e' arrivato. Alpine costruisce tutte
   * le viste all'avvio — sono `x-show`, quindi stanno nel documento anche da
   * nascoste — e ogni legame si valuta li' una volta sola: se la lingua fosse
   * gia' quella giusta, il catalogo arriverebbe quando non c'e' piu' niente da
   * invalidare, e la pagina resterebbe in italiano fino al legame successivo che
   * cambia per conto suo. E' l'assegnazione a ridisegnare, quindi deve venire
   * dopo l'attesa.
   */
  lingua: string = SOURCE_LANG;

  /**
   * Se `i18next` e' in piedi. Si legge dentro `t()` per la sua REATTIVITA', e
   * copre il buco che l'assegnazione di `lingua` lascia scoperto: quando la
   * lingua scelta e' l'italiano, `start()` le riassegna il valore che ha gia' e
   * Alpine non ridisegna niente, perche' non e' cambiato niente.
   *
   * Finche' e' falsa `traduci` restituisce la chiave cosi' com'e', segnaposto
   * compresi, ed e' la condizione in cui Alpine costruisce TUTTE le viste — la
   * prima passata avviene mentre `start()` e' fermo sul suo primo `await`. In
   * italiano non si nota, perche' le chiavi sono le frasi italiane; si nota
   * dove la chiave ha un segnaposto, e infatti a schermo restavano
   * `Percorso ({n})` e `{n} tappe`.
   */
  catalogoPronto = false;
  lingueDisponibili = languages;

  licenseOptions: string[] = licenses;
  tones: string[] = educationalLevels;
  toneHints: Record<string, string> = educationalLevelHints;

  // --- Editor ---------------------------------------------------------------
  editingId: string | null = null;
  visitStep: "percorso" | "impostazioni" | "quiz" = "percorso";
  editorPane: "percorso" | "libreria" = "percorso";
  draft = this.emptyDraft();

  loginForm = { username: "", password: "" };
  registerForm = {
    username: "",
    password: "",
    conferma: "",
    role: "visitatore" as UserRole,
  };
  roleChoice: UserRole[] | null = null;

  /**
   * L'indirizzo in schermata piu' parametro, oppure `null` se quell'indirizzo
   * non e' del marketplace.
   *
   * Il `null` non e' un caso d'errore ma la domanda che serve altrove: chi
   * intercetta i click deve sapere se un collegamento e' una schermata (da
   * aprire qui, senza ricaricare) o un indirizzo qualsiasi dello stesso sito
   * — il foglio dei QR sotto `/api`, un'immagine — che va lasciato al browser.
   * Chi applica la rotta ripiega invece sulla soglia, che e' dove finisce un
   * indirizzo scritto a mano che non esiste.
   */
  private parsePath(
    percorso: string,
  ): { view: View; param: string; tipo: string } | null {
    const raw = percorso.replace(/^\/+/, "");
    const head = raw.split("/")[0] || "";
    const tail = raw.split("/").slice(1).join("/");
    let param = "";
    // Un `%` isolato nell'indirizzo fa lanciare decodeURIComponent, e da li' non
    // si riprende: si perderebbe la pagina invece del solo parametro.
    try {
      param = decodeURIComponent(tail || "");
    } catch {
      param = tail || "";
    }
    for (const candidate of marketplaceViews) {
      if (head === candidate) return { view: candidate, param, tipo: "" };
    }
    for (const vecchio of marketplaceLegacyViews) {
      if (head === vecchio)
        return { view: "vetrina", param: "", tipo: vecchio };
    }
    if (head === "") return { view: "soglia", param: "", tipo: "" };
    return null;
  }

  /** Se un indirizzo dello stesso sito e' una schermata del marketplace. */
  knownRoute(percorso: string): boolean {
    return this.parsePath(percorso) !== null;
  }

  applyRoute() {
    const letta = this.parsePath(window.location.pathname);
    const { view, param, tipo } = letta || {
      view: "soglia" as View,
      param: "",
      tipo: "",
    };
    if (tipo === "visite" || tipo === "opere") this.marketType = tipo;
    const pubbliche: View[] = ["soglia", "accedi", "registrati"];

    if (!this.currentUser) {
      this.view = pubbliche.includes(view) ? view : "soglia";
      this.param = "";
      this.announceView();
      return;
    }
    if (!this.selectedMuseum) {
      this.view = "musei";
      this.param = "";
      this.announceView();
      return;
    }
    if (pubbliche.includes(view)) {
      this.redirectTo(this.roleHome());
      return;
    }
    // La visita su misura NON si salva: vive il tempo in cui la si cammina, e
    // per questo e' una strada da visitatore. Un autore apre il compositore per
    // pubblicare, quindi quella schermata gli prometterebbe un contenuto che non
    // resta. Nascondere il solo invito non basterebbe: l'indirizzo si scrive a
    // mano, e chi ci arriva scoprirebbe la cosa dopo aver camminato.
    // Il curatore non e' nominato perche' oggi non ha nessuna strada per
    // arrivarci: il giorno che ne avesse una, la regola e' la stessa.
    if (view === "sumisura" && this.currentUserRole === "autore") {
      this.redirectTo(this.roleHome());
      return;
    }
    const cambiata = this.view !== view || this.param !== param;
    this.view = view;
    this.param = param;
    if (cambiata) this.inCima();
    this.announceView();
  }

  /**
   * Ogni schermata comincia dall'alto.
   *
   * Senza, il browser tiene lo scorrimento della schermata precedente: aprendo
   * un'opera dal fondo di un elenco lungo la sua pagina si apriva a meta', o
   * oltre la fine, e sembrava vuota. Il guscio non e' un documento che scorre
   * ma una vista che si sostituisce, quindi lo scorrimento non e' suo e va
   * riportato a zero a mano.
   *
   * Si riporta la finestra E il contenitore del contenuto: sotto `lg` scorre la
   * pagina, da `lg` in su scorre il <main>, e riportarne uno solo lascia
   * l'altro dov'era a seconda della larghezza.
   */
  private inCima() {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    const main = document.getElementById("contenuto");
    if (main) main.scrollTop = 0;
  }

  /**
   * Cambia indirizzo senza ricaricare la pagina.
   *
   * `pushState` NON emette nessun evento: al contrario del vecchio indirizzo a
   * frammento, dove bastava scrivere `location.hash` e ci pensava `hashchange`,
   * qui la rotta va applicata a mano subito dopo. Scordarsene non da' errore —
   * l'indirizzo nella barra cambia e la schermata resta quella di prima.
   *
   * `popstate` invece arriva da se' quando il browser torna indietro o avanti,
   * ed e' il solo caso in cui l'indirizzo cambia senza passare di qui.
   */
  private navigate(percorso: string, sostituendo: boolean) {
    if (window.location.pathname !== percorso) {
      if (sostituendo) window.history.replaceState(null, "", percorso);
      else window.history.pushState(null, "", percorso);
    }
    this.applyRoute();
  }

  /** Dove ha chiesto di andare chi guarda: una tappa in piu' nella cronologia. */
  goTo(view: View, param?: string) {
    if (param) this.navigate(`/${view}/${encodeURIComponent(param)}`, false);
    else this.navigate(`/${view}`, false);
  }

  /**
   * Dove lo si manda quando ha chiesto una schermata che non puo' avere: senza
   * museo scelto, o dentro una strada che il suo ruolo non percorre.
   *
   * Sostituisce la tappa invece di aggiungerne una, perche' una correzione non
   * e' un posto in cui si e' stati. Aggiungendola, il tasto "indietro"
   * riporterebbe all'indirizzo appena rifiutato, che rimanda di nuovo qui: si
   * torna indietro e non si torna indietro, e l'unico modo di uscire e' chiudere
   * la scheda.
   */
  redirectTo(view: View) {
    this.navigate(`/${view}`, true);
  }

  /**
   * Se sono montati il binario e il <main>. Soglia, accesso e registrazione sono
   * schermate a se': non hanno ne' l'uno ne' l'altro, e i due collegamenti di
   * salto vanno nascosti li' insieme a quello che dovrebbero scavalcare.
   */
  guscioMontato(): boolean {
    if (!this.currentUser) return false;
    if (this.view === "soglia") return false;
    if (this.view === "accedi") return false;
    if (this.view === "registrati") return false;
    return true;
  }

  roleHome(): View {
    if (this.currentUserRole === "curatore") return "gestione";
    if (this.currentUserRole === "autore") return "lavori";
    return "home";
  }

  goHome() {
    this.goTo(this.roleHome());
  }

  /**
   * Il nome della schermata: finisce nel titolo della pagina e nella regione
   * viva, quindi e' quel che sente chi non guarda. Tradotto come tutto il resto
   * dell'interfaccia: `residui` di qui non passa — guarda i template, non gli
   * script — e una schermata che si annuncia in italiano dentro un'app cinese
   * non risulterebbe mai «mancante».
   */
  viewLabel(): string {
    const labels: Record<View, string> = {
      avvio: "ArtAround",
      soglia: "ArtAround",
      accedi: this.t("Accedi"),
      registrati: this.t("Crea un profilo"),
      musei: this.t("Scegli il museo"),
      home: this.t("Home"),
      vetrina: this.t("Vetrina"),
      opera: this.t("Scheda dell'opera"),
      visita: this.t("Scheda della visita"),
      libreria: this.t("La mia libreria"),
      componi: this.editingId
        ? this.t("Modifica la visita")
        : this.t("Componi una visita"),
      sumisura: this.t("Visita su misura"),
      nuovo: this.editingId
        ? this.t("Modifica la descrizione")
        : this.t("Nuova descrizione"),
      lavori: this.t("I miei contenuti"),
      vendite: this.t("Vendite e adozioni"),
      gestione: this.t("Gestione del museo"),
      catalogo: this.t("Catalogo del museo"),
    };
    return labels[this.view] || "";
  }

  private announceView() {
    document.title = `${this.viewLabel()} · ArtAround`;
    this.announce(this.viewLabel());
  }

  announce(testo: string) {
    this.announcement = "";
    window.requestAnimationFrame(() => {
      this.announcement = testo;
    });
  }

  /**
   * Traduce, ed e' il metodo che i template chiamano. Il catalogo dell'italiano
   * non esiste, quindi in italiano la chiave stessa e' il messaggio.
   */
  t(chiave: string, parametri?: Record<string, unknown>): string {
    // Prima che `i18next` sia in piedi la chiave e' gia' quel che `traduci`
    // risponderebbe. La si legge qui perche' cosi' il legame DIPENDE da
    // `catalogoPronto`, e quando diventa vera Alpine ridisegna: vedi il campo.
    if (!this.catalogoPronto) return chiave;
    return traduci(chiave, this.lingua, parametri);
  }

  /**
   * Aspetta un fotogramma DIPINTO. Si usa alle due estremita' di ogni attesa, e
   * per due motivi diversi.
   *
   * In coda: si spegne l'attesa dopo che la schermata nuova e' a schermo, non
   * appena i dati sono arrivati. Fra le due cose c'e' il pezzo piu' lungo di
   * tutta l'apertura: assegnare il catalogo fa ridisegnare Alpine, e per la
   * Galleria degli Uffizi vuol dire costruire ventimila nodi in un compito solo
   * — misurati 17,8 s con la CPU rallentata di quattro. Spegnendo l'attesa
   * prima, il velo sparisce all'inizio di quel compito: lo schermo resta quello
   * di prima per dei secondi, e poi salta alla schermata nuova.
   *
   * In testa: si aspetta prima di cominciare il lavoro. Il marchio dell'attesa
   * si muove sul COMPOSITORE, che e' un altro filo e continua a girare anche
   * mentre questo e' occupato — ma solo se il filo principale ha fatto in tempo
   * a consegnarglielo, cioe' se ha dipinto almeno un fotogramma col velo a
   * schermo. Accendere il velo e occupare il filo nello stesso compito lascia
   * l'animazione ferma al primo fotogramma per tutta l'attesa, e alla fine
   * salta di colpo al punto in cui il suo orologio e' arrivato. Misurato
   * bloccando il filo per 3 s: senza il fotogramma in mezzo il compositore ne
   * disegna ZERO, con il fotogramma ne disegna 104.
   *
   * Due fotogrammi e non uno: il primo scatta PRIMA del disegno, il secondo
   * quando il disegno e' passato.
   */
  private afterPaint(): Promise<void> {
    return new Promise((risolvi) => {
      requestAnimationFrame(() => requestAnimationFrame(() => risolvi()));
    });
  }

  async cambiaLingua(codice: string) {
    await preparaLingua(codice);
    this.catalogoPronto = true;
    salvaLingua(codice);
    this.lingua = codice;
    document.documentElement.lang = codice;
  }

  /**
   * I click sui collegamenti interni, presi al volo prima che il browser
   * ricarichi la pagina.
   *
   * Con gli indirizzi a frammento non serviva: `#/vetrina` non e' una pagina
   * diversa, quindi il browser non andava da nessuna parte e restava tutto in
   * piedi da solo. `/vetrina` invece e' una pagina vera, e un click ci porta
   * davvero: il server rimanda lo stesso guscio, ma l'applicazione riparte da
   * zero e ogni schermata si paga il catalogo daccapo. Da qui l'ascoltatore
   * unico sul documento, che scavalca la navigazione e cambia rotta a mano.
   *
   * Quello che NON deve toccare, ed e' il grosso del corpo:
   *  - i tasti speciali e il tasto centrale, o "apri in una nuova scheda"
   *    smette di aprire una scheda e apre la schermata al posto di quella;
   *  - `target` e `download`, che dicono esplicitamente di non restare qui —
   *    il foglio dei QR del curatore e' fra questi;
   *  - i frammenti veri: i due salti d'accessibilita' (`#contenuto`,
   *    `#binario`) e i richiami alle icone SVG cominciano per `#`, non per `/`;
   *  - qualunque indirizzo che non sia una schermata, `/api/...` compreso:
   *    lo riconosce `knownRoute`, e se non e' nostro lo si lascia al browser.
   */
  private interceptClicks() {
    document.addEventListener("click", (evento: MouseEvent) => {
      if (evento.defaultPrevented) return;
      if (evento.button !== 0) return;
      if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey)
        return;
      const partenza = evento.target as Element | null;
      if (!partenza || typeof partenza.closest !== "function") return;
      const collegamento = partenza.closest("a");
      if (!collegamento || !(collegamento instanceof HTMLAnchorElement)) return;
      if (collegamento.hasAttribute("download")) return;
      const bersaglio = collegamento.getAttribute("target");
      if (bersaglio && bersaglio !== "_self") return;
      const href = collegamento.getAttribute("href") || "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      const indirizzo = new URL(collegamento.href, window.location.origin);
      if (indirizzo.origin !== window.location.origin) return;
      if (!this.knownRoute(indirizzo.pathname)) return;
      evento.preventDefault();
      this.navigate(indirizzo.pathname, false);
    });
  }

  async start() {
    window.addEventListener("popstate", () => this.applyRoute());
    this.interceptClicks();
    // La lingua si assegna dopo aver aspettato il catalogo, e non prima: il
    // motivo sta sul campo `lingua`. Finche' si aspetta non c'e' niente a
    // schermo, perche' `view` vale ancora "avvio".
    const scelta = linguaIniziale();
    await preparaLingua(scelta);
    this.catalogoPronto = true;
    this.lingua = scelta;
    document.documentElement.lang = scelta;
    onSessionExpired(() => this.sessionLost());
    try {
      const cfg = await ArtAPI.fetchConfig();
      this.navigatorOrigin = cfg.navigatorOrigin || "";
    } catch {
      this.navigatorOrigin = "";
    }
    await this.resumeSession();
    this.applyRoute();
  }

  /**
   * Il biglietto sopravvive al ricaricamento e all'andata e ritorno verso il
   * navigator, nella stessa scheda, mentre il resto dello stato no. Portafoglio
   * e collezione non si ricordano ma si rileggono, perche' fra un
   * caricamento e l'altro puo' esserci stato un acquisto.
   */
  private async resumeSession() {
    if (!hasToken()) return;
    try {
      await this.enterAs(await ArtAPI.fetchMe());
    } catch {
      clearToken();
    }
  }

  private sessionLost() {
    this.resetToThreshold();
    this.showToast("La sessione è scaduta: entra di nuovo.", "error");
  }

  /**
   * L'ordine conta: prima si RISOLVE il museo, poi si scarica. Il catalogo si
   * chiede per museo (`?museum=`), quindi sapere quale museo e' scelto e'
   * precondizione dello scaricamento, non una conseguenza. Per lo stesso motivo
   * cambiare museo deve ricaricare: vedi `selectMuseum`.
   */
  async initApp() {
    this.loading = true;
    await this.afterPaint(); // il velo va DIPINTO prima: vedi `afterPaint`
    try {
      this.museums = await ArtAPI.fetchMuseums();

      // IL MUSEO SI SCEGLIE A OGNI INGRESSO, e non si ricorda. Stava in
      // `localStorage`, che e' di tutta l'ORIGINE e non della scheda: aprendo il
      // marketplace in una seconda scheda ci si ritrovava dentro il museo scelto
      // nella prima, senza che nessuno l'avesse chiesto in quella. Ricordarlo
      // nella scheda non basterebbe: la scelta del museo e' la prima domanda che
      // le slide vogliono (pannello a scelta multipla, slide 20), e una risposta
      // data ieri non e' la risposta di oggi.
      //
      // Un museo solo resta l'unico caso in cui non si chiede: li' non c'e'
      // niente da scegliere, e una schermata con una carta sola non e' una
      // domanda.
      if (!this.selectedMuseum && this.museums.length === 1) {
        this.selectedMuseum = this.museums[0];
      }
      // Prima del catalogo, non dopo: chi sta andando nell'app da museo esce da
      // qui, e il catalogo di un museo grande sono secondi spesi per una
      // schermata che non vedra'.
      if (await this.goToNavigatorIfAsked()) return;
      if (this.selectedMuseum) await this.loadCatalogue();

      this.redirectTo(this.selectedMuseum ? this.roleHome() : "musei");
      // Il velo resta finche' la schermata non e' davvero a schermo: vedi
      // `afterPaint`.
      await this.afterPaint();
    } catch (e) {
      console.error("Errore durante l'inizializzazione dei dati:", e);
      this.showToast(
        "Non riesco a contattare il server. Controlla che sia avviato e riprova.",
        "error",
      );
    } finally {
      this.loading = false;
    }
  }

  /**
   * Scarica il catalogo del museo scelto e solo quello, senza i testi delle
   * descrizioni, che arrivano un'opera alla volta quando qualcuno la apre
   * (`caricaTesti`). In un museo grande i testi sono circa tre quarti del peso
   * del catalogo, e all'ingresso non se ne legge nessuno.
   *
   * Le quattro richieste partono insieme perche' nessuna dipende dalla risposta
   * di un'altra: in fila costano quattro andate e ritorni invece di una, e su
   * una rete vera l'attesa e' quasi tutta li'. L'unico legame e' `withArtwork`,
   * che ricuce le opere dentro le descrizioni, e per questo si applica dopo che
   * sono arrivate entrambe.
   */
  private async loadCatalogue() {
    if (!this.selectedMuseum) return;
    const qid = this.selectedMuseum.qid;

    const mieiInArrivo =
      this.currentUser && this.currentUserRole === "autore"
        ? ArtAPI.fetchMyItems(this.currentUser)
        : Promise.resolve([] as Item[]);

    // Le opere arrivano nell'ordine di percorrenza dichiarato sulla mappa
    // (`data-flow`): riordinarle per nome vorrebbe dire comporre visite a zig zag.
    const [opere, visite, metadati, soggetti, miei] = await Promise.all([
      ArtAPI.fetchArtworks(qid),
      ArtAPI.fetchVisite(qid),
      ArtAPI.fetchItemsMetadata(qid),
      ArtAPI.fetchMuseumTopics(qid),
      mieiInArrivo,
    ]);

    this.availableArtworks = opere;
    this.visits = visite;
    this.marketItems = this.withArtwork(metadati);
    this.artworksWithText = [];
    this.museumTopics = soggetti;
    this.myItems = miei;
    this.reindicizza();
    if (this.currentUserRole === "curatore") await this.loadMuseumState();
  }

  /**
   * Rimette dentro ogni descrizione l'opera che descrive.
   *
   * `GET /items/metadata` manda `about` come semplice id, per non ripetere la
   * stessa opera dentro tutte e otto le sue descrizioni. Le opere pero' ci sono
   * gia', quindi si ricuce qui: da questo punto in poi una descrizione ha la
   * forma di sempre, e raggruppamento, ricerca e filtri non si accorgono di
   * niente.
   */
  private withArtwork(items: Item[]): Item[] {
    const perId = new Map<string, Artwork>();
    for (const a of this.availableArtworks) perId.set(a["@id"], a);
    for (const it of items) {
      if (typeof it.about === "string") {
        const art = perId.get(it.about);
        if (art) it.about = art;
      }
    }
    return items;
  }

  async login() {
    const { username, password } = this.loginForm;
    if (!username || !password)
      return this.showToast("Inserisci username e password.", "error");
    // L'attesa comincia da qui e non da `initApp`: fra il tocco su Accedi e la
    // risposta del server c'e' una richiesta di rete, e in laboratorio non e'
    // istantanea. Senza segno, la schermata sembra non aver ricevuto il tocco.
    this.loading = true;
    await this.afterPaint(); // il velo va DIPINTO prima: vedi `afterPaint`
    try {
      const esito = await ArtAPI.login(username, password);
      if ((esito as any).scelta) {
        this.roleChoice = (esito as any).ruoli as UserRole[];
        return;
      }
      await this.enterAs(esito as any);
    } catch (e) {
      this.showToast((e as Error).message, "error");
    } finally {
      this.loading = false;
    }
  }

  async confirmRole(role: UserRole) {
    try {
      const u = await ArtAPI.login(
        this.loginForm.username,
        this.loginForm.password,
        role,
      );
      this.roleChoice = null;
      await this.enterAs(u as any);
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }
  }

  private async enterAs(u: {
    username: string;
    role: UserRole;
    wallet?: number;
    collezione: string[];
    token?: string;
  }) {
    if (u.token) setToken(u.token);
    this.currentUser = u.username;
    this.currentUserRole = u.role;
    this.wallet = typeof u.wallet === "number" ? u.wallet : 0;
    this.userCollection = u.collezione || [];
    this.loginForm = { username: "", password: "" };
    await this.initApp();
  }

  async register() {
    const { username, password, conferma, role } = this.registerForm;
    if (!username || !password)
      return this.showToast("Compila username e password.", "error");
    if (password !== conferma)
      return this.showToast("Le due password non coincidono.", "error");
    try {
      const u = await ArtAPI.register(username, password, role);
      this.registerForm = {
        username: "",
        password: "",
        conferma: "",
        role: "visitatore",
      };
      await this.enterAs(u as any);
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }
  }

  /** Uscire: la sessione si chiude anche sul server, non solo qui. */
  async logout() {
    await ArtAPI.logout();
    clearToken();
    this.resetToThreshold();
  }

  /**
   * Lo stato di chi non e' entrato. Separato da `logout` perche' ci si arriva
   * anche senza averlo chiesto: quando il server dice che la sessione e' scaduta
   * non c'e' piu' niente da chiudere, e richiamarlo direbbe una bugia.
   */
  private resetToThreshold() {
    this.currentUser = null;
    this.currentUserRole = null;
    this.wallet = 0;
    this.userCollection = [];
    this.visits = [];
    this.marketItems = [];
    this.artworksWithText = [];
    this.myItems = [];
    this.reindicizza();
    this.museums = [];
    this.selectedMuseum = null;
    this.sales = [];
    this.editingId = null;
    this.roleChoice = null;
    // La porta scelta vale per l'ingresso in corso: chi esce torna sulla soglia
    // e la sceglie di nuovo.
    this.entryTarget = "marketplace";
    this.guidedSession = null;
    this.passkeyInput = "";
    this.customRequest = "";
    this.marketSearch = "";
    this.librarySearch = "";
    this.worksSearch = "";
    this.editorSearch = "";
    this.marketType = "tutti";
    this.marketLevelFilter = "tutti";
    this.marketDurationFilter = "tutti";
    this.libraryTypeFilter = "tutti";
    this.worksTypeFilter = "tutti";
    this.editorFilter = "tutti";
    this.draft = this.emptyDraft();
    this.goTo("soglia");
  }

  private museumEntityId(): string | null {
    return this.selectedMuseum
      ? `http://www.wikidata.org/entity/${this.selectedMuseum.qid}`
      : null;
  }

  private belongsToMuseum(c: Catalogabile): boolean {
    const museo = this.museumEntityId();
    if (!museo) return false;
    return c.ofMuseum === museo;
  }

  async selectMuseum(m: Museum) {
    this.selectedMuseum = m;
    // Chi e' entrato per l'app da museo passa di qui solo perche' il museo
    // mancava: appena c'e', se ne va. Il catalogo non gli serve.
    if (await this.goToNavigatorIfAsked()) return;
    this.loading = true;
    await this.afterPaint(); // il velo va DIPINTO prima: vedi `afterPaint`
    try {
      await this.loadCatalogue();
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }
    // `goTo` PRIMA di spegnere l'attesa: e' il cambio di vista a far costruire
    // ad Alpine le tessere del museo nuovo, ed e' quello che si deve aspettare.
    this.goTo(this.roleHome());
    await this.afterPaint();
    this.loading = false;
  }

  changeMuseum() {
    this.goTo("musei");
  }

  museumSummary(m: Museum): string {
    const opere = typeof m.opere === "number" ? m.opere : 0;
    const visite = typeof m.visite === "number" ? m.visite : 0;
    const conta = [
      opere === 1 ? this.t("1 opera") : this.t("{n} opere", { n: opere }),
      visite === 1 ? this.t("1 visita") : this.t("{n} visite", { n: visite }),
    ];
    return conta.join(" · ");
  }

  museumArtworks() {
    return this.availableArtworks.filter((a) => this.belongsToMuseum(a));
  }

  contentName(c: Catalogabile): string {
    if (isVisit(c)) return c.name || "";
    if (isArtwork(c)) return c.name || "";
    const art = c.about;
    if (typeof art === "object" && art) return art.name || "";
    return c.subject || "";
  }

  private normalizeSearch(s: string): string {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  private searchableFields(c: Catalogabile): string {
    const parts: string[] = [this.contentName(c)];
    if (isVisit(c)) {
      parts.push(c.author || "");
      parts.push(c.level || "");
    } else if (isArtwork(c)) {
      parts.push((c.author && c.author.name) || "");
      parts.push((c.style && c.style.name) || "");
    } else {
      parts.push(c.author || "");
      parts.push(c.educationalLevel || "");
      const art = c.about;
      if (art && typeof art === "object") {
        parts.push(
          art.name || "",
          (art.author && art.author.name) || "",
          (art.style && art.style.name) || "",
        );
      }
    }
    return this.normalizeSearch(parts.join(" "));
  }

  private matchesSearch(c: Catalogabile, query: string): boolean {
    const q = this.normalizeSearch(query);
    if (!q) return true;
    const haystack = this.searchableFields(c);
    const compatto = haystack.replace(/ /g, "");
    return q
      .split(" ")
      .every((tok) => !tok || haystack.includes(tok) || compatto.includes(tok));
  }

  private levelOf(c: Catalogabile): string {
    if (isVisit(c)) return c.level || "";
    if (isArtwork(c)) return "";
    return c.educationalLevel || "";
  }

  availableLevels(): string[] {
    const present = new Set<string>();
    for (const c of [
      ...this.marketItems,
      ...this.myItems,
      ...this.visits,
    ] as any[]) {
      if (!this.belongsToMuseum(c)) continue;
      const d = this.levelOf(c);
      if (d) present.add(d);
    }
    return educationalLevels.filter((l) => present.has(l));
  }

  inLibrary(item: Content | null): boolean {
    if (!item) return false;
    if (this.currentUserRole === "autore" && item.author === this.currentUser)
      return true;
    if (
      this.currentUserRole === "visitatore" &&
      (item as any)["@type"] === "ItemList" &&
      item.author === this.currentUser
    )
      return true;
    return this.userCollection.includes(item["@id"]);
  }

  /**
   * Il portafoglio esiste solo sul visitatore: autore e curatore non comprano, e
   * offrirglielo li mandava contro un 404 che parlava di un visitatore.
   */
  canBuy(): boolean {
    return this.currentUserRole === "visitatore";
  }

  /** Perche' una visita che si possiede non si puo' ancora percorrere. */
  missingItemsNote(): string {
    const v = this.currentVisit();
    if (!v) return "";
    const quante = this.mancantiDi(v);
    if (quante === 0) return "";
    if (this.canBuy()) {
      return "Per usare questa visita servono anche i contenuti che la compongono.";
    }
    return (
      `Contiene ${quante} descrizioni a pagamento di altri autori. Si comprano ` +
      `da un profilo visitatore: il portafoglio sta li', non sul profilo autore.`
    );
  }

  /**
   * Se un contenuto si mostra a chi sta guardando. Due motivi per nasconderlo,
   * e per tutt'e due l'eccezione e' la stessa: chi l'ha scritto lo vede sempre.
   *
   *  - la PAROLA CHIAVE: una visita guidata si apre digitandone il nome, non
   *    trovandola in vetrina;
   *  - il PRIVATO: l'itinerario che un visitatore compone per se'. Il server
   *    non lo manda nemmeno (`GET /visits`), quindi qui il caso che resta e'
   *    il proprio — che nella libreria deve continuare a vedersi, ed e' il
   *    motivo per cui questa non e' una semplice esclusione.
   */
  private visibleInMarket(c: any): boolean {
    if (!c) return true;
    if (c.accessKey) return c.author === this.currentUser;
    if (c.visibility === "privato") return c.author === this.currentUser;
    return true;
  }

  async buy(item: Content) {
    if (!this.currentUser || this.inLibrary(item)) return;
    if ((item as any).accessKey) return;
    // Si chiede conferma quando c'e' da pagare, e a dirlo e' il conto vero: una
    // visita gratis puo' contenere tappe a pagamento, e prenderla in silenzio
    // svuoterebbe il portafoglio senza che nessuno l'abbia detto.
    if (this.costoDi(item) === 0) {
      await this.performPurchase(item);
      return;
    }
    this.itemToBuy = item;
    this.confirmOpen = true;
  }

  private async performPurchase(item: Content) {
    if (!this.currentUser) return;
    try {
      const u = await ArtAPI.buy(item["@id"]);
      this.wallet = typeof u.wallet === "number" ? u.wallet : 0;
      this.userCollection = u.collezione;
      // Il testo di quest'opera puo' essere gia' stato chiesto quando ancora non
      // si aveva diritto a leggerlo, e in quel caso e' arrivato vuoto: si
      // dimentica di averlo chiesto, cosi' la prossima apertura lo riprende.
      if (isItem(item) && item.about && typeof item.about === "object") {
        const qid = item.about.qid;
        const i = this.artworksWithText.indexOf(qid);
        if (i >= 0) this.artworksWithText.splice(i, 1);
      }
      // I conti delle visite sono del server e ora sono vecchi di un acquisto:
      // si rileggono invece di aggiustarli qui, che sarebbe rifare quel conto.
      await this.reloadVisits();
      const nome = this.contentName(item) || "Contenuto";
      this.showToast(`"${nome}" è ora nella tua libreria.`);
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }
  }

  /**
   * Quanto costa prendere questo contenuto adesso. Non lo calcola il client: per
   * una visita il numero arriva dal server (`totale`, che tiene conto di quel
   * che gia' possiedi), per una descrizione e' il suo prezzo e basta.
   */
  costoDi(content: any): number {
    if (!content) return 0;
    if (typeof content.totale === "number") return content.totale;
    return Number(content.price) || 0;
  }

  /**
   * Il prezzo scritto su una visita.
   *
   * Non e' `price`: quello e' il prezzo della visita in se', e una visita del
   * catalogo ce l'ha a zero pur essendo fatta di tappe a pagamento. Chi guarda
   * vuole sapere quanto gli costa usarla adesso, cioe' `totale`, che il server
   * calcola sulla sua collezione ed e' la stessa cifra del bottone di sblocco e
   * dell'addebito.
   *
   * Una volta che la visita e' tua, pero', il prezzo non e' piu' l'informazione:
   * `costoDi` scende a zero perche' non resta niente da pagare, e senza questo
   * controllo la riga direbbe "Gratis", che qui significherebbe due cose
   * diverse. "Gratis" resta quindi solo per cio' che non costa e non si ha
   * ancora; quel che si e' preso lo dice il possesso. E chi l'ha scritta non
   * l'ha comprata: dirle "Acquistato" sarebbe falso.
   *
   * Le due etichette non sono intercambiabili e non vanno unite: "Acquistato"
   * dice come la visita e' entrata nella tua libreria, "Pubblicata da te" dice
   * che l'hai scritta tu. Un autore la sua visita non l'ha comprata, e un
   * visitatore che ne ha comprata una non l'ha pubblicata.
   */
  visitPrice(v: any): string {
    if (this.inLibrary(v)) {
      if (v && v.author && v.author === this.currentUser)
        return this.t("Pubblicata da te");
      return this.t("Acquistato");
    }
    return this.readablePrice(this.costoDi(v));
  }

  /** Quante tappe mancano, secondo il server. Zero se il conto non e' arrivato. */
  mancantiDi(content: any): number {
    if (!content || typeof content.mancanti !== "number") return 0;
    return content.mancanti;
  }

  async reloadVisits() {
    const qid = this.selectedMuseum ? this.selectedMuseum.qid : "";
    if (!qid) return;
    this.visits = await ArtAPI.fetchVisite(qid);
    this.reindicizza();
  }

  /** L'etichetta dello sblocco nella striscia Riprendi. */
  unlockVisitLabel(v: any): string {
    return `Sblocca (€ ${(Number(v.costoMancanti) || 0).toFixed(2)})`;
  }

  visitUsable(visit: any): boolean {
    return this.inLibrary(visit) && this.mancantiDi(visit) === 0;
  }

  openCompleteVisit(visit: any) {
    if (!this.currentUser || this.mancantiDi(visit) === 0) return;
    this.visitToComplete = visit;
    this.confirmOpen = true;
  }

  openDeleteVisit(visit: any) {
    if (!visit || visit.author !== this.currentUser) return;
    this.visitToDelete = visit;
    this.confirmOpen = true;
  }

  confirmTitle(): string {
    if (this.museoToWipe)
      return this.t("Svuotare il catalogo di {museo}?", {
        museo: this.museoToWipe.name,
      });
    if (this.operaToDelete)
      return this.t("Rimuovere {opera} dal catalogo?", {
        opera: this.operaToDelete.name,
      });
    if (this.itemToDelete) return "Eliminare questa descrizione?";
    if (this.visitToDelete) return "Eliminare questa visita?";
    if (this.visitToComplete) return "Sbloccare i contenuti mancanti?";
    return "Confermi l'acquisto?";
  }

  confirmMessage(): string {
    // Il conto sta gia' sullo schermo del curatore: la conferma ripete quel che
    // sparisce, perche' e' l'unica occasione in cui lo si legge prima e non dopo.
    if (this.museoToWipe) {
      if (!this.overview) return this.t("Sto calcolando che cosa comporta…");
      const c = this.overview.conteggi;
      return this.t(
        "Spariranno {opere} opere, {item} descrizioni e {visite} visite di {museo}, " +
          "e con esse le righe nelle librerie di chi le aveva prese. Le immagini " +
          "delle opere restano sul disco. L'operazione non è reversibile.",
        {
          opere: c.opere,
          item: c.item,
          visite: c.visite,
          museo: this.museoToWipe.name,
        },
      );
    }
    if (this.operaToDelete) {
      if (!this.operaImpact) return this.t("Sto calcolando che cosa comporta…");
      const i = this.operaImpact;
      const visite = i.visite || [];
      let testo = this.t(
        '"{opera}" sparirà dal catalogo con le sue {n} descrizioni',
        { opera: i.nome, n: i.descrizioni },
      );
      if (visite.length > 0) {
        testo += this.t(", ed è una tappa di {n} visite ({nomi})", {
          n: visite.length,
          nomi: this.elencoVisite(visite),
        });
      }
      testo += ". ";
      if (i.adozioni > 0) {
        testo += this.t(
          "Spariranno anche dalle librerie di {n} persone, senza rimborso. ",
          { n: i.adozioni },
        );
      }
      return testo + this.t("L'operazione non è reversibile.");
    }
    if (this.itemToDelete) {
      if (!this.itemImpact) return "Sto calcolando che cosa comporta…";
      const visite = this.itemImpact.visite || [];
      const adozioni = this.itemImpact.adozioni || 0;

      let testo = `"${this.itemToDelete.name}" sparirà dal catalogo`;
      if (visite.length > 0) {
        const quali =
          visite.length === 1
            ? "una visita"
            : `${visite.length} visite`;
        testo += `, ed è una tappa di ${quali} (${this.elencoVisite(visite)})`;
      }
      testo += ". ";
      if (adozioni > 0) {
        const chi = adozioni === 1 ? "1 persona" : `${adozioni} persone`;
        testo += `Sparirà anche dalla libreria di ${chi}, senza rimborso. `;
      }
      return testo + "L'operazione non è reversibile.";
    }
    if (this.visitToDelete) {
      return `"${this.visitToDelete.name}" sparirà dal marketplace e dalle librerie di chi l'ha adottata. L'operazione non è reversibile.`;
    }
    if (this.visitToComplete) {
      const v = this.visitToComplete;
      return `Per usare questa visita servono ${this.mancantiDi(v)} contenuti che non hai ancora. Sbloccarli tutti costa € ${(v.costoMancanti || 0).toFixed(2)}.`;
    }
    const item = this.itemToBuy;
    if (!item) return "";
    const nome = this.contentName(item) || "questo contenuto";
    const totale = this.costoDi(item);
    const credito = this.wallet.toFixed(2);

    // Comprando una visita si comprano anche le sue tappe a pagamento: il conto
    // va scomposto, altrimenti il totale sembra il prezzo sbagliato della visita.
    const mancanti = this.mancantiDi(item as any);
    if (mancanti > 0) {
      const curatela = (Number((item as any).price) || 0).toFixed(2);
      const contenuti = (Number((item as any).costoMancanti) || 0).toFixed(2);
      const quante =
        mancanti === 1 ? "1 descrizione" : `${mancanti} descrizioni`;
      return (
        `"${nome}" costa € ${curatela}, e comprende ${quante} a pagamento che ` +
        `non hai ancora (€ ${contenuti}): in tutto € ${totale.toFixed(2)}, e la ` +
        `visita e' subito percorribile. Il tuo credito è € ${credito}.`
      );
    }
    return `"${nome}" resterà nella tua libreria. Costa € ${totale.toFixed(2)}, il tuo credito è € ${credito}.`;
  }

  /**
   * I nomi delle visite, ma non tutti: in un museo grande la stessa opera sta
   * in venti percorsi, e un elenco di venti nomi spinge i bottoni della
   * conferma fuori dallo schermo. Tre bastano a far capire di che si tratta.
   */
  private elencoVisite(visite: { name: string }[]): string {
    const nomi = visite.slice(0, 3).map((v) => `"${v.name}"`).join(", ");
    if (visite.length <= 3) return nomi;
    return this.t("{nomi} e altre {n}", { nomi, n: visite.length - 3 });
  }

  /** Le visite che contengono quel che si sta togliendo, e quante resterebbero vuote. */
  visiteInGioco(): { id: string; name: string }[] {
    if (this.operaToDelete && this.operaImpact) return this.operaImpact.visite || [];
    if (this.itemToDelete && this.itemImpact) return (this.itemImpact as any).visite || [];
    return [];
  }

  visiteSvuotate(): { id: string; name: string }[] {
    if (this.operaToDelete && this.operaImpact) return this.operaImpact.svuotate || [];
    if (this.itemToDelete && this.itemImpact) return (this.itemImpact as any).svuotate || [];
    return [];
  }

  scegliVisite(modo: "accorcia" | "elimina") {
    this.visiteScelta = modo;
  }

  /** Come finisce, detto per esteso sotto le due scelte. */
  esitoScelta(modo: "accorcia" | "elimina"): string {
    const quante = this.visiteInGioco().length;
    const vuote = this.visiteSvuotate().length;
    if (modo === "elimina") {
      return quante === 1
        ? this.t("La visita sparisce, anche dalle librerie di chi l'aveva presa.")
        : this.t("Tutte e {n} spariscono, anche dalle librerie di chi le aveva prese.", { n: quante });
    }
    if (vuote === 0) {
      return quante === 1
        ? this.t("La visita perde una tappa e resta percorribile.")
        : this.t("Le {n} visite perdono una tappa e restano percorribili.", { n: quante });
    }
    return this.t(
      "Le altre perdono una tappa e restano percorribili; {n} resterebbero senza tappe e spariscono comunque.",
      { n: vuote },
    );
  }

  confirmVerb(): string {
    if (this.museoToWipe) return this.t("Svuota il museo");
    if (this.operaToDelete) return this.t("Rimuovi dal catalogo");
    if (this.itemToDelete) return "Elimina";
    if (this.visitToDelete) return "Elimina";
    if (this.visitToComplete) return "Sblocca tutto";
    return "Acquista";
  }

  confirmReady(): boolean {
    if (this.museoToWipe) return this.overview !== null;
    if (this.operaToDelete) return this.operaImpact !== null;
    if (this.itemToDelete) return this.itemImpact !== null;
    return true;
  }

  cancelConfirm() {
    this.confirmOpen = false;
    this.itemToBuy = null;
    this.visitToComplete = null;
    this.visitToDelete = null;
    this.itemToDelete = null;
    this.itemImpact = null;
    this.museoToWipe = null;
    this.operaToDelete = null;
    this.operaImpact = null;
    this.visiteScelta = "accorcia";
  }

  async runConfirm() {
    if (this.operaToDelete) {
      const opera = this.operaToDelete;
      const scelta = this.visiteScelta;
      this.cancelConfirm();
      try {
        const esito = await ArtAPI.eliminaOpera(opera.qid, scelta);
        await this.loadCatalogue();
        await this.loadMuseumState();
        const accorciate = (esito.visiteAccorciate || []).length;
        const sparite = (esito.visiteEliminate || []).length;
        this.showToast(
          this.t(
            "{opera} rimossa: {n} descrizioni, {a} visite accorciate, {v} eliminate.",
            { opera: esito.nome, n: esito.descrizioni, a: accorciate, v: sparite },
          ),
          "success",
        );
      } catch (e) {
        this.showToast((e as Error).message, "error");
      }
      return;
    }
    if (this.museoToWipe) {
      const museo = this.museoToWipe;
      this.cancelConfirm();
      try {
        const esito = await ArtAPI.svuotaMuseo(museo.qid);
        await this.loadMuseumState();
        this.showToast(
          this.t("{museo} svuotato: {opere} opere, {item} descrizioni, {visite} visite.", {
            museo: esito.museo,
            opere: esito.opere,
            item: esito.item,
            visite: esito.visite,
          }),
        );
      } catch (e) {
        this.showToast((e as Error).message, "error");
      }
      return;
    }

    if (this.itemToDelete) {
      const row = this.itemToDelete;
      const scelta = this.visiteScelta;
      this.cancelConfirm();
      try {
        const esito = await ArtAPI.eliminaItem(row.id, scelta);
        const eliminate = esito.visiteEliminate || [];
        const accorciate = esito.visiteAccorciate || [];
        await this.loadMuseumState();
        if (eliminate.length > 0 || accorciate.length > 0) {
          this.showToast(
            `Descrizione eliminata: ${accorciate.length} visite accorciate, ${eliminate.length} eliminate.`,
          );
        } else {
          this.showToast("Descrizione eliminata.");
        }
      } catch (e) {
        this.showToast((e as Error).message, "error");
      }
      return;
    }

    if (this.visitToDelete) {
      const visit = this.visitToDelete;
      this.cancelConfirm();
      try {
        await ArtAPI.eliminaVisita(visit["@id"]);
        this.visits = this.visits.filter(
          (c: any) => c["@id"] !== visit["@id"],
        );
        this.reindicizza();
        this.userCollection = this.userCollection.filter(
          (id) => id !== visit["@id"],
        );
        this.showToast("Visita eliminata.");
        if (this.currentUserRole === "curatore") await this.loadMuseumState();
        else this.goHome();
      } catch (e) {
        this.showToast((e as Error).message, "error");
      }
      return;
    }

    // Completare NON e' ricomprare la visita: la visita ce l'hai gia'. Quel che
    // si compra sono le descrizioni che le mancano, tutte insieme e per un
    // prezzo solo. Passa di qui perche' la richiesta prende sempre e soltanto
    // quel che NON hai: la visita, essendo gia' tua, non entra nel conto.
    // Una richiesta per tappa spezzerebbe l'acquisto: col credito buono per le
    // prime due si resterebbe pagati e incompleti.
    if (this.visitToComplete) {
      const visit = this.visitToComplete;
      this.cancelConfirm();
      if (!this.currentUser) return;
      try {
        const u = await ArtAPI.buy(visit["@id"]);
        this.wallet = typeof u.wallet === "number" ? u.wallet : 0;
        this.userCollection = u.collezione;
        this.showToast("Contenuti sbloccati: la visita è pronta.");
      } catch (e) {
        this.showToast((e as Error).message, "error");
      }
      return;
    }

    const item = this.itemToBuy;
    this.cancelConfirm();
    if (!item || !this.currentUser || this.inLibrary(item)) return;
    await this.performPurchase(item);
  }

  // --- Gestione del museo ---------------------------------------------------------------

  async loadMuseumState() {
    const qid = this.selectedMuseum ? this.selectedMuseum.qid : "";
    if (!qid) return;
    try {
      this.overview = await ArtAPI.fetchOverview(qid);
      this.curatedItems = await ArtAPI.fetchCuratedItems(qid);
      this.visits = await ArtAPI.fetchVisite(qid);
      this.reindicizza();
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }
  }


  percentualeCopertura(riga: { opere: number }): number {
    if (!this.overview) return 0;
    const totale = this.overview.copertura.opereTotali;
    if (!totale) return 0;
    return Math.round((riga.opere / totale) * 100);
  }

  accountLine(): string {
    if (!this.overview) return "";
    const a = this.overview.account;
    const pezzi = [
      `${a.autori} ${a.autori === 1 ? "autore" : "autori"}`,
      `${a.visitatori} ${a.visitatori === 1 ? "visitatore" : "visitatori"}`,
      `${a.curatori} ${a.curatori === 1 ? "curatore" : "curatori"}`,
    ];
    return pezzi.join(" · ");
  }


  setCatalogType(tipo: "tutti" | "opere" | "descrizioni" | "visite") {
    this.catalogTypeFilter = tipo;
    this.catalogDurationFilter = "tutti";
    // Il soggetto e' una domanda sulle descrizioni: dove non ce ne sono in
    // tabella, tenerla accesa filtrerebbe di nascosto.
    if (tipo === "opere" || tipo === "visite") this.catalogSubjectFilter = "tutti";
  }

  setCatalogSubject(soggetto: "tutti" | "opera" | "meta") {
    this.catalogSubjectFilter = soggetto;
  }

  /** Le descrizioni del museo che parlano di quest'opera. */
  descrizioniDi(artwork: any): number {
    const id = artwork["@id"];
    let quante = 0;
    for (const it of this.curatedItems) {
      const about = (it as any).about;
      const suo = typeof about === "object" && about ? about["@id"] : about;
      if (suo === id) quante++;
    }
    return quante;
  }

  /**
   * Le stesse voci della vetrina, e per la stessa ragione: le due schermate
   * dividono il catalogo sullo stesso asse, quindi devono chiamarlo con le
   * stesse parole. Le fasce arrivano da `visitDurationBands`, che e' la sola
   * tabella: qui erano riscritte a mano, con le etichette in italiano DENTRO lo
   * script e mai passate da `t()` -- cioe' il filtro del curatore parlava
   * italiano in tutte e tredici le lingue, e `residui` non lo poteva vedere.
   */
  catalogDurationOptions(): { value: string; label: string }[] {
    if (this.catalogTypeFilter === "descrizioni") {
      return secPerArt.map((s) => ({
        value: String(s),
        label: this.t("{n} secondi di lettura", { n: s }),
      }));
    }
    if (this.catalogTypeFilter === "visite") {
      return visitDurationBands.map((b) => ({
        value: b.value,
        label: this.t(b.label),
      }));
    }
    return [];
  }

  /** L'etichetta del genere di riga, che ora sono tre. */
  catalogRowLabel(row: any): string {
    if (row.kind === "opera") return this.t("Opera");
    if (row.kind === "visita") return this.t("Visita");
    return this.t("Descrizione");
  }

  /** Un'opera non ha un prezzo: a costare sono le descrizioni che ne parlano. */
  catalogPriceLabel(row: any): string {
    if (row.kind === "opera") return "n/d";
    return this.readablePrice(row.price);
  }

  /** Sotto il titolo di un'opera: il codice e quante descrizioni ne parlano. */
  catalogRowCaption(row: any): string {
    if (row.kind !== "opera") return "";
    const n = row.descrizioni || 0;
    const quante =
      n === 1 ? this.t("1 descrizione") : this.t("{n} descrizioni", { n });
    return `${row.qid} · ${quante}`;
  }

  private curatedVisits(): Visit[] {
    return this.visits.filter((v) => this.belongsToMuseum(v));
  }

  catalogAuthors(): string[] {
    const nomi = new Set<string>();
    for (const it of this.curatedItems) {
      if (it.author) nomi.add(it.author);
    }
    for (const v of this.curatedVisits()) {
      if (v.author) nomi.add(v.author);
    }
    return [...nomi].sort((a, b) => a.localeCompare(b));
  }

  durationLabel(row: any): string {
    if (row.kind === "opera") return "n/d";
    if (row.kind === "item") return `${row.duration} s`;
    return this.readableDuration(row.duration);
  }

  private matchesCatalogDuration(row: any): boolean {
    if (this.catalogDurationFilter === "tutti") return true;
    if (row.kind === "item") return String(row.duration) === this.catalogDurationFilter;
    const banda = visitDurationBands.find(
      (b) => b.value === this.catalogDurationFilter,
    );
    if (!banda) return true;
    return banda.test(durationMinutes(row.duration));
  }

  catalogRows(): CatalogRow[] {
    const cerca = this.catalogSearch.trim().toLowerCase();
    const rows: CatalogRow[] = [];

    if (this.catalogTypeFilter === "tutti" || this.catalogTypeFilter === "opere") {
      for (const a of this.museumArtworks()) {
        const artista =
          a.author && typeof a.author === "object" ? a.author.name || "" : "";
        rows.push({
          kind: "opera",
          id: a["@id"],
          name: a.name || a.qid,
          author: artista || "n/d",
          tone: "",
          duration: 0,
          price: 0,
          qid: a.qid,
          descrizioni: this.descrizioniDi(a),
          raw: a,
        });
      }
    }
    if (this.catalogTypeFilter === "tutti" || this.catalogTypeFilter === "descrizioni") {
      for (const it of this.curatedItems) {
        // `kind` e' il genere del contenuto (opera, stile, artista...): la riga
        // ha gia' un `kind` suo, che dice se e' un'opera, una descrizione o una
        // visita.
        const soggetto = ((it as any).kind || "opera") !== "opera";
        if (this.catalogSubjectFilter === "opera" && soggetto) continue;
        if (this.catalogSubjectFilter === "meta" && !soggetto) continue;
        rows.push({
          kind: "item",
          id: it["@id"],
          name: this.contentName(it as any),
          author: it.author,
          tone: it.educationalLevel,
          duration: Number(it.timeRequired) || 0,
          price: it.price || 0,
          privato: it.visibility === "privato",
          raw: it,
        });
      }
    }
    if (this.catalogTypeFilter === "tutti" || this.catalogTypeFilter === "visite") {
      for (const v of this.curatedVisits()) {
        rows.push({
          kind: "visita",
          id: v["@id"],
          name: v.name,
          author: v.author || "n/d",
          tone: v.level,
          duration: Number(v.duration) || 0,
          price: v.price || 0,
          guidata: Boolean(v.accessKey),
          raw: v,
        });
      }
    }

    return rows.filter((r) => {
      // Tono, autore e durata sono domande sui CONTENUTI: un'opera non ha un
      // tono ne' un autore di redazione, quindi con uno di quei filtri acceso
      // non e' che non corrisponde, non e' proprio quello che si sta cercando.
      const filtriDiContenuto =
        this.catalogToneFilter !== "tutti" ||
        this.catalogAuthorFilter !== "tutti" ||
        this.catalogDurationFilter !== "tutti";
      if (r.kind === "opera") {
        if (filtriDiContenuto) return false;
      } else {
        if (this.catalogToneFilter !== "tutti" && r.tone !== this.catalogToneFilter)
          return false;
        if (
          this.catalogAuthorFilter !== "tutti" &&
          r.author !== this.catalogAuthorFilter
        )
          return false;
        if (!this.matchesCatalogDuration(r)) return false;
      }
      if (!cerca) return true;
      const dove = `${r.name} ${r.author} ${r.tone} ${r.qid || ""}`.toLowerCase();
      return dove.includes(cerca);
    });
  }

  /**
   * Svuotare il catalogo di un museo: si apre la stessa conferma delle altre
   * eliminazioni, che dichiara PRIMA che cosa sparisce. I numeri sono quelli
   * del quadro d'insieme, gia' a schermo: non serve chiederli di nuovo.
   */
  openWipeMuseum() {
    if (!this.selectedMuseum) return;
    this.museoToWipe = this.selectedMuseum;
    this.confirmOpen = true;
  }

  /**
   * Aggiungere un'opera al museo: il curatore scrive solo il qid di Wikidata,
   * da cui il server ricava nome, autore, stile e immagine. Non nascono
   * descrizioni: quelle costano una chiamata al modello l'una, e le scrive il
   * seed (che salta le opere gia' presenti) oppure un autore.
   */
  async aggiungiOpera() {
    if (!this.selectedMuseum) return;
    const qid = this.nuovaOperaQid.trim().toUpperCase();
    if (qid === "") return;
    this.aggiungendoOpera = true;
    try {
      const esito = await ArtAPI.aggiungiOpera(qid, this.selectedMuseum.qid);
      this.nuovaOperaQid = "";
      await this.loadCatalogue();
      await this.loadMuseumState();
      // Due avvertimenti, e nessuno dei due impedisce l'inserimento: il primo si
      // aggiusta solo sulla mappa, il secondo puo' essere Wikidata incompleta.
      const avvisi: string[] = [];
      if (!esito.sullaMappa)
        avvisi.push(
          this.t("sulla mappa non c'è un nodo con questo codice, quindi non comparirà nella piantina"),
        );
      if (esito.nelMuseo === false)
        avvisi.push(this.t("Wikidata non la dà nella collezione di questo museo"));

      if (avvisi.length === 0) {
        this.showToast(
          this.t("{opera} aggiunta al catalogo.", { opera: esito.artwork.name }),
          "success",
        );
      } else {
        this.showToast(
          this.t("{opera} aggiunta, ma {avvisi}.", {
            opera: esito.artwork.name,
            avvisi: avvisi.join("; "),
          }),
          "error",
        );
      }
    } catch (e) {
      this.showToast((e as Error).message, "error");
    } finally {
      this.aggiungendoOpera = false;
    }
  }

  async openDeleteArtwork(opera: any) {
    if (!opera) return;
    this.operaToDelete = opera;
    this.operaImpact = null;
    this.confirmOpen = true;
    try {
      this.operaImpact = await ArtAPI.impattoOpera(opera.qid);
    } catch (e) {
      this.operaImpact = null;
      this.showToast((e as Error).message, "error");
    }
  }

  async openDeleteRow(row: any) {
    if (!row) return;
    if (row.kind === "opera") {
      await this.openDeleteArtwork(row.raw);
      return;
    }
    if (row.kind === "visita") {
      this.visitToDelete = row.raw;
      this.confirmOpen = true;
      return;
    }
    this.itemToDelete = row;
    this.itemImpact = null;
    this.confirmOpen = true;
    try {
      this.itemImpact = await ArtAPI.impattoItem(row.id);
    } catch (e) {
      this.itemImpact = null;
      this.showToast((e as Error).message, "error");
    }
  }


  // --- Etichette e inneschi chiamati dai binding ------------------------------

  roleTitle(r: UserRole): string {
    if (r === "autore") return "Autore";
    if (r === "curatore") return "Curatore";
    return "Visitatore";
  }

  roleHint(r: UserRole): string {
    if (r === "autore")
      return "Pubblichi descrizioni e visite, ne fissi prezzo e licenza.";
    if (r === "curatore")
      return "Sorvegli il catalogo del museo e ne togli quel che non ci deve stare.";
    return "Compri contenuti, componi percorsi e li vivi nel museo.";
  }

  confirmPasswordErrorId(): string | null {
    const f = this.registerForm;
    if (f.conferma && f.password !== f.conferma) return "reg-conf-err";
    return null;
  }

  visitPurchaseLabel(): string {
    const v = this.currentVisit();
    if (!v) return "";
    const costo = this.costoDi(v);
    if (costo === 0) return "Aggiungi alla libreria";
    if (this.mancantiDi(v) > 0) {
      return `Sblocca visita e contenuti (€ ${costo.toFixed(2)})`;
    }
    return `Sblocca la visita (€ ${costo.toFixed(2)})`;
  }

  unlockMissingLabel(): string {
    const v = this.currentVisit();
    if (!v) return "";
    const quanti = this.mancantiDi(v);
    const costo = (Number(v.costoMancanti) || 0).toFixed(2);
    return `Sblocca ${quanti} contenuti mancanti (€ ${costo})`;
  }

  toggleDescriptionLabel(it: Item): string {
    const verbo = this.openItems.includes(it["@id"]) ? "Chiudi" : "Leggi";
    return `${verbo} la descrizione ${it.educationalLevel}`;
  }

  addToPathLabel(it: Item, artworkName: string): string {
    const verbo = this.itemInVisit(it["@id"])
      ? "Già nel percorso"
      : "Aggiungi al percorso";
    return `${verbo}: ${it.educationalLevel} di ${artworkName}`;
  }

  toggleOptionalLabel(opzionale: boolean, index: number): string {
    const verbo = opzionale ? "Rendi obbligatoria" : "Rendi opzionale";
    return `${verbo} la tappa ${this.stopNumber(index)}`;
  }

  senzaDescrizioneLabel(): string {
    if (!this.overview) return "";
    const n = this.overview.copertura.senzaDescrizione.length;
    if (n === 1) return " opera non ha nessuna descrizione:";
    return " opere non hanno nessuna descrizione:";
  }

  editorFilterOptions(): { v: string; t: string }[] {
    return [
      { v: "tutti", t: "Tutte" },
      { v: "disponibili", t: "Che possiedo" },
      { v: "da_acquistare", t: "Da sbloccare" },
    ];
  }

  /**
   * Da chiamare con DUE inneschi nel markup, il `$watch` e il caso iniziale:
   * entrando in /vendite dall'indirizzo diretto il guardiano non scatta.
   */
  watchSales() {
    if (this.view === "vendite") this.loadSales();
  }

  showToast(messaggio: string, tipo: "success" | "error" = "success") {
    this.toast = { messaggio, tipo };
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = null;
    }, 5500);
  }

  closeToast() {
    this.toast = null;
  }

  private visitMinutes(v: any): number {
    return Math.round((Number(v.duration) || 0) / 60);
  }

  readableDuration(secondi: number): string {
    const minuti = durationMinutes(secondi);
    if (minuti < 1) return this.t("meno di 1 min");
    return this.t("{n} min", { n: minuti });
  }

  visitSummary(v: any): string {
    const tappe = (v.itemListElement || []).length;
    const parts = [
      tappe === 1 ? this.t("1 tappa") : this.t("{n} tappe", { n: tappe }),
      this.readableDuration(v.duration),
    ];
    // Il tono si LEGGE tradotto e si CONFRONTA in italiano: il valore e' quello
    // che sta nel database e nei filtri, tradurlo li' spegnerebbe la ricerca.
    const livello = this.visitLevelLabel(v);
    if (livello) parts.push(livello);
    return parts.join(" · ");
  }

  setMarketType(tipo: "tutti" | "visite" | "opere" | "meta") {
    this.marketType = tipo;
    this.marketDurationFilter = "tutti";
  }

  /**
   * Un gruppo parla di un'opera o di un soggetto che opera non e' (uno stile, un
   * artista, un periodo). La differenza la porta gia' `soggettoDi`, che per un
   * soggetto costruisce una tessera con dentro il `kind`: un'opera vera quel
   * campo non ce l'ha. E' lo stesso controllo che conta le due specie nel
   * riepilogo, e resta uno solo perche' due divergerebbero.
   */
  private isSoggetto(g: any): boolean {
    return !!(g && g.artwork && g.artwork.kind);
  }

  marketDurationOptions(): { value: string; label: string }[] {
    if (this.marketType === "opere" || this.marketType === "meta") {
      return secPerArt.map((s) => ({
        value: String(s),
        label: this.t("{n} secondi di lettura", { n: s }),
      }));
    }
    if (this.marketType === "visite") {
      return visitDurationBands.map((b) => ({
        value: b.value,
        label: this.t(b.label),
      }));
    }
    return [];
  }

  private matchesMarketDuration(min: number): boolean {
    if (this.marketType !== "visite") return true;
    const banda = visitDurationBands.find(
      (b) => b.value === this.marketDurationFilter,
    );
    if (!banda) return true;
    return banda.test(min);
  }

  visitTones(v: any): string[] {
    const toni = new Set<string>();
    for (const id of v.itemListElement || []) {
      const it = this.findItem(id);
      if (it && isItem(it) && it.educationalLevel) toni.add(it.educationalLevel);
    }
    if (toni.size === 0 && v.level) toni.add(v.level);
    return [...toni];
  }

  isMixedVisit(v: any): boolean {
    return this.visitTones(v).length > 1;
  }

  visitLevelLabel(v: any): string {
    if (this.isMixedVisit(v)) return this.t("Misto");
    const toni = this.visitTones(v);
    if (toni.length === 1) return this.t(toni[0]);
    if (v.level) return this.t(v.level);
    return "";
  }

  /**
   * Un tono filtra le visite che sono TUTTE di quel tono.
   *
   * Prima bastava che una tappa lo fosse, e una visita mista compariva percio'
   * sotto "Semplice" pur non essendo semplice: un filtro che restituisce cose
   * che quel tono non hanno dice il falso. Chi cerca un percorso semplice lo
   * vuole semplice fino in fondo.
   *
   * Non nasconde niente: le miste hanno la loro voce, `Misto`, ed e' il motivo
   * per cui questa regola si puo' stringere. Quando le si confrontava con
   * `Visit.level` -- un campo solo -- non comparivano sotto nessun tono, e
   * quello si' che le rendeva irraggiungibili.
   */
  private matchesMarketLevel(tones: string[]): boolean {
    if (this.marketLevelFilter === "tutti") return true;
    if (this.marketLevelFilter === "misto") return tones.length > 1;
    return tones.length === 1 && tones[0] === this.marketLevelFilter;
  }

  shownVisits(): Visit[] {
    if (this.marketType === "opere" || this.marketType === "meta") return [];
    return this.visits.filter((v) => {
      if (!this.belongsToMuseum(v)) return false;
      if (!this.visibleInMarket(v)) return false;
      if (!this.matchesSearch(v, this.marketSearch)) return false;
      if (!this.matchesMarketLevel(this.visitTones(v))) return false;
      return this.matchesMarketDuration(this.visitMinutes(v));
    });
  }

  /**
   * Chi e' il soggetto di questo contenuto, per raggrupparlo e per indirizzarlo.
   * Un'opera ha un `@id`; un soggetto scritto a mano si identifica con genere e
   * nome, cosi' due autori che scrivono di "Manierismo" finiscono sulla stessa
   * pagina.
   */
  soggettoIdOf(c: any): string {
    if (!c) return "?";
    const art = c.about;
    if (art && typeof art === "object") return art["@id"];
    if (typeof art === "string" && art) return art;
    if (c.subject) return `${c.kind}:${c.subject}`;
    return "?";
  }

  /** Il soggetto come lo mostra una tessera: l'opera, o l'item che ne parla. */
  private soggettoDi(c: any): any {
    const art = c.about;
    if (art && typeof art === "object") return art;
    const id = this.soggettoIdOf(c);
    return {
      "@id": id,
      qid: id,
      name: c.subject || id,
      imagePath: c.imagePath || "",
      kind: c.kind || "",
    };
  }

  private visibleItems(): Item[] {
    const perId = new Map<string, any>();
    for (const i of this.marketItems) {
      if (this.belongsToMuseum(i)) perId.set(i["@id"], i);
    }
    if (this.currentUserRole === "autore") {
      for (const i of this.myItems) {
        if (this.belongsToMuseum(i)) perId.set(i["@id"], i);
      }
    }
    return [...perId.values()];
  }

  groupByArtwork(lista: any[]): { artwork: any; items: any[] }[] {
    const groups = new Map<string, ArtworkGroup>();
    for (const c of lista) {
      if (c["@type"] !== "CreativeWork") continue;
      const id = this.soggettoIdOf(c);
      if (!groups.has(id)) {
        groups.set(id, { artwork: this.soggettoDi(c), items: [] });
      }
      groups.get(id)!.items.push(c);
    }
    return [...groups.values()];
  }

  shownArtworks(): ArtworkGroup[] {
    if (this.marketType === "visite") return [];
    const items = this.visibleItems().filter((i: any) => {
      if (this.marketLevelFilter === "misto") return false;
      if (
        this.marketLevelFilter !== "tutti" &&
        i.educationalLevel !== this.marketLevelFilter
      )
        return false;
      if (
        (this.marketType === "opere" || this.marketType === "meta") &&
        this.marketDurationFilter !== "tutti"
      ) {
        if (String(i.timeRequired) !== this.marketDurationFilter) return false;
      }
      return true;
    });
    let groups = this.groupByArtwork(items);
    if (this.marketType === "opere")
      groups = groups.filter((g) => !this.isSoggetto(g));
    if (this.marketType === "meta")
      groups = groups.filter((g) => this.isSoggetto(g));
    if (!this.marketSearch.trim()) return groups;
    return groups.filter((g) => this.matchesSearch(g.artwork, this.marketSearch));
  }

  marketSummary(): string {
    const v = this.shownVisits().length;
    const gruppi = this.shownArtworks();
    // "15 opere" conterebbe anche i soggetti che opere non sono.
    const soggetti = gruppi.filter((g) => this.isSoggetto(g)).length;
    const opere = gruppi.length - soggetti;
    const pezzi: string[] = [];
    if (this.marketType !== "opere") {
      if (v === 1) pezzi.push(this.t("1 visita"));
      else pezzi.push(this.t("{n} visite", { n: v }));
    }
    if (this.marketType !== "visite") {
      if (opere === 1) pezzi.push(this.t("1 opera"));
      else pezzi.push(this.t("{n} opere", { n: opere }));
      if (soggetti === 1) pezzi.push(this.t("1 soggetto"));
      else if (soggetti > 1) pezzi.push(this.t("{n} soggetti", { n: soggetti }));
    }
    return pezzi.join(" · ");
  }

  marketEmpty(): boolean {
    return this.shownVisits().length === 0 && this.shownArtworks().length === 0;
  }

  marketFiltered(): boolean {
    return (
      this.marketSearch.trim() !== "" ||
      this.marketType !== "tutti" ||
      this.marketLevelFilter !== "tutti" ||
      this.marketDurationFilter !== "tutti"
    );
  }

  resetMarketFilters() {
    this.marketSearch = "";
    this.marketType = "tutti";
    this.marketLevelFilter = "tutti";
    this.marketDurationFilter = "tutti";
  }

  /**
   * Quante descrizioni ha un'opera, e da che prezzo partono. Sono due frasi e
   * non una perche' portano due colori diversi: il conto e' una categoria, il
   * prezzo e' un valore, e uniti in una stringa sola potrebbero avere un colore
   * solo. Il conto lo dicono anche le righe d'elenco, che hanno la stessa forma.
   */
  artworkCount(g: ArtworkGroup): string {
    const n = g.items.length;
    if (n === 1) return this.t("1 descrizione");
    return this.t("{n} descrizioni", { n });
  }

  artworkFromPrice(g: ArtworkGroup): string {
    const prices = g.items.map((i: any) => Number(i.price) || 0);
    const cheapest = prices.length ? Math.min(...prices) : 0;
    if (cheapest === 0) return this.t("Gratis");
    return this.t("da {prezzo}", { prezzo: `€ ${cheapest.toFixed(2)}` });
  }

  /**
   * Il soggetto della pagina aperta: un'opera del catalogo, oppure ricostruito
   * dai contenuti che ne parlano: se nessuno ne parla piu', la pagina non c'e'.
   */
  currentArtwork(): Soggetto | null {
    if (this.view !== "opera" || !this.param) return null;
    const p = this.param;
    const opera = this.availableArtworks.find(
      (a: any) => a.qid === p || a["@id"] === p,
    );
    if (opera) return opera;
    for (const i of this.visibleItems()) {
      if (this.soggettoIdOf(i) === p) return this.soggettoDi(i);
    }
    return null;
  }

  artworkItems(): Item[] {
    const art = this.currentArtwork();
    if (!art) return [];
    const items = this.visibleItems().filter(
      (i: any) => this.soggettoIdOf(i) === art["@id"],
    );
    return items.sort(
      (a: any, b: any) =>
        educationalLevels.indexOf(a.educationalLevel) -
        educationalLevels.indexOf(b.educationalLevel),
    );
  }

  // --- I filtri della pagina di un'opera ------------------------------------

  /**
   * Gli stessi due filtri della vetrina (tono e durata), ma con una memoria
   * loro.
   *
   * ⚠️ Non si riusa `marketLevelFilter`/`marketDurationFilter`, e la ragione e'
   * che le due schermate filtrano cose diverse: la durata della vetrina, quando
   * si guardano le visite, e' una fascia di minuti (`breve`, `media`...), che
   * qui non corrisponde a nessuna descrizione. Arrivando da una vetrina filtrata
   * per visite brevi, l'opera si sarebbe aperta vuota.
   *
   * Le voci invece vengono dalle descrizioni di QUESTA opera, non dal
   * vocabolario intero: un menu che offre un tono di cui qui non c'e' niente
   * promette venti descrizioni e ne mostra zero.
   */
  artworkLevelFilter: string = "tutti";
  artworkDurationFilter: string = "tutti";

  artworkLevels(): string[] {
    const presenti = new Set<string>();
    for (const i of this.artworkItems()) presenti.add(i.educationalLevel);
    return educationalLevels.filter((l) => presenti.has(l));
  }

  /** `timeRequired` sono secondi in stringa: il confronto si fa li'. */
  artworkDurations(): number[] {
    const presenti = new Set<string>();
    for (const i of this.artworkItems()) presenti.add(String(i.timeRequired));
    return secPerArt.filter((s) => presenti.has(String(s)));
  }

  shownArtworkItems(): Item[] {
    return this.artworkItems().filter((i: any) => {
      if (
        this.artworkLevelFilter !== "tutti" &&
        i.educationalLevel !== this.artworkLevelFilter
      )
        return false;
      if (
        this.artworkDurationFilter !== "tutti" &&
        String(i.timeRequired) !== this.artworkDurationFilter
      )
        return false;
      return true;
    });
  }

  /** Quante se ne vedono adesso: le stesse due chiavi delle tessere in vetrina. */
  artworkItemsCount(): string {
    const n = this.shownArtworkItems().length;
    if (n === 1) return this.t("1 descrizione");
    return this.t("{n} descrizioni", { n });
  }

  artworkFiltered(): boolean {
    return (
      this.artworkLevelFilter !== "tutti" ||
      this.artworkDurationFilter !== "tutti"
    );
  }

  resetArtworkFilters() {
    this.artworkLevelFilter = "tutti";
    this.artworkDurationFilter = "tutti";
  }

  /**
   * La classe della pastiglia di un tono.
   *
   * Il nome si ricava dal tono invece di stare in una tabella: i toni li
   * dichiara `educationalLevelHints`, e un elenco parallelo qui sarebbe la
   * seconda copia da tenere allineata. Un tono senza la sua riga in
   * `components.css` esce come pastiglia neutra, che e' leggibile: il nome del
   * tono e' dentro la pastiglia, il colore lo conferma soltanto.
   */
  toneClass(livello: string | undefined): string {
    if (!livello) return "";
    return "pastiglia-tono-" + livello.toLowerCase();
  }

  /**
   * I generi di contenuto e i soggetti che il museo gia' nomina (stili e autori
   * delle sue opere). I secondi sono suggerimenti, non un elenco chiuso: scritto
   * come lo scrivono le opere, il contenuto si ritrova dalla pagina dell'opera.
   */
  itemKinds = itemKinds;
  museumTopics: { name: string; kind: string }[] = [];

  /** I suggerimenti del genere scelto. Un periodo o un evento non ne hanno. */
  topicSuggestions(): string[] {
    const genere = this.draft.genere;
    const nomi: string[] = [];
    for (const t of this.museumTopics) {
      if (t.kind === genere) nomi.push(t.name);
    }
    return nomi;
  }

  /**
   * La copertina di una visita, se chi l'ha composta ne ha caricata una.
   *
   * Vuoto e' il caso normale, non un difetto: senza immagine la tessera resta il
   * titolo sulla struttura, che e' come le visite si sono sempre viste. Non si
   * ripiega sulla figura della prima tappa — provato e scartato, vedi
   * `state.md` §4.6-bis: le visite di catalogo di un museo sono le stesse opere
   * nello stesso ordine, quindi uscirebbe la stessa fotografia su tutte.
   */
  visitImage(v: any): string {
    if (!v) return "";
    return v.imagePath || "";
  }

  /**
   * La copertina di un museo, se il curatore gliene ha messa una accanto alla
   * configurazione. Vuoto quando non c'e', e la carta resta di solo testo:
   * aggiungere un museo non deve avere un requisito grafico.
   *
   * L'indirizzo si codifica perche' quei file prendono il nome del museo, che
   * quasi sempre ha degli spazi ("Galleria degli Uffizi.jpg"). E' lo stesso
   * motivo per cui il navigator codifica `mapPath` prima di chiedere la pianta.
   */
  museumImage(m: any): string {
    if (!m || !m.imagePath) return "";
    return encodeURI(m.imagePath);
  }

  /** Il file non si legge qui: lo nomina il server, che risponde con l'indirizzo. */
  async caricaImmagine(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      this.draft.immagine = await ArtAPI.uploadItemImage(file);
      this.showToast("Immagine caricata.");
    } catch (e) {
      this.showToast((e as Error).message, "error");
    } finally {
      input.value = "";
    }
  }

  /**
   * Dove portano lo stile e l'autore di un'opera. Vuoto se nessuno ne ha scritto:
   * un collegamento a una pagina vuota e' peggio di nessun collegamento.
   */
  soggettoLink(nome: string, genere: string): string {
    if (!nome || nome === "Unknown") return "";
    const chiave = `${genere}:${nome}`;
    for (const i of this.visibleItems()) {
      if (this.soggettoIdOf(i) === chiave) return `/opera/${encodeURIComponent(chiave)}`;
    }
    return "";
  }

  /** Come si chiama un genere quando lo si mostra da solo. */
  kindName(id: string): string {
    const genere = kindById(id);
    if (genere) return genere.name;
    return "";
  }

  /* Quattro metodi corti invece di quattro espressioni nel markup: i binding di
   * Alpine sono stringhe che nessun compilatore controlla. */
  nomeAutore(): string {
    const a: any = this.currentArtwork();
    if (!a || !a.author || !a.author.name) return "";
    // Dove l'entita' non ha un'etichetta, Wikidata lascia l'indirizzo di un nodo
    // anonimo: stampato com'e' sembra il nome dell'autore.
    if (a.author.name.startsWith("http")) return "";
    return a.author.name;
  }

  nomeStile(): string {
    const a: any = this.currentArtwork();
    if (a && a.style && a.style.name) return a.style.name;
    return "";
  }

  linkAutore(): string {
    return this.soggettoLink(this.nomeAutore(), "artista");
  }

  linkStile(): string {
    return this.soggettoLink(this.nomeStile(), "stile");
  }

  openItems: string[] = [];
  /** Le opere di cui si sono gia' chiesti i testi: non si richiedono due volte. */
  artworksWithText: string[] = [];

  async toggleItem(id: string) {
    const i = this.openItems.indexOf(id);
    if (i >= 0) return this.openItems.splice(i, 1);
    this.openItems.push(id);
    // L'opera si ricava dalla descrizione, non dalla schermata aperta: cosi'
    // il testo arriva da qualunque punto lo si apra.
    const item = this.findItem(id);
    if (!item || !isItem(item)) return;
    const art = item.about;
    if (art && typeof art === "object") {
      await this.caricaTesti(art.qid);
      return;
    }
    // Chi non parla di un'opera non sta in nessun elenco per opera.
    if ("text" in item) return;
    try {
      const risposta = await ArtAPI.fetchItemText(item["@id"]);
      (item as Item).text = risposta.text;
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }
  }

  /**
   * Chiede al server i testi delle descrizioni di un'opera e li versa in quelle
   * gia' in memoria.
   *
   * Un testo assente e un testo negato sono due cose diverse e si distinguono
   * cosi': qui la proprieta' `text` non esiste ancora, mentre a chi non ha
   * comprato una descrizione a pagamento il server manda `text: ""` con
   * `locked`. Solo il primo caso si puo' rimediare chiedendo.
   */
  private async caricaTesti(artworkQid: string) {
    if (!artworkQid || this.artworksWithText.includes(artworkQid)) return;
    try {
      const pieni = await ArtAPI.fetchArtworkItems(artworkQid);
      const testi = new Map<string, string>();
      for (const it of pieni) testi.set(it["@id"], it.text || "");
      for (const it of this.marketItems) {
        const testo = testi.get(it["@id"]);
        if (testo !== undefined) it.text = testo;
      }
      this.artworksWithText.push(artworkQid);
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }
  }

  currentVisit(): Visit | null {
    if (this.view !== "visita" || !this.param) return null;
    return (
      this.visits.find((v) => v["@id"] === this.param) || null
    );
  }

  visitStops(v: any): any[] {
    if (!v) return [];
    return (v.itemListElement || []).map((id: string, i: number) => ({
      id,
      numero: i + 1,
      nome: this.itemName(id),
      opzionale: (v.optionalItems || []).includes(id),
      item: this.findItem(id),
    }));
  }

  notesAfter(v: any, itemId: string): string[] {
    const notes: string[] = [];
    for (const n of v.logistics || []) {
      if (n && typeof n === "object" && n.after === itemId && n.text)
        notes.push(n.text);
    }
    return notes;
  }

  openingNotes(v: any): string[] {
    const notes: string[] = [];
    for (const n of v.logistics || []) {
      if (typeof n === "string" && n.trim() !== "") notes.push(n);
      else if (n && typeof n === "object" && !n.after && n.text) notes.push(n.text);
    }
    return notes;
  }

  myVisits(): any[] {
    const base = [...this.visits].filter(
      (v) =>
        this.belongsToMuseum(v) &&
        this.inLibrary(v) &&
        this.visibleInMarket(v) &&
        this.matchesSearch(v, this.librarySearch),
    );
    return base;
  }

  myItemGroups(): { artwork: any; items: any[] }[] {
    const posseduti = this.visibleItems().filter(
      (i: any) =>
        this.inLibrary(i) && this.matchesSearch(i, this.librarySearch),
    );
    return this.groupByArtwork(posseduti);
  }

  workItemGroups(): { artwork: any; items: any[] }[] {
    if (this.worksTypeFilter === "visite") return [];
    const items = this.myItems.filter(
      (i) =>
        this.belongsToMuseum(i) && this.matchesSearch(i, this.worksSearch),
    );
    return this.groupByArtwork(items);
  }

  workVisits(): any[] {
    if (this.worksTypeFilter === "item") return [];
    return this.visits.filter(
      (v) =>
        v.author === this.currentUser &&
        this.belongsToMuseum(v) &&
        this.matchesSearch(v, this.worksSearch),
    );
  }

  adoptionsOf(id: string): number | null {
    const riga = this.sales.find((r: any) => r.id === id);
    return riga ? riga.adozioni : null;
  }

  /**
   * Il soggetto che si sta descrivendo, per tenerlo sotto gli occhi mentre si
   * scrive: sceglierlo da un menu a tendina lo riduceva a un titolo. Per un'opera
   * e' l'opera del catalogo, per il resto la bozza stessa, cioe' il nome e
   * l'immagine caricata, perche' li' il soggetto non esiste altrove.
   */
  draftSubject(): any {
    if (this.draft.genere !== "opera") {
      if (!this.draft.soggetto && !this.draft.immagine) return null;
      return {
        name: this.draft.soggetto,
        imagePath: this.draft.immagine,
        kind: this.draft.genere,
      };
    }
    if (!this.draft.selectedArtworkUri) return null;
    const trovata = this.availableArtworks.find(
      (a: any) => a["@id"] === this.draft.selectedArtworkUri,
    );
    if (!trovata) return null;
    return trovata;
  }

  /**
   * Le righe sotto il nome: autore e stile per un'opera, il genere per il resto.
   * Si salta quel che il catalogo non sa: Wikidata lascia scritto "Unknown", e
   * stamparlo fa sembrare rotta una scheda che e' solo incompleta.
   */
  draftSubjectFacts(): string[] {
    const opera = this.draftSubject();
    if (!opera) return [];
    if (this.draft.genere !== "opera") {
      const genere = kindById(this.draft.genere);
      return genere ? [genere.name] : [];
    }
    const fatti: string[] = [];
    if (opera.author && opera.author.name && opera.author.name !== "Unknown") {
      fatti.push(opera.author.name);
    }
    if (opera.style && opera.style.name && opera.style.name !== "Unknown") {
      fatti.push(opera.style.name);
    }
    return fatti;
  }

  artworkImage(about: any): string {
    if (!about || typeof about !== "object") return "";
    return about.imagePath || about.imageUri || "";
  }

  /**
   * La stessa figura in piccolo, per le tessere e le righe d'elenco: la',
   * l'originale da 960 px e' fino a sedici volte i pixel che la casella mostra,
   * e su un telefono e' tutto peso speso sulla rete e non sullo schermo. Chi
   * la figura la mostra grande — la scheda di un'opera, l'anteprima
   * dell'editor — continua a chiamare `artworkImage`.
   *
   * Il nome si calcola (`percorsoMiniatura`), non si chiede: e' un accordo con
   * il server, che accanto a ogni originale scrive sempre il suo `-c`.
   */
  miniatura(figura: string): string {
    return percorsoMiniatura(figura);
  }

  private navigatorBase(): string {
    if (this.navigatorOrigin) return this.navigatorOrigin;
    return `${window.location.protocol}//${window.location.hostname}:5173`;
  }

  /**
   * L'indirizzo di una visita nel navigator, e non dice chi sei: e' anche quello
   * che finisce nel QR, cioe' su carta, e una credenziale stampata vale quanto
   * la carta su cui sta. Chi lo inquadra da un altro telefono entra da li'.
   */
  navigatorUrl(v: any): string {
    if (!v) return "#";
    const uri: string = v.ofMuseum || "";
    const museumQid = uri.split("/").pop() || "";
    return (
      `${this.navigatorBase()}/` +
      `?museum=${encodeURIComponent(museumQid)}` +
      `&visit=${encodeURIComponent(v["@id"])}`
    );
  }

  /**
   * Aprire il navigator e' un ATTO, non un collegamento. Il biglietto si conia
   * per il viaggio che si sta per fare e vale dieci minuti, quindi non puo'
   * stare in un `href` scritto quando la pagina si e' disegnata; e vale una
   * volta sola, quindi uno per accesso lascerebbe a piedi il secondo viaggio.
   * E' l'unico modo che il navigator ha di sapere chi e' entrato: sta su
   * un'altra origine e questa memoria non la vede.
   */
  async openNavigator(url: string): Promise<boolean> {
    if (!url || url === "#") return false;
    // L'attesa NON si spegne quando il viaggio parte: da li' in poi comanda il
    // browser, che tiene a schermo questa pagina finche' l'altra non risponde.
    // Spegnendola si tornerebbe a una schermata immobile proprio nel momento
    // piu' lungo del passaggio. Si spegne solo se il biglietto non si conia,
    // perche' allora si resta qui.
    this.loading = true;
    await this.afterPaint(); // il velo va DIPINTO prima: vedi `afterPaint`
    try {
      const ticket = await ArtAPI.newHandoff();
      const separatore = url.includes("?") ? "&" : "?";
      window.location.href = `${url}${separatore}handoff=${encodeURIComponent(ticket)}`;
      return true;
    } catch (e) {
      this.loading = false;
      this.showToast((e as Error).message, "error");
      return false;
    }
  }

  // --- Da quale porta si e' entrati -----------------------------------------

  /**
   * Sulla soglia si sceglie gia' DOVE si sta andando, marketplace o app da
   * museo, ma l'accesso resta uno solo: il navigator sta su un'altra origine e
   * l'unico modo che ha di sapere chi e' entrato e' il biglietto coniato di
   * qua, che si puo' coniare solo da chi ha gia' una sessione. La scelta e'
   * percio' un'intenzione da tenere da parte fino a dopo il login, non una
   * seconda strada d'ingresso.
   *
   * ⚠️ Vive in memoria e NON in `localStorage`: e' la porta di questo ingresso.
   * Salvandola, un ricaricamento qualunque mesi dopo spedirebbe nell'app da
   * museo chi voleva solo rileggere la vetrina.
   */
  entryTarget: "marketplace" | "navigator" = "marketplace";

  enterFrom(target: "marketplace" | "navigator") {
    this.entryTarget = target;
    this.goTo("accedi");
  }

  /**
   * Se si era chiesta l'app da museo, ci si va: senza `?visit=`, cosi' si
   * atterra nella biglietteria e la visita si sceglie li'.
   *
   * Vuole un museo, perche' il navigator carica il suo (`?museum=`): quando non
   * ce n'e' uno ricordato si passa lo stesso dalla scelta del museo, ed e' da
   * li' che questa viene richiamata.
   *
   * ⚠️ L'intenzione si consuma solo quando il viaggio parte davvero. Se il
   * biglietto non si conia -- server giu', sessione appena scaduta -- si resta
   * nel marketplace con l'avviso, e il tentativo si potra' rifare; azzerarla
   * prima vorrebbe dire restare in vetrina senza sapere perche'.
   */
  private async goToNavigatorIfAsked(): Promise<boolean> {
    if (this.entryTarget !== "navigator") return false;
    if (!this.selectedMuseum) return false;
    const url =
      `${this.navigatorBase()}/` +
      `?museum=${encodeURIComponent(this.selectedMuseum.qid)}`;
    const partito = await this.openNavigator(url);
    if (partito) this.entryTarget = "marketplace";
    return partito;
  }

  // --- Visita su misura -----------------------------------------------------

  customReady(): boolean {
    return this.customRequest.trim() !== "" && !!this.selectedMuseum;
  }

  customVisitUrl(): string {
    if (!this.customReady()) return "#";
    return (
      `${this.navigatorBase()}/` +
      `?museum=${encodeURIComponent(this.selectedMuseum!.qid)}` +
      `&custom=${encodeURIComponent(this.customRequest.trim())}`
    );
  }

  waitingRoomUrl(): string {
    if (!this.guidedSession) return "#";
    return (
      `${this.navigatorBase()}/` +
      `?guidedSession=${encodeURIComponent(this.guidedSession.id)}&role=studente`
    );
  }

  startGuidedUrl(visit: any): string {
    return (
      `${this.navigatorBase()}/` +
      `?guidedVisit=${encodeURIComponent(visit["@id"])}&role=docente`
    );
  }

  qrSheetUrl(): string {
    if (!this.selectedMuseum) return "#";
    return `/api/museums/${encodeURIComponent(this.selectedMuseum.qid)}/qrcodes`;
  }

  async joinWithPasskey() {
    const key = this.passkeyInput.trim();
    if (!key || !this.currentUser)
      return this.showToast(
        "Scrivi la parola chiave che ti ha dato il docente.",
        "error",
      );
    try {
      const s = await ArtAPI.joinGuidedSession(
        key,
        this.museumEntityId() || undefined,
      );
      this.guidedSession = {
        id: s.id,
        visitName: s.visitName || "Visita guidata",
      };
      this.announce(`Sei in sala d'attesa per ${this.guidedSession.visitName}.`);
    } catch (e) {
      this.guidedSession = null;
      this.showToast((e as Error).message, "error");
    }
  }

  private emptyDraft() {
    return {
      price: 0,
      license: licenses[0],
      genere: "opera",
      selectedArtworkUri: "",
      soggetto: "",
      immagine: "",
      tono: "",
      durata: "60",
      testo: "",
      privato: false,
      guidata: false,
      accessKey: "",
      quiz: [] as { question: string; options: string[]; correct: number }[],
      tappe: [] as {
        tipo: "item" | "logistica";
        value: string;
        opzionale?: boolean;
      }[],
      titolo: "",
    };
  }

  openNewItem() {
    this.editingId = null;
    this.draft = this.emptyDraft();
    this.goTo("nuovo");
  }

  editItem(item: any) {
    if (
      !item ||
      item["@type"] !== "CreativeWork" ||
      item.author !== this.currentUser
    )
      return;
    this.editingId = item["@id"];
    this.draft = this.emptyDraft();
    this.draft.genere = item.kind;
    this.draft.selectedArtworkUri =
      (typeof item.about === "object" ? item.about["@id"] : item.about) || "";
    this.draft.soggetto = item.subject || "";
    this.draft.immagine = item.imagePath || "";
    this.draft.tono = item.educationalLevel || "";
    this.draft.durata = String(item.timeRequired || "");
    this.draft.testo = item.text || "";
    this.draft.price = item.price || 0;
    this.draft.license = item.license || licenses[0];
    this.draft.privato = item.visibility === "privato";
    this.goTo("nuovo");
  }

  /** Come si chiama il soggetto della bozza nel raggruppamento del catalogo. */
  private draftSubjectKey(): string {
    if (this.draft.genere === "opera") return this.draft.selectedArtworkUri || "";
    if (!this.draft.soggetto.trim()) return "";
    return `${this.draft.genere}:${this.draft.soggetto.trim()}`;
  }

  readingEstimate(): string {
    const parole = this.draft.testo.trim().split(/\s+/).filter(Boolean).length;
    if (parole === 0) return "";
    const secondi = Math.round((parole / WORDS_PER_MINUTE) * 60);
    const dichiarata = Number(this.draft.durata) || 0;
    let giudizio = "";
    if (dichiarata > 0) {
      const scarto = secondi / dichiarata;
      if (scarto < 0.6) giudizio = ", più corta della durata dichiarata";
      else if (scarto > 1.6) giudizio = ", più lunga della durata dichiarata";
      else giudizio = ", in linea con la durata dichiarata";
    }
    return `${parole} parole · circa ${secondi}s di lettura${giudizio}`;
  }

  itemIssues(): string[] {
    const issues: string[] = [];
    if (this.draft.genere === "opera") {
      if (!this.draft.selectedArtworkUri) issues.push("l'opera");
    } else {
      if (this.draft.soggetto.trim() === "") issues.push("il soggetto");
    }
    if (!this.draft.tono) issues.push("il tono");
    if (!(Number(this.draft.durata) > 0)) issues.push("la durata");
    if (this.draft.testo.trim() === "") issues.push("il testo");
    return issues;
  }

  async saveItem() {
    const issues = this.itemIssues();
    if (issues.length > 0)
      return this.showToast(`Manca ancora: ${issues.join(", ")}.`, "error");
    const payload = {
      tipo: "Item",
      editId: this.editingId || undefined,
      genere: this.draft.genere,
      id_oper_universale: this.draft.selectedArtworkUri,
      soggetto: this.draft.soggetto.trim(),
      immagine: this.draft.immagine,
      museo: this.selectedMuseum ? this.selectedMuseum.qid : "",
      prezzo: this.draft.privato ? 0 : this.draft.price,
      privato: !!this.draft.privato,
      licenza: this.draft.license,
      descrizioni: [
        {
          tono: this.draft.tono,
          lunghezza: this.draft.durata,
          testo: this.draft.testo,
        },
      ],
    };

    try {
      await ArtAPI.pubblica(payload);
      this.showToast(
        this.editingId ? "Descrizione aggiornata." : "Descrizione pubblicata.",
      );
      this.editingId = null;
      await this.initApp();
      this.goTo("lavori");
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }
  }

  openComposer() {
    this.editingId = null;
    this.visitStep = "percorso";
    this.editorPane = "percorso";
    this.editorSearch = "";
    this.editorFilter = "tutti";
    this.draft = this.emptyDraft();
    this.goTo("componi");
  }

  editVisit(visit: any) {
    if (!visit || visit.author !== this.currentUser) return;
    this.editingId = visit["@id"];
    this.visitStep = "percorso";
    this.editorPane = "percorso";
    this.editorSearch = "";
    this.editorFilter = "tutti";
    this.draft = this.emptyDraft();
    this.draft.titolo = visit.name || "";
    this.draft.price = visit.price || 0;
    this.draft.license = visit.license || licenses[0];
    this.draft.guidata = !!visit.accessKey;
    this.draft.accessKey = visit.accessKey || "";
    this.draft.quiz = (visit.quiz || []).map((q: any) => ({
      question: q.question || "",
      options: [...(q.options || ["", "", "", ""])],
      correct: Number(q.correct) || 0,
    }));
    this.draft.immagine = visit.imagePath || "";
    this.draft.tappe = this.rebuildStops(visit);
    this.goTo("componi");
  }

  private rebuildStops(visit: any) {
    const optionalIds = new Set<string>(visit.optionalItems || []);
    const tappe: {
      tipo: "item" | "logistica";
      value: string;
      opzionale?: boolean;
    }[] = [];
    for (const note of this.openingNotes(visit)) {
      tappe.push({ tipo: "logistica", value: note });
    }
    for (const id of visit.itemListElement || []) {
      tappe.push({ tipo: "item", value: id, opzionale: optionalIds.has(id) });
      for (const note of this.notesAfter(visit, id)) {
        tappe.push({ tipo: "logistica", value: note });
      }
    }
    return tappe;
  }

  importableVisits(): Visit[] {
    return this.visits.filter(
      (v) =>
        this.belongsToMuseum(v) &&
        !v.accessKey &&
        (!v.price || Number(v.price) === 0),
    );
  }

  importVisit(visitId: string) {
    if (!visitId) return;
    const src: any = this.visits.find((v) => v["@id"] === visitId);
    if (!src) return;
    this.draft.tappe = this.rebuildStops(src);
    this.editingId = null;
    if (this.currentUserRole === "autore") {
      // Importare un percorso NON deve decidere il tipo della visita: guidata o
      // in vetrina resta una scelta dell'autore, reversibile.
      if (!this.draft.titolo.trim())
        this.draft.titolo = src.name ? `${src.name} (copia)` : "";
      this.showToast(
        "Percorso importato. L'originale non è stato toccato: scegli il tipo di visita nelle impostazioni.",
      );
    } else {
      if (!this.draft.titolo.trim())
        this.draft.titolo = src.name ? `${src.name} (mia versione)` : "";
      this.showToast(
        "Percorso importato. L'originale non è stato toccato: personalizzalo e salvalo.",
      );
    }
  }

  /**
   * Si puo' LEGGERE (regola in `shared/access.ts`), che non e' `inLibrary()`:
   * una descrizione gratuita si legge senza averla presa.
   */
  canRead(item: any): boolean {
    if (!item) return false;
    const id = item["@id"];
    return isReadable(item, this.currentUser || "", this.userCollection.includes(id));
  }

  /**
   * I gruppi nell'ordine in cui si attraversa il museo. Chi compone una visita
   * scegliendo dall'alto in basso ottiene un percorso che non torna indietro; i
   * soggetti che una sala non ce l'hanno restano in fondo.
   */
  private percorrenza(gruppi: { artwork: any; items: any[] }[]) {
    const posto = new Map<string, number>();
    this.availableArtworks.forEach((a: any, i: number) => posto.set(a["@id"], i));
    const dopo = this.availableArtworks.length;
    return [...gruppi].sort((a, b) => {
      const ia = posto.get(a.artwork["@id"]);
      const ib = posto.get(b.artwork["@id"]);
      return (ia === undefined ? dopo : ia) - (ib === undefined ? dopo : ib);
    });
  }

  editorLibrary(): { artwork: any; items: any[] }[] {
    let base = this.visibleItems();
    if (this.currentUserRole === "autore") {
      base = base.filter((i: any) => this.canRead(i));
    }
    if (this.draft.guidata) {
      base = base.filter((op) => this.canRead(op));
    }
    if (this.editorFilter !== "tutti") {
      base = base.filter((i) =>
        this.editorFilter === "disponibili"
          ? this.canRead(i)
          : !this.canRead(i),
      );
    }
    const groups = this.percorrenza(this.groupByArtwork(base));
    if (!this.editorSearch.trim()) return groups;
    return groups.filter((g) =>
      this.matchesSearch(g.artwork, this.editorSearch),
    );
  }

  /**
   * Rifa' l'indice dei contenuti. Si chiama dove i tre elenchi vengono
   * assegnati, e in nessun altro posto: un indice che non segue i suoi elenchi
   * mostra il prezzo di prima di un acquisto appena fatto.
   *
   * L'ordine di riempimento e' rovesciato rispetto a quello in cui si cercava:
   * l'ultimo `set` vince, quindi mettendo per ultimi i propri contenuti restano
   * loro a rispondere, com'era quando la ricerca si fermava al primo trovato.
   */
  private reindicizza() {
    indiceContenuti.clear();
    for (const c of this.visits) indiceContenuti.set(c["@id"], c);
    for (const c of this.marketItems) indiceContenuti.set(c["@id"], c);
    for (const c of this.myItems) indiceContenuti.set(c["@id"], c);
  }

  findItem(id: string) {
    return indiceContenuti.get(id) || null;
  }

  itemName(id: string) {
    const item = this.findItem(id);
    if (!item) return "Contenuto non disponibile";
    if (isItem(item)) {
      const art = item.about;
      return typeof art === "object" && art ? art.name : "Descrizione";
    }
    return item.name || "Senza titolo";
  }

  itemDetail(id: string): string {
    const item = this.findItem(id);
    if (!item || !isItem(item)) return "";
    return `${item.educationalLevel} · ${item.timeRequired}s`;
  }

  /**
   * Il tono e i secondi di una tappa, presi a parte.
   *
   * `itemDetail` li unisce in una frase sola, che va bene in una riga stretta;
   * dove invece la tappa e' una tessera i due sono due pastiglie -- una colorata
   * dal tono, l'altra neutra -- e una stringa unica non si puo' dividere in due
   * colori.
   */
  itemTone(id: string): string {
    const item = this.findItem(id);
    if (!item || !isItem(item)) return "";
    return item.educationalLevel || "";
  }

  itemSeconds(id: string): string {
    const item = this.findItem(id);
    if (!item || !isItem(item)) return "";
    return item.timeRequired || "";
  }

  /**
   * La figura di una tappa: l'opera che la descrizione racconta, oppure
   * l'immagine caricata dall'autore quando il soggetto un'opera non e'.
   * Torna vuota se non c'e' ne' l'una ne' l'altra, e va bene: la riga tiene lo
   * stesso il suo posto, perche' la velatura sotto la figura resta anche senza.
   */
  itemImage(id: string): string {
    const item = this.findItem(id);
    if (!item || !isItem(item)) return "";
    if (item.about) return this.artworkImage(item.about);
    return item.imagePath || "";
  }

  itemInVisit(id: string) {
    return this.draft.tappe.some(
      (t) => t.tipo === "item" && t.value === id,
    );
  }

  addStop(tipo: "item" | "logistica", value: string = "") {
    if (tipo === "item" && this.itemInVisit(value)) {
      return this.showToast("Questa descrizione è già nel percorso.", "error");
    }
    this.draft.tappe.push({ tipo, value });
    if (tipo === "item") {
      this.announce(
        `${this.itemName(value)} aggiunta. ${this.stopCount()} tappe nel percorso.`,
      );
    }
  }

  removeStop(index: number) {
    this.draft.tappe.splice(index, 1);
  }

  moveStop(index: number, dir: -1 | 1) {
    const j = index + dir;
    const t = this.draft.tappe;
    if (j < 0 || j >= t.length) return;
    [t[index], t[j]] = [t[j], t[index]];
  }

  toggleOptional(index: number) {
    const t = this.draft.tappe[index];
    if (t && t.tipo === "item") t.opzionale = !t.opzionale;
  }

  stopCount(): number {
    return this.draft.tappe.filter((t) => t.tipo === "item").length;
  }

  stopNumber(index: number): number | null {
    const t = this.draft.tappe[index];
    if (!t || t.tipo !== "item") return null;
    let n = 0;
    for (let i = 0; i <= index; i++) {
      if (this.draft.tappe[i].tipo === "item") n++;
    }
    return n;
  }

  estimatedDuration(): number {
    let tot = 0;
    for (const t of this.draft.tappe) {
      if (t.tipo !== "item") continue;
      const it = this.findItem(t.value);
      if (it && isItem(it)) tot += Number(it.timeRequired) || 0;
    }
    return tot;
  }

  addQuizQuestion() {
    this.draft.quiz.push({
      question: "",
      options: ["", "", "", ""],
      correct: 0,
    });
  }

  removeQuizQuestion(index: number) {
    this.draft.quiz.splice(index, 1);
  }

  visitIssues(): string[] {
    const issues: string[] = [];
    if (!this.draft.titolo.trim()) issues.push(this.t("il titolo"));
    if (this.stopCount() === 0) issues.push(this.t("almeno una tappa"));
    const guidata = this.currentUserRole === "autore" && this.draft.guidata;
    if (guidata) {
      if (!this.draft.accessKey.trim()) issues.push(this.t("la parola chiave"));
      for (const q of this.draft.quiz) {
        if (
          !q.question.trim() ||
          q.options.length !== 4 ||
          q.options.some((o) => !o.trim())
        ) {
          issues.push(this.t("le domande del quiz complete"));
          break;
        }
      }
    }
    return issues;
  }

  /** "3 tappe · 2 min": il riepilogo della bozza, letto in due punti del compositore. */
  draftSummary(): string {
    const tappe = this.stopCount();
    const conta =
      tappe === 1 ? this.t("1 tappa") : this.t("{n} tappe", { n: tappe });
    return `${conta} · ${this.readableDuration(this.estimatedDuration())}`;
  }

  visitStatus(): string {
    const issues = this.visitIssues();
    if (issues.length > 0)
      return this.t("Manca ancora: {elenco}.", { elenco: issues.join(", ") });
    return this.t("Pronta · {riepilogo}", { riepilogo: this.draftSummary() });
  }

  /**
   * Il passo dopo quello aperto, "" se non ce n'e' un altro. E' quel che rende
   * il compositore una strada invece di tre schede: si pubblica solo dall'ultimo
   * passo, quindi dalle impostazioni si passa comunque e non si puo' pubblicare
   * senza averle viste. Il quiz e' un passo solo per
   * le visite guidate, percio' l'ultimo passo non e' sempre lo stesso.
   */
  nextVisitStep(): string {
    if (this.visitStep === "percorso") return "impostazioni";
    if (this.visitStep === "impostazioni") {
      if (this.currentUserRole === "autore" && this.draft.guidata) return "quiz";
      return "";
    }
    return "";
  }

  nextVisitStepLabel(): string {
    const dopo = this.nextVisitStep();
    if (dopo === "impostazioni") return "Continua · Impostazioni";
    if (dopo === "quiz") return "Continua · Quiz";
    return "";
  }

  publishLabel(): string {
    if (this.currentUserRole !== "autore") return "Salva nella mia libreria";
    if (this.draft.guidata) return "Attiva la visita guidata";
    return this.editingId ? "Salva le modifiche" : "Pubblica in vetrina";
  }

  async saveVisit() {
    const issues = this.visitIssues();
    if (issues.length > 0)
      return this.showToast(`Manca ancora: ${issues.join(", ")}.`, "error");

    const guidata = this.currentUserRole === "autore" && this.draft.guidata;
    let quizPayload:
      | { question: string; options: string[]; correct: number }[]
      | undefined;
    if (guidata && this.draft.quiz.length > 0) {
      quizPayload = this.draft.quiz.map((q) => ({
        question: q.question.trim(),
        options: q.options.map((o) => o.trim()),
        correct: Number(q.correct),
      }));
    }

    const payload = {
      tipo: "Visita",
      id: this.editingId || `tour-${Date.now()}`,
      titolo: this.draft.titolo,
      accessKey: guidata ? this.draft.accessKey.trim() : undefined,
      quiz: quizPayload,
      prezzo:
        guidata || this.currentUserRole !== "autore" ? 0 : this.draft.price,
      // Una visita composta da un visitatore non e' pubblicata da lui: resta
      // chiusa, come qualunque contenuto per cui nessuno ha scelto altro.
      licenza:
        this.currentUserRole === "autore"
          ? this.draft.license
          : DEFAULT_LICENSE,
      museumUri: this.selectedMuseum
        ? `http://www.wikidata.org/entity/${this.selectedMuseum.qid}`
        : undefined,
      // Si manda sempre, anche vuota: e' cosi' che si toglie una copertina da
      // una visita che ce l'aveva.
      immagine: this.draft.immagine,
      percorso: this.draft.tappe
        .filter((t) => t.tipo === "item" || t.value.trim() !== "")
        .map((t) => ({
          tipo: t.tipo,
          id_item: t.tipo === "item" ? t.value : undefined,
          opzionale: t.tipo === "item" ? !!t.opzionale : undefined,
          indicazione: t.tipo === "logistica" ? t.value : undefined,
        })),
    };

    try {
      await ArtAPI.pubblica(payload);
      this.showToast(
        guidata
          ? "Visita guidata attiva: comunica la parola chiave alla classe."
          : "Visita salvata.",
      );
      this.editingId = null;
      await this.initApp();
      this.goTo(this.currentUserRole === "autore" ? "lavori" : "libreria");
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }
  }

  periodFilter: string = "sempre";

  async loadSales() {
    if (!this.currentUser) return;
    try {
      this.sales = await ArtAPI.fetchSales();
    } catch (e) {
      console.error(e);
      this.sales = [];
    }
  }

  filteredSales(): SaleRow[] {
    const museo = this.museumEntityId();
    if (!museo) return [];
    return this.sales.filter((r) => r.ofMuseum === museo);
  }

  totalAdoptions() {
    return this.filteredSales().reduce((s, r) => s + (r.adozioni || 0), 0);
  }

  totalRevenue() {
    return this.filteredSales().reduce((s, r) => s + (r.ricavo || 0), 0);
  }

  readableRevenue(r: any): string {
    if (!r.price || Number(r.price) === 0) return "n/d";
    return `€ ${(r.ricavo || 0).toFixed(2)}`;
  }

  /**
   * L'indirizzo dove sta scritto per esteso che cosa concede una licenza.
   *
   * `In Copyright` e `CC BY-NC-ND 4.0` sono identificatori: dicono tutto a chi
   * gia' li conosce e niente a chi non li ha mai visti. Il collegamento e' quel
   * che li rende leggibili, e porta al testo di chi la licenza la pubblica --
   * RightsStatements.org o Creative Commons -- non a una nostra parafrasi.
   * Vuoto per un valore che non riconosciamo: meglio nessun collegamento che uno
   * che promette di spiegare e non spiega.
   */
  licenseHref(nome: string | undefined): string {
    if (!nome) return "";
    return licenseUri[nome] || "";
  }

  readablePrice(p: number | undefined): string {
    if (!p || Number(p) === 0) return this.t("Gratis");
    return `€ ${Number(p).toFixed(2)}`;
  }
}

export const state = new AppState();
