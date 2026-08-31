/**
 * Il deposito: l'unico stato del marketplace, piu' i metodi che i binding Alpine
 * chiamano. Quel che serve per leggerlo:
 *
 *  1. la navigazione e' un router su indirizzi veri: `view` dice quale schermata
 *     e' attiva e la decide l'indirizzo, non un click, quindi "indietro" e il
 *     ricaricamento funzionano. Le finestre modali restano alle sole conferme.
 *     L'elenco delle schermate sta in `shared/constants.ts` perche' lo legge
 *     anche il server, che deve rimandare il guscio per ognuna; i click sui link
 *     interni vanno intercettati, o il browser ricarica invece di cambiare vista;
 *  2. ruolo e museo arrivano prima dei dati: il catalogo si scarica per museo
 *     (`initApp`);
 *  3. la vetrina e' un elenco solo con visite e opere, con un'unica serie di
 *     ricerca e filtri; il tono di una visita si legge dai toni delle sue tappe,
 *     non da `Visit.level`, che per una visita a mano dice "Personalizzata";
 *  4. i ruoli sono tre ma le diramazioni sono scritte `role === "autore" ? …`
 *     col visitatore nel ramo altrimenti: un ruolo nuovo ci cade dentro in
 *     silenzio, quindi va nominato dove conta.
 *
 * L'ordine di `draft.tappe` e' l'ancoraggio delle note logistiche: il server non
 * riceve una posizione, la ricava percorrendo `percorso` e legando ogni nota alla
 * tappa che la precede, e al primo salvataggio la nota si riancora da se'.
 *
 * Nel catalogo del curatore la durata e' in secondi esatti e non in minuti: le
 * descrizioni sono uniche per (opera, autore, tono, DURATA), e i minuti
 * arrotondati renderebbero due righe indistinguibili.
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
  MAX_VISITE_VISITATORE,
  marketplaceViews,
  marketplaceLegacyViews,
} from "../../../shared/constants.js";
import { isReadable } from "../../../shared/access.js";
import { linguaIniziale, preparaLingua, salvaLingua, traduci } from "./i18n.js";
import {
  ArtAPI,
  clearToken,
  hasToken,
  onSessionExpired,
  setToken,
} from "./api.js";

/** Cio' su cui valgono gli aiutanti comuni: cercare, dire di che museo e', il tono. */
export type Catalogabile = Content | Artwork;

/**
 * Una riga della tabella del catalogo del curatore. `kind` distingue le tre
 * specie che ci convivono: l'opera, la descrizione che ne parla, la visita che
 * la mette in fila. `author` cambia senso con la riga: di un'opera e' chi l'ha
 * dipinta, di una descrizione o di una visita chi l'ha scritta.
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
  qid?: string; // solo per le opere: il codice Wikidata
  descrizioni?: number; // solo per le opere: quante descrizioni ne parlano
  raw: any;
}

/** Cosa sparirebbe eliminando una descrizione: risposta di GET /items/:id/impact. */
export interface ImpactReport {
  id: string;
  author: string;
  educationalLevel: string;
  visite: {
    id: string;
    name: string;
    author: string | null;
    guidata: boolean;
  }[];
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

/** Una riga di "Vendite e adozioni": un contenuto in vendita, con adozioni e ricavo. */
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
 * Il soggetto di un gruppo del catalogo. Uno stile, un autore o un periodo non
 * sono un documento del database: portano solo quel che la descrizione ne dice.
 * Il campo `kind` ce l'hanno soltanto loro, ed e' anche il modo di distinguerli
 * da un'opera vera.
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

/** Un'opera, o un soggetto, con tutte le descrizioni che ne parlano. */
export interface ArtworkGroup {
  artwork: Soggetto;
  items: Item[];
}

/**
 * Le schermate. Si ricavano dall'elenco in `shared/constants.ts`, che legge
 * anche il server per sapere a quali indirizzi rimandare il guscio: un secondo
 * elenco qui, diverso da quello, aprirebbe una schermata col click e darebbe
 * 404 al ricaricamento. `avvio` si aggiunge a mano perche' non e' un indirizzo:
 * e' lo stato in cui `start()` non ha ancora deciso che schermata mostrare (c'e'
 * un biglietto in sessionStorage da spendere), e fino ad allora non si disegna.
 */
export type View = "avvio" | (typeof marketplaceViews)[number];

/**
 * Indice dei contenuti per `@id`: visite, descrizioni del museo e propri.
 * Sta FUORI dallo stato di proposito: la vetrina lo interroga migliaia di volte
 * per ogni disegnata, e dentro il Proxy reattivo di Alpine ogni lettura
 * costerebbe; fuori, una lettura resta una lettura. Scorrere invece gli elenchi
 * a ogni ricerca costerebbe quanto l'intero catalogo.
 */
const indiceContenuti = new Map<string, Content>();

export class AppState {
  // **********************************************************************
  //                           Rotta corrente
  // **********************************************************************
  view: View = "avvio";
  param: string = "";

  currentUser: string | null = null;
  currentUserRole: UserRole | null = null;

  announcement: string = "";

  // **********************************************************************
  //                          Ricerca e filtri
  // **********************************************************************
  marketSearch: string = "";
  marketType: "tutti" | "visite" | "opere" | "meta" = "tutti";
  marketLevelFilter: string = "tutti";
  marketDurationFilter: string = "tutti";

  librarySearch: string = "";
  libraryTypeFilter: "tutti" | "item" | "visite" = "tutti";

  worksSearch: string = "";
  worksTypeFilter: "tutti" | "item" | "visite" = "tutti";

  catalogSearch: string = "";
  /** Che specie di riga elencare: le opere, le descrizioni che ne parlano, o le visite. */
  catalogTypeFilter: "tutti" | "opere" | "descrizioni" | "visite" = "tutti";
  /**
   * Di che cosa parla la descrizione: di un'opera, oppure di un soggetto del
   * museo (un autore, uno stile, un movimento). E' l'asse `kind` degli item, e
   * ha senso solo dove in tabella ci sono descrizioni.
   */
  catalogSubjectFilter: "tutti" | "opera" | "meta" = "tutti";
  catalogToneFilter: string = "tutti";
  catalogDurationFilter: string = "tutti";
  catalogAuthorFilter: string = "tutti";

  editorSearch: string = "";
  editorFilter: "tutti" | "disponibili" | "da_acquistare" = "tutti";

  // **********************************************************************
  //                          Visita su misura
  // **********************************************************************
  customRequest: string = "";

  // **********************************************************************
  //                      Visita guidata (studente)
  // **********************************************************************
  passkeyInput: string = "";
  guidedSession: { id: string; visitName: string } | null = null;

  // **********************************************************************
  //                       Portafoglio e possesso
  // **********************************************************************
  wallet: number = 0;
  userCollection: string[] = [];

  // **********************************************************************
  //                              Conferme
  // **********************************************************************
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
  /**
   * La descrizione che si sta per eliminare, ridotta ai due campi che la
   * conferma usa. La si riempie da due schermate con forme diverse -- la tabella
   * del curatore ha una `CatalogRow`, la pagina di un'opera l'item nudo -- e i
   * due campi sono il minimo comune che entrambe possono dare senza inventare.
   */
  itemToDelete: { id: string; name: string } | null = null;
  itemImpact: ImpactReport | null = null;

  // **********************************************************************
  //                             Notifiche
  // **********************************************************************
  toast: { messaggio: string; tipo: "success" | "error" } | null = null;
  private toastTimer: any = null;

  // **********************************************************************
  //                               Dati
  // **********************************************************************
  visits: Visit[] = [];
  marketItems: Item[] = [];
  myItems: Item[] = [];
  availableArtworks: Artwork[] = [];
  museums: Museum[] = [];
  selectedMuseum: Museum | null = null;
  sales: SaleRow[] = [];
  loading: boolean = false;

  // **********************************************************************
  //                         Gestione del museo
  // **********************************************************************
  overview: MuseumOverview | null = null;
  curatedItems: Item[] = [];

  private navigatorOrigin: string = "";

  /**
   * La lingua dell'interfaccia, tenuta nello stato e non in una variabile di
   * modulo: `t()` la rilegge a ogni chiamata, quindi dentro un binding di Alpine
   * ne registra la dipendenza e riassegnarla ridisegna tutto il tradotto. Parte
   * dall'italiano; la vera si assegna in `start()` dopo il catalogo (vedi `t`).
   */
  lingua: string = SOURCE_LANG;

  /**
   * Se `i18next` e' pronto. `t()` lo legge per la sua reattivita': quando la
   * lingua scelta e' gia' l'italiano `start()` riassegna a `lingua` lo stesso
   * valore e Alpine non ridisegna, ma il passaggio di questo campo a `true` si'.
   * Finche' e' `false`, `traduci` rende la chiave cruda, segnaposto compresi.
   */
  catalogoPronto = false;
  lingueDisponibili = languages;

  licenseOptions: string[] = licenses;
  tones: string[] = educationalLevels;
  toneHints: Record<string, string> = educationalLevelHints;

  // **********************************************************************
  //                              Editor
  // **********************************************************************
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

  // **********************************************************************
  //                            Navigazione
  // **********************************************************************

  /**
   * L'indirizzo corrente come schermata + parametro, o `null` se non e' del
   * marketplace: `interceptClicks` usa quel `null` per lasciare al browser i
   * link che non sono schermate, `applyRoute` per ripiegare sulla soglia. Il
   * `decodeURIComponent` e' protetto perche' un `%` isolato lo fa lanciare.
   */
  private parsePath(
    percorso: string,
  ): { view: View; param: string; tipo: string } | null {
    const raw = percorso.replace(/^\/+/, "");
    const head = raw.split("/")[0] || "";
    const tail = raw.split("/").slice(1).join("/");
    let param = "";
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

  /**
   * Porta lo stato sulla schermata dell'indirizzo, applicando i cancelli: senza
   * sessione restano solo le schermate pubbliche, senza museo scelto si va alla
   * scelta del museo, e chi e' gia' dentro non torna sulle pubbliche.
   */
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
    // La visita su misura non si salva: vale solo mentre la si cammina, quindi
    // e' una strada da visitatore. L'autore che ci arrivasse comporrebbe un
    // percorso destinato a evaporare, percio' lo si rimanda alla sua home.
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
   * Riporta ogni schermata nuova in cima. Il guscio non e' un documento che
   * scorre ma una vista che si sostituisce, quindi lo scorrimento della
   * precedente resterebbe. Si azzerano sia la finestra sia `#contenuto`: sotto
   * `lg` scorre la pagina, da `lg` in su scorre il <main>.
   */
  private inCima() {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    const main = document.getElementById("contenuto");
    if (main) main.scrollTop = 0;
  }

  /**
   * Cambia indirizzo senza ricaricare. `pushState` non emette eventi, quindi la
   * rotta va applicata subito a mano: scordarsene cambia la barra e lascia la
   * schermata com'era. `popstate` invece innesca da solo `applyRoute` su
   * avanti/indietro, ed e' il solo cambio d'indirizzo che non passa di qui.
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
   * Manda altrove chi ha chiesto una schermata che non puo' avere. Sostituisce
   * la tappa di cronologia invece di aggiungerla: se la aggiungesse, "indietro"
   * tornerebbe all'indirizzo appena rifiutato, che rimanda di nuovo qui, e non
   * si uscirebbe piu' dall'anello.
   */
  redirectTo(view: View) {
    this.navigate(`/${view}`, true);
  }

  /**
   * Se sono montati binario e <main>. Soglia, accesso e registrazione non li
   * hanno, e li' vanno nascosti anche i due link di salto all'accessibilita'.
   */
  guscioMontato(): boolean {
    if (!this.currentUser) return false;
    if (this.view === "soglia") return false;
    if (this.view === "accedi") return false;
    if (this.view === "registrati") return false;
    return true;
  }

  /** La home di ognuno: gestione al curatore, lavori all'autore, home al visitatore. */
  roleHome(): View {
    if (this.currentUserRole === "curatore") return "gestione";
    if (this.currentUserRole === "autore") return "lavori";
    return "home";
  }

  /** Va alla home del proprio ruolo. */
  goHome() {
    this.goTo(this.roleHome());
  }

  /**
   * Il nome della schermata per il titolo della pagina e per la regione viva
   * che legge lo screen reader. Tradotto come il resto: un titolo lasciato in
   * italiano dentro un'app in un'altra lingua non lo segnalerebbe nessuno.
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

  /** Aggiorna titolo della pagina e annuncio vocale a ogni cambio di schermata. */
  private announceView() {
    document.title = `${this.viewLabel()} · ArtAround`;
    this.announce(this.viewLabel());
  }

  /**
   * Detta un testo nella regione viva. Lo svuota e lo riscrive al fotogramma
   * dopo perche' lo screen reader annuncia solo un valore che cambia.
   */
  announce(testo: string) {
    this.announcement = "";
    window.requestAnimationFrame(() => {
      this.announcement = testo;
    });
  }

  /**
   * Traduce: e' il metodo che i template chiamano. In italiano non c'e' un
   * catalogo, quindi la chiave stessa e' il messaggio. Il ramo su
   * `catalogoPronto` lega ogni binding a quel campo, cosi' quando diventa `true`
   * Alpine ridisegna con la lingua vera (vedi il campo).
   */
  t(chiave: string, parametri?: Record<string, unknown>): string {
    if (!this.catalogoPronto) return chiave;
    return traduci(chiave, this.lingua, parametri);
  }

  /**
   * Aspetta un fotogramma DIPINTO (due `requestAnimationFrame`: uno prima del
   * disegno, uno dopo). In coda a un'attesa spegne il velo solo quando la
   * schermata nuova e' davvero a schermo; in testa lascia dipingere un
   * fotogramma col velo, o il marchio dell'attesa non parte e poi scatta.
   */
  private afterPaint(): Promise<void> {
    return new Promise((risolvi) => {
      requestAnimationFrame(() => requestAnimationFrame(() => risolvi()));
    });
  }

  /** Cambia lingua dal selettore: scarica il catalogo, poi lo rende e lo salva. */
  async cambiaLingua(codice: string) {
    await preparaLingua(codice);
    this.catalogoPronto = true;
    salvaLingua(codice);
    this.lingua = codice;
    document.documentElement.lang = codice;
  }

  /**
   * Un solo ascoltatore sul documento che intercetta i click sui link interni e
   * cambia rotta senza far ricaricare. Il corpo e' quasi tutto eccezioni: tasti
   * speciali e tasto centrale (o "apri in nuova scheda" apre qui), `target` e
   * `download`, i veri frammenti `#...`, e ogni indirizzo che non sia una
   * schermata (`/api/...`), che `knownRoute` riconosce e lascia al browser.
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

  // **********************************************************************
  //                     Avvio, sessione e catalogo
  // **********************************************************************

  /**
   * L'avvio: registra `popstate` e l'intercettazione dei click, prepara la
   * lingua, legge la config, prova a riprendere la sessione dal biglietto e
   * infine applica la rotta dell'indirizzo con cui la pagina si e' aperta.
   */
  async start() {
    window.addEventListener("popstate", () => this.applyRoute());
    this.interceptClicks();
    // La lingua vera si assegna solo dopo il catalogo (vedi il campo `lingua`);
    // fino ad allora `view` vale "avvio" e non c'e' niente a schermo.
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
   * Riprende la sessione dal biglietto, che sopravvive a ricaricamento e giro
   * verso il navigator mentre il resto dello stato no. Portafoglio e collezione
   * non si ricordano ma si rileggono: nel frattempo puo' esserci stato un
   * acquisto.
   */
  private async resumeSession() {
    if (!hasToken()) return;
    try {
      await this.enterAs(await ArtAPI.fetchMe());
    } catch {
      clearToken();
    }
  }

  /** Il server dichiara scaduta la sessione: si torna alla soglia con un avviso. */
  private sessionLost() {
    this.resetToThreshold();
    this.showToast("La sessione è scaduta: entra di nuovo.", "error");
  }

  /**
   * L'ordine conta: prima si RISOLVE il museo, poi si scarica. Il catalogo si
   * chiede per museo (`?museum=`), quindi il museo scelto e' una precondizione
   * dello scaricamento. Per lo stesso motivo cambiare museo ricarica: vedi
   * `selectMuseum`.
   */
  async initApp() {
    this.loading = true;
    await this.afterPaint(); // dipingi il velo prima di occupare il filo
    try {
      this.museums = await ArtAPI.fetchMuseums();

      // Il museo si sceglie a ogni ingresso e non si ricorda: e' la prima
      // domanda che le slide vogliono (slide 20), e una risposta data ieri non
      // e' quella di oggi. Con un museo solo non si chiede: non c'e' scelta.
      if (!this.selectedMuseum && this.museums.length === 1) {
        this.selectedMuseum = this.museums[0];
      }
      // Prima del catalogo: chi va all'app da museo esce di qui, e per lui il
      // catalogo di un museo grande sono secondi buttati.
      if (await this.goToNavigatorIfAsked()) return;
      if (this.selectedMuseum) await this.loadCatalogue();

      this.redirectTo(this.selectedMuseum ? this.roleHome() : "musei");
      await this.afterPaint(); // il velo resta finche' la schermata non e' a video
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
   * Scarica il catalogo del solo museo scelto, senza i testi delle descrizioni
   * (quelli arrivano un'opera per volta da `caricaTesti`): in un museo grande
   * sono circa tre quarti del peso e all'ingresso non se ne legge nessuno. Le
   * cinque richieste partono insieme; solo `withArtwork` le ricuce alla fine.
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
   * Rimette dentro ogni descrizione l'opera che descrive. `GET /items/metadata`
   * manda `about` come solo id, per non ripetere la stessa opera dentro tutte le
   * sue descrizioni; le opere ci sono gia', quindi si ricuce qui e da qui in poi
   * la descrizione ha la forma piena che raggruppamento, ricerca e filtri si
   * aspettano.
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

  /** Accede col modulo. Il velo si accende gia' qui: fra il tocco e la risposta c'e' la rete. */
  async login() {
    const { username, password } = this.loginForm;
    if (!username || !password)
      return this.showToast("Inserisci username e password.", "error");
    this.loading = true;
    await this.afterPaint(); // dipingi il velo prima di occupare il filo
    try {
      await this.enterAs(await ArtAPI.login(username, password));
    } catch (e) {
      this.showToast((e as Error).message, "error");
    } finally {
      this.loading = false;
    }
  }

  /** Popola sessione, portafoglio e collezione dall'account e avvia `initApp`. */
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

  /** Registra un profilo e ci entra subito. Rifiuta se le due password non coincidono. */
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
   * Riporta lo stato a quello di chi non e' entrato e va alla soglia. Separato
   * da `logout` perche' ci si arriva anche a sessione scaduta, quando sul server
   * non c'e' piu' niente da chiudere.
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
    // La porta d'ingresso vale per l'ingresso in corso: chi esce la risceglie.
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

  // **********************************************************************
  //                         Museo selezionato
  // **********************************************************************

  /** L'URI Wikidata del museo scelto: la forma con cui `ofMuseum` lo nomina. */
  private museumEntityId(): string | null {
    return this.selectedMuseum
      ? `http://www.wikidata.org/entity/${this.selectedMuseum.qid}`
      : null;
  }

  /** Se un contenuto appartiene al museo scelto. */
  private belongsToMuseum(c: Catalogabile): boolean {
    const museo = this.museumEntityId();
    if (!museo) return false;
    return c.ofMuseum === museo;
  }

  /**
   * Sceglie il museo dalla schermata di scelta: chi era diretto all'app da museo
   * riparte subito, gli altri scaricano il catalogo e vanno alla loro home.
   */
  async selectMuseum(m: Museum) {
    this.selectedMuseum = m;
    // Chi era diretto all'app da museo e' passato di qui solo perche' il museo
    // mancava: adesso c'e', quindi se ne va senza scaricare il catalogo.
    if (await this.goToNavigatorIfAsked()) return;
    this.loading = true;
    await this.afterPaint(); // dipingi il velo prima di occupare il filo
    try {
      await this.loadCatalogue();
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }
    // `goTo` PRIMA di spegnere il velo: e' il cambio di vista a far costruire
    // ad Alpine le tessere del museo nuovo, ed e' quello che si aspetta.
    this.goTo(this.roleHome());
    await this.afterPaint();
    this.loading = false;
  }

  /** Torna alla scelta del museo. */
  changeMuseum() {
    this.goTo("musei");
  }

  /** "12 opere · 3 visite": il sottotitolo di una carta museo. */
  museumSummary(m: Museum): string {
    const opere = typeof m.opere === "number" ? m.opere : 0;
    const visite = typeof m.visite === "number" ? m.visite : 0;
    const conta = [
      opere === 1 ? this.t("1 opera") : this.t("{n} opere", { n: opere }),
      visite === 1 ? this.t("1 visita") : this.t("{n} visite", { n: visite }),
    ];
    return conta.join(" · ");
  }

  /** Le opere del museo scelto. */
  museumArtworks() {
    return this.availableArtworks.filter((a) => this.belongsToMuseum(a));
  }

  // **********************************************************************
  //                        Ricerca e filtri
  // **********************************************************************

  /** Il nome da mostrare per un contenuto: il suo, o quello dell'opera che descrive. */
  contentName(c: Catalogabile): string {
    if (isVisit(c)) return c.name || "";
    if (isArtwork(c)) return c.name || "";
    const art = c.about;
    if (typeof art === "object" && art) return art.name || "";
    return c.subject || "";
  }

  /** Riduce una stringa alla forma di confronto: minuscolo, senza accenti ne' segni. */
  private normalizeSearch(s: string): string {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  /** Tutto il testo su cui un contenuto e' cercabile: nome, autore, stile, tono. */
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

  /**
   * Se un contenuto risponde alla ricerca: ogni parola della query va trovata,
   * anche a cavallo di uno spazio (si prova pure sul testo senza spazi), cosi'
   * "van gogh" pesca "Van Gogh" e "vangogh".
   */
  private matchesSearch(c: Catalogabile, query: string): boolean {
    const q = this.normalizeSearch(query);
    if (!q) return true;
    const haystack = this.searchableFields(c);
    const compatto = haystack.replace(/ /g, "");
    return q
      .split(" ")
      .every((tok) => !tok || haystack.includes(tok) || compatto.includes(tok));
  }

  /** Il tono di un contenuto: quello della visita o della descrizione; l'opera non ne ha. */
  private levelOf(c: Catalogabile): string {
    if (isVisit(c)) return c.level || "";
    if (isArtwork(c)) return "";
    return c.educationalLevel || "";
  }

  /** I toni davvero presenti nel museo, in ordine di vocabolario: per popolare un menu. */
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

  // **********************************************************************
  //                        Libreria e acquisti
  // **********************************************************************

  /**
   * Se il contenuto e' gia' della persona: sue le proprie descrizioni da autore,
   * suoi gli itinerari che ha composto da visitatore, e tutto quel che ha nella
   * collezione.
   */
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

  /** Solo il visitatore ha un portafoglio: autore e curatore non comprano. */
  canBuy(): boolean {
    return this.currentUserRole === "visitatore";
  }

  /** Perche' una visita che si possiede non e' ancora percorribile: le mancano tappe a pagamento. */
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
   * Se un contenuto si mostra a chi guarda. Si nasconde per due motivi, con la
   * stessa eccezione (chi l'ha scritto lo vede sempre): la parola chiave, che
   * apre una guidata senza passare dalla vetrina, e il privato, l'itinerario che
   * un visitatore tiene per se'.
   */
  private visibleInMarket(c: any): boolean {
    if (!c) return true;
    if (c.accessKey) return c.author === this.currentUser;
    if (c.visibility === "privato") return c.author === this.currentUser;
    return true;
  }

  /** Aggiunge alla libreria. Passa dalla conferma solo se c'e' davvero da pagare. */
  async buy(item: Content) {
    if (!this.currentUser || this.inLibrary(item)) return;
    if ((item as any).accessKey) return;
    // A dire se c'e' da pagare e' il conto vero: una visita gratis puo' avere
    // tappe a pagamento, e prenderla in silenzio svuoterebbe il portafoglio.
    if (this.costoDi(item) === 0) {
      await this.performPurchase(item);
      return;
    }
    this.itemToBuy = item;
    this.confirmOpen = true;
  }

  /** Esegue l'acquisto: aggiorna portafoglio e collezione, rilegge i conti delle visite. */
  private async performPurchase(item: Content) {
    if (!this.currentUser) return;
    try {
      const u = await ArtAPI.buy(item["@id"]);
      this.wallet = typeof u.wallet === "number" ? u.wallet : 0;
      this.userCollection = u.collezione;
      // Il testo puo' essere gia' stato chiesto quando non lo si poteva leggere,
      // ed e' arrivato vuoto: si dimentica di averlo chiesto, cosi' si riprende.
      if (isItem(item) && item.about && typeof item.about === "object") {
        const qid = item.about.qid;
        const i = this.artworksWithText.indexOf(qid);
        if (i >= 0) this.artworksWithText.splice(i, 1);
      }
      // I conti delle visite sono del server e ora sono vecchi di un acquisto:
      // si rileggono invece di correggerli qui.
      await this.reloadVisits();
      const nome = this.contentName(item) || "Contenuto";
      this.showToast(`"${nome}" è ora nella tua libreria.`);
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }
  }

  /**
   * Quanto costa prendere questo contenuto adesso. Lo dice il server: per una
   * visita e' `totale` (tolto quel che gia' possiedi), per una descrizione il
   * suo prezzo.
   */
  costoDi(content: any): number {
    if (!content) return 0;
    if (typeof content.totale === "number") return content.totale;
    return Number(content.price) || 0;
  }

  /**
   * Cosa scrivere al posto del prezzo di una visita: "Pubblicata da te" se l'hai
   * scritta, "Acquistato" se e' tua per acquisto, altrimenti `totale` (non
   * `price`, che una visita di catalogo ha a zero anche con tappe a pagamento).
   * A visita gia' acquisita `costoDi` e' zero, e senza questo direbbe "Gratis".
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

  /** Riscarica le visite del museo e riallinea l'indice: dopo un acquisto i conti cambiano. */
  async reloadVisits() {
    const qid = this.selectedMuseum ? this.selectedMuseum.qid : "";
    if (!qid) return;
    this.visits = await ArtAPI.fetchVisite(qid);
    this.reindicizza();
  }

  /** L'etichetta del bottone di sblocco nella striscia "Riprendi". */
  unlockVisitLabel(v: any): string {
    return `Sblocca (€ ${(Number(v.costoMancanti) || 0).toFixed(2)})`;
  }

  /** Se una visita si puo' percorrere adesso: e' in libreria e non le manca nessuna tappa. */
  visitUsable(visit: any): boolean {
    return this.inLibrary(visit) && this.mancantiDi(visit) === 0;
  }

  /** Apre la conferma per sbloccare in blocco le tappe mancanti di una visita. */
  openCompleteVisit(visit: any) {
    if (!this.currentUser || this.mancantiDi(visit) === 0) return;
    this.visitToComplete = visit;
    this.confirmOpen = true;
  }

  // **********************************************************************
  //                     Eliminazioni e conferme
  // **********************************************************************

  /**
   * Se mostrare il bottone che elimina una visita: la vede chi l'ha scritta e il
   * curatore. Sono le stesse condizioni che il server verifica; qui decidono
   * solo cosa disegnare, la rotta e' protetta comunque.
   */
  canDeleteVisit(visit: any): boolean {
    if (!visit || !this.currentUser) return false;
    if (this.currentUserRole === "curatore") return true;
    return visit.author === this.currentUser;
  }

  /** Come `canDeleteVisit`, per una descrizione. */
  canDeleteItem(item: any): boolean {
    if (!item || !this.currentUser) return false;
    if (this.currentUserRole === "curatore") return true;
    return item.author === this.currentUser;
  }

  /** Apre la conferma di eliminazione di una visita. */
  openDeleteVisit(visit: any) {
    if (!this.canDeleteVisit(visit)) return;
    this.visitToDelete = visit;
    this.confirmOpen = true;
  }

  /**
   * Apre la conferma per eliminare una descrizione dalla pagina dell'opera.
   * Chiede prima l'impatto, come la tabella del curatore: quel che sparisce si
   * legge prima di confermare, non dopo.
   */
  async openDeleteItem(item: any) {
    if (!this.canDeleteItem(item)) return;
    this.itemToDelete = {
      id: item["@id"],
      name: this.contentName(item) || item["@id"],
    };
    this.itemImpact = null;
    this.confirmOpen = true;
    try {
      this.itemImpact = await ArtAPI.impattoItem(item["@id"]);
    } catch (e) {
      this.itemImpact = null;
      this.showToast((e as Error).message, "error");
    }
  }

  /** Il titolo della finestra di conferma, scelto in base a cosa si sta per fare. */
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

  /**
   * Il corpo della finestra di conferma. Per le eliminazioni ripete per esteso
   * cosa sparisce -- visite toccate, adozioni perse -- perche' e' l'ultima
   * occasione per leggerlo; per un acquisto scompone il totale fra curatela
   * della visita e tappe a pagamento, o sembrerebbe il prezzo sbagliato.
   */
  confirmMessage(): string {
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
          visite.length === 1 ? "una visita" : `${visite.length} visite`;
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
   * I nomi delle visite in gioco, al massimo tre e le altre contate: in un museo
   * grande la stessa opera sta in venti percorsi, e venti nomi spingono i
   * bottoni della conferma fuori dallo schermo.
   */
  private elencoVisite(visite: { name: string }[]): string {
    const nomi = visite
      .slice(0, 3)
      .map((v) => `"${v.name}"`)
      .join(", ");
    if (visite.length <= 3) return nomi;
    return this.t("{nomi} e altre {n}", { nomi, n: visite.length - 3 });
  }

  /** Le visite che contengono quel che si sta togliendo, e quante resterebbero vuote. */
  visiteInGioco(): { id: string; name: string }[] {
    if (this.operaToDelete && this.operaImpact)
      return this.operaImpact.visite || [];
    if (this.itemToDelete && this.itemImpact)
      return (this.itemImpact as any).visite || [];
    return [];
  }

  /** Di quelle in gioco, quali resterebbero senza tappe e sparirebbero comunque. */
  visiteSvuotate(): { id: string; name: string }[] {
    if (this.operaToDelete && this.operaImpact)
      return this.operaImpact.svuotate || [];
    if (this.itemToDelete && this.itemImpact)
      return (this.itemImpact as any).svuotate || [];
    return [];
  }

  /** Sceglie se le visite toccate vanno accorciate o eliminate. */
  scegliVisite(modo: "accorcia" | "elimina") {
    this.visiteScelta = modo;
  }

  /** Cosa comporta ciascuna delle due scelte, scritto per esteso sotto i due bottoni. */
  esitoScelta(modo: "accorcia" | "elimina"): string {
    const quante = this.visiteInGioco().length;
    const vuote = this.visiteSvuotate().length;
    if (modo === "elimina") {
      return quante === 1
        ? this.t(
            "La visita sparisce, anche dalle librerie di chi l'aveva presa.",
          )
        : this.t(
            "Tutte e {n} spariscono, anche dalle librerie di chi le aveva prese.",
            { n: quante },
          );
    }
    if (vuote === 0) {
      return quante === 1
        ? this.t("La visita perde una tappa e resta percorribile.")
        : this.t("Le {n} visite perdono una tappa e restano percorribili.", {
            n: quante,
          });
    }
    return this.t(
      "Le altre perdono una tappa e restano percorribili; {n} resterebbero senza tappe e spariscono comunque.",
      { n: vuote },
    );
  }

  /** Il verbo sul bottone che conferma, scelto in base a cosa si sta per fare. */
  confirmVerb(): string {
    if (this.museoToWipe) return this.t("Svuota il museo");
    if (this.operaToDelete) return this.t("Rimuovi dal catalogo");
    if (this.itemToDelete) return "Elimina";
    if (this.visitToDelete) return "Elimina";
    if (this.visitToComplete) return "Sblocca tutto";
    return "Acquista";
  }

  /** Se il bottone di conferma e' attivo: per le eliminazioni, quando l'impatto e' arrivato. */
  confirmReady(): boolean {
    if (this.museoToWipe) return this.overview !== null;
    if (this.operaToDelete) return this.operaImpact !== null;
    if (this.itemToDelete) return this.itemImpact !== null;
    return true;
  }

  /** Chiude la finestra e azzera ogni bersaglio in sospeso. */
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

  /**
   * Esegue l'azione confermata: rimozione opera, svuotamento museo, eliminazione
   * di descrizione o visita, sblocco delle tappe mancanti, o acquisto. Chiude la
   * finestra subito e poi ricarica quel che l'azione ha toccato.
   */
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
            {
              opera: esito.nome,
              n: esito.descrizioni,
              a: accorciate,
              v: sparite,
            },
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
          this.t(
            "{museo} svuotato: {opere} opere, {item} descrizioni, {visite} visite.",
            {
              museo: esito.museo,
              opere: esito.opere,
              item: esito.item,
              visite: esito.visite,
            },
          ),
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
        // Il curatore ricarica i suoi conteggi, gli altri il catalogo: la
        // descrizione e' ancora nella pagina dell'opera, e le visite accorciate
        // portano una tappa in meno.
        if (this.currentUserRole === "curatore") await this.loadMuseumState();
        else await this.loadCatalogue();
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
        this.visits = this.visits.filter((c: any) => c["@id"] !== visit["@id"]);
        this.reindicizza();
        this.userCollection = this.userCollection.filter(
          (id) => id !== visit["@id"],
        );
        this.showToast("Visita eliminata.");
        if (this.currentUserRole === "curatore") await this.loadMuseumState();
        // Si va via solo dalla pagina della visita eliminata, che senza il suo
        // documento resterebbe vuota. Da un elenco si resta dove si era.
        if (this.view === "visita") this.goHome();
      } catch (e) {
        this.showToast((e as Error).message, "error");
      }
      return;
    }

    // Completare non e' ricomprare la visita: `buy` prende sempre e solo quel
    // che non hai, e la visita, gia' tua, non entra nel conto. Tutte le tappe
    // mancanti in un colpo: una richiesta per tappa lascerebbe pagati a meta'.
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

  // **********************************************************************
  //                        Gestione del museo
  // **********************************************************************

  /** Carica quadro d'insieme, catalogo curato e visite: i dati delle schermate del curatore. */
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

  /** La quota di opere del museo coperte da una riga di copertura, in percento. */
  percentualeCopertura(riga: { opere: number }): number {
    if (!this.overview) return 0;
    const totale = this.overview.copertura.opereTotali;
    if (!totale) return 0;
    return Math.round((riga.opere / totale) * 100);
  }

  /** "3 autori · 40 visitatori · 1 curatore": il conto degli account del museo. */
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

  /**
   * Cambia la specie di riga elencata e azzera i filtri che perdono senso. Il
   * filtro sul soggetto vale solo dove in tabella ci sono descrizioni: lasciarlo
   * acceso altrove filtrerebbe di nascosto.
   */
  setCatalogType(tipo: "tutti" | "opere" | "descrizioni" | "visite") {
    this.catalogTypeFilter = tipo;
    this.catalogDurationFilter = "tutti";
    if (tipo === "opere" || tipo === "visite")
      this.catalogSubjectFilter = "tutti";
  }

  /** Cambia il filtro sul soggetto: opere o soggetti del museo (autori, stili). */
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
   * Le voci del filtro durata: secondi di lettura per le descrizioni, fasce di
   * minuti per le visite. Le stesse della vetrina e dalla stessa tabella
   * (`visitDurationBands`), cosi' le due schermate dividono il catalogo con le
   * stesse parole.
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

  /** L'etichetta della specie di riga: Opera, Visita o Descrizione. */
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

  /** Le visite del museo scelto. */
  private curatedVisits(): Visit[] {
    return this.visits.filter((v) => this.belongsToMuseum(v));
  }

  /** I nomi di chi ha scritto qualcosa nel museo, in ordine alfabetico: per il filtro autore. */
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

  /** La durata di una riga: secondi esatti per una descrizione, minuti per una visita. */
  durationLabel(row: any): string {
    if (row.kind === "opera") return "n/d";
    if (row.kind === "item") return `${row.duration} s`;
    return this.readableDuration(row.duration);
  }

  /** Se una riga rientra nel filtro durata: secondi esatti per gli item, fasce per le visite. */
  private matchesCatalogDuration(row: any): boolean {
    if (this.catalogDurationFilter === "tutti") return true;
    if (row.kind === "item")
      return String(row.duration) === this.catalogDurationFilter;
    const banda = visitDurationBands.find(
      (b) => b.value === this.catalogDurationFilter,
    );
    if (!banda) return true;
    return banda.test(durationMinutes(row.duration));
  }

  /**
   * Le righe della tabella del catalogo del curatore: opere, descrizioni e
   * visite del museo mescolate in un elenco solo, poi passate per i filtri di
   * specie, soggetto, tono, autore, durata e testo. Tono, autore e durata sono
   * domande sui contenuti: con uno acceso le opere escono, non "non corrispondono".
   */
  catalogRows(): CatalogRow[] {
    const cerca = this.catalogSearch.trim().toLowerCase();
    const rows: CatalogRow[] = [];

    if (
      this.catalogTypeFilter === "tutti" ||
      this.catalogTypeFilter === "opere"
    ) {
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
    if (
      this.catalogTypeFilter === "tutti" ||
      this.catalogTypeFilter === "descrizioni"
    ) {
      for (const it of this.curatedItems) {
        // Il `kind` dell'item e' il genere del suo soggetto (opera, stile,
        // artista...), da non confondere col `kind` della riga.
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
    if (
      this.catalogTypeFilter === "tutti" ||
      this.catalogTypeFilter === "visite"
    ) {
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
      const filtriDiContenuto =
        this.catalogToneFilter !== "tutti" ||
        this.catalogAuthorFilter !== "tutti" ||
        this.catalogDurationFilter !== "tutti";
      if (r.kind === "opera") {
        if (filtriDiContenuto) return false;
      } else {
        if (
          this.catalogToneFilter !== "tutti" &&
          r.tone !== this.catalogToneFilter
        )
          return false;
        if (
          this.catalogAuthorFilter !== "tutti" &&
          r.author !== this.catalogAuthorFilter
        )
          return false;
        if (!this.matchesCatalogDuration(r)) return false;
      }
      if (!cerca) return true;
      const dove =
        `${r.name} ${r.author} ${r.tone} ${r.qid || ""}`.toLowerCase();
      return dove.includes(cerca);
    });
  }

  /**
   * Apre la conferma di svuotamento del museo. Riusa la stessa finestra delle
   * altre eliminazioni, coi numeri del quadro d'insieme gia' a schermo.
   */
  openWipeMuseum() {
    if (!this.selectedMuseum) return;
    this.museoToWipe = this.selectedMuseum;
    this.confirmOpen = true;
  }

  /**
   * Aggiunge un'opera al museo dal solo qid di Wikidata: il server ne ricava
   * nome, autore, stile e immagine. Non nascono descrizioni -- quelle le scrive
   * il seed o un autore -- e due avvisi possibili non bloccano l'inserimento:
   * nessun nodo con quel qid sulla mappa, o Wikidata che non la da' nel museo.
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
      const avvisi: string[] = [];
      if (!esito.sullaMappa)
        avvisi.push(
          this.t(
            "sulla mappa non c'è un nodo con questo codice, quindi non comparirà nella piantina",
          ),
        );
      if (esito.nelMuseo === false)
        avvisi.push(
          this.t("Wikidata non la dà nella collezione di questo museo"),
        );

      if (avvisi.length === 0) {
        this.showToast(
          this.t("{opera} aggiunta al catalogo.", {
            opera: esito.artwork.name,
          }),
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

  /** Apre la conferma di rimozione di un'opera e ne chiede intanto l'impatto. */
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

  /** Apre la conferma giusta per una riga della tabella, a seconda della sua specie. */
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

  // **********************************************************************
  //                Etichette e inneschi dai binding
  // **********************************************************************

  /** L'id del messaggio d'errore da collegare al campo conferma password, o `null`. */
  confirmPasswordErrorId(): string | null {
    const f = this.registerForm;
    if (f.conferma && f.password !== f.conferma) return "reg-conf-err";
    return null;
  }

  /** Il testo del bottone d'acquisto sulla pagina di una visita. */
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

  /** Il testo del bottone che sblocca in blocco le tappe mancanti di una visita. */
  unlockMissingLabel(): string {
    const v = this.currentVisit();
    if (!v) return "";
    const quanti = this.mancantiDi(v);
    const costo = (Number(v.costoMancanti) || 0).toFixed(2);
    return `Sblocca ${quanti} contenuti mancanti (€ ${costo})`;
  }

  /** L'etichetta accessibile del bottone che apre o chiude una descrizione. */
  toggleDescriptionLabel(it: Item): string {
    const verbo = this.openItems.includes(it["@id"]) ? "Chiudi" : "Leggi";
    return `${verbo} la descrizione ${it.educationalLevel}`;
  }

  /** L'etichetta accessibile del bottone che aggiunge una descrizione al percorso. */
  addToPathLabel(it: Item, artworkName: string): string {
    const verbo = this.itemInVisit(it["@id"])
      ? "Già nel percorso"
      : "Aggiungi al percorso";
    return `${verbo}: ${it.educationalLevel} di ${artworkName}`;
  }

  /** L'etichetta accessibile del bottone che rende una tappa opzionale o obbligatoria. */
  toggleOptionalLabel(opzionale: boolean, index: number): string {
    const verbo = opzionale ? "Rendi obbligatoria" : "Rendi opzionale";
    return `${verbo} la tappa ${this.stopNumber(index)}`;
  }

  /** La coda della frase "N opera/e non ha/nno nessuna descrizione", concordata al numero. */
  senzaDescrizioneLabel(): string {
    if (!this.overview) return "";
    const n = this.overview.copertura.senzaDescrizione.length;
    if (n === 1) return " opera non ha nessuna descrizione:";
    return " opere non hanno nessuna descrizione:";
  }

  /** Le tre voci del filtro della libreria del compositore. */
  editorFilterOptions(): { v: string; t: string }[] {
    return [
      { v: "tutti", t: "Tutte" },
      { v: "disponibili", t: "Che possiedo" },
      { v: "da_acquistare", t: "Da sbloccare" },
    ];
  }

  /**
   * Carica le vendite se si e' su quella schermata. Va chiamata da due inneschi
   * nel markup, il `$watch` e il caso iniziale: entrando in /vendite
   * dall'indirizzo diretto il `$watch` non scatta.
   */
  watchSales() {
    if (this.view === "vendite") this.loadSales();
  }

  /** Mostra un avviso a scomparsa; quello prima viene sostituito. */
  showToast(messaggio: string, tipo: "success" | "error" = "success") {
    this.toast = { messaggio, tipo };
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = null;
    }, 5500);
  }

  /** Chiude subito l'avviso. */
  closeToast() {
    this.toast = null;
  }

  // **********************************************************************
  //                     Vetrina: visite e opere
  // **********************************************************************

  /** La durata di una visita in minuti interi. */
  private visitMinutes(v: any): number {
    return Math.round((Number(v.duration) || 0) / 60);
  }

  /** Una durata in secondi resa in minuti tradotti ("12 min", "meno di 1 min"). */
  readableDuration(secondi: number): string {
    const minuti = durationMinutes(secondi);
    if (minuti < 1) return this.t("meno di 1 min");
    return this.t("{n} min", { n: minuti });
  }

  /** "3 tappe · 12 min · Misto": il sottotitolo di una visita in elenco. */
  visitSummary(v: any): string {
    const tappe = (v.itemListElement || []).length;
    const parts = [
      tappe === 1 ? this.t("1 tappa") : this.t("{n} tappe", { n: tappe }),
      this.readableDuration(v.duration),
    ];
    // Il tono si legge tradotto ma si confronta in italiano: il valore crudo e'
    // quello nel database e nei filtri, tradurlo li' spegnerebbe la ricerca.
    const livello = this.visitLevelLabel(v);
    if (livello) parts.push(livello);
    return parts.join(" · ");
  }

  /** Cambia l'asse della vetrina (tutti, visite, opere, soggetti) e azzera la durata. */
  setMarketType(tipo: "tutti" | "visite" | "opere" | "meta") {
    this.marketType = tipo;
    this.marketDurationFilter = "tutti";
  }

  /**
   * Se un gruppo parla di un soggetto che opera non e' (stile, artista, periodo):
   * lo si vede dal `kind` che `soggettoDi` mette nella tessera e che un'opera
   * vera non ha. E' lo stesso controllo che conta le due specie nel riepilogo.
   */
  private isSoggetto(g: any): boolean {
    return !!(g && g.artwork && g.artwork.kind);
  }

  /** Le voci del filtro durata della vetrina: secondi per opere e soggetti, fasce per le visite. */
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

  /** Se una visita cade nella fascia di durata scelta in vetrina. */
  private matchesMarketDuration(min: number): boolean {
    if (this.marketType !== "visite") return true;
    const banda = visitDurationBands.find(
      (b) => b.value === this.marketDurationFilter,
    );
    if (!banda) return true;
    return banda.test(min);
  }

  /**
   * I toni distinti presenti nelle tappe di una visita. Si guardano le tappe e
   * non `Visit.level`, che per una visita composta a mano dice "Personalizzata".
   */
  visitTones(v: any): string[] {
    const toni = new Set<string>();
    for (const id of v.itemListElement || []) {
      const it = this.findItem(id);
      if (it && isItem(it) && it.educationalLevel)
        toni.add(it.educationalLevel);
    }
    if (toni.size === 0 && v.level) toni.add(v.level);
    return [...toni];
  }

  /** Se una visita mescola piu' toni. */
  isMixedVisit(v: any): boolean {
    return this.visitTones(v).length > 1;
  }

  /** Il tono di una visita da mostrare, tradotto: "Misto" se ne mescola piu' d'uno. */
  visitLevelLabel(v: any): string {
    if (this.isMixedVisit(v)) return this.t("Misto");
    const toni = this.visitTones(v);
    if (toni.length === 1) return this.t(toni[0]);
    if (v.level) return this.t(v.level);
    return "";
  }

  /**
   * Il filtro tono della vetrina prende le visite che sono TUTTE di quel tono; la
   * voce "misto" prende quelle che ne mescolano piu' d'uno. Cosi' chi cerca un
   * percorso semplice non si vede offrire una visita mezza avanzata, e le miste
   * restano comunque raggiungibili dalla loro voce.
   */
  private matchesMarketLevel(tones: string[]): boolean {
    if (this.marketLevelFilter === "tutti") return true;
    if (this.marketLevelFilter === "misto") return tones.length > 1;
    return tones.length === 1 && tones[0] === this.marketLevelFilter;
  }

  /** Le visite da mostrare in vetrina: quelle del museo passate per ricerca, tono e durata. */
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
   * L'identita' del soggetto di un contenuto, per raggrupparlo e indirizzarlo.
   * Un'opera ha un `@id`; un soggetto scritto a mano vale genere + nome, cosi'
   * due autori che scrivono di "Manierismo" finiscono sulla stessa pagina.
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

  /** Le descrizioni che chi guarda puo' vedere: quelle del museo, piu' le proprie se autore. */
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

  /** Raccoglie una lista di descrizioni in gruppi per soggetto. */
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

  /**
   * I gruppi da mostrare in vetrina, filtrati per tono e durata e poi divisi fra
   * opere e soggetti secondo l'asse scelto; la ricerca si applica sul soggetto.
   */
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
    return groups.filter((g) =>
      this.matchesSearch(g.artwork, this.marketSearch),
    );
  }

  /** "3 visite · 15 opere · 2 soggetti": il conto di quel che la vetrina sta mostrando. */
  marketSummary(): string {
    const v = this.shownVisits().length;
    const gruppi = this.shownArtworks();
    // Opere e soggetti si contano a parte: un soggetto non e' un'opera.
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
      else if (soggetti > 1)
        pezzi.push(this.t("{n} soggetti", { n: soggetti }));
    }
    return pezzi.join(" · ");
  }

  /** Se la vetrina non mostra niente, ne' visite ne' opere. */
  marketEmpty(): boolean {
    return this.shownVisits().length === 0 && this.shownArtworks().length === 0;
  }

  /** Se in vetrina c'e' un filtro o una ricerca attiva (per mostrare "azzera"). */
  marketFiltered(): boolean {
    return (
      this.marketSearch.trim() !== "" ||
      this.marketType !== "tutti" ||
      this.marketLevelFilter !== "tutti" ||
      this.marketDurationFilter !== "tutti"
    );
  }

  /** Riporta ricerca e filtri della vetrina allo stato iniziale. */
  resetMarketFilters() {
    this.marketSearch = "";
    this.marketType = "tutti";
    this.marketLevelFilter = "tutti";
    this.marketDurationFilter = "tutti";
  }

  /**
   * Quante descrizioni ha un'opera. Frase separata dal prezzo (`artworkFromPrice`)
   * perche' le due portano colori diversi in tessera: il conto e' una categoria,
   * il prezzo un valore.
   */
  artworkCount(g: ArtworkGroup): string {
    const n = g.items.length;
    if (n === 1) return this.t("1 descrizione");
    return this.t("{n} descrizioni", { n });
  }

  /** "Gratis" o "da € X": il prezzo piu' basso fra le descrizioni di un'opera. */
  artworkFromPrice(g: ArtworkGroup): string {
    const prices = g.items.map((i: any) => Number(i.price) || 0);
    const cheapest = prices.length ? Math.min(...prices) : 0;
    if (cheapest === 0) return this.t("Gratis");
    return this.t("da {prezzo}", { prezzo: `€ ${cheapest.toFixed(2)}` });
  }

  // **********************************************************************
  //                       Pagina di un'opera
  // **********************************************************************

  /**
   * Il soggetto della pagina aperta: un'opera del catalogo, o ricostruito dai
   * contenuti che ne parlano. Se nessuno ne parla piu', la pagina non c'e'.
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

  /** Le descrizioni dell'opera aperta, ordinate per tono. */
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

  /**
   * Tono e durata della pagina di un'opera, con una memoria propria e non quella
   * della vetrina: la durata della vetrina, per le visite, e' una fascia di
   * minuti che qui non corrisponde a nessuna descrizione, e arrivando da una
   * vetrina filtrata l'opera si aprirebbe vuota.
   */
  artworkLevelFilter: string = "tutti";
  artworkDurationFilter: string = "tutti";

  /** I toni presenti fra le descrizioni di quest'opera: le voci del menu, non il vocabolario intero. */
  artworkLevels(): string[] {
    const presenti = new Set<string>();
    for (const i of this.artworkItems()) presenti.add(i.educationalLevel);
    return educationalLevels.filter((l) => presenti.has(l));
  }

  /** Le durate presenti fra le descrizioni di quest'opera, in secondi. */
  artworkDurations(): number[] {
    const presenti = new Set<string>();
    for (const i of this.artworkItems()) presenti.add(String(i.timeRequired));
    return secPerArt.filter((s) => presenti.has(String(s)));
  }

  /** Le descrizioni dell'opera che passano i suoi filtri di tono e durata. */
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

  /** Quante descrizioni si vedono adesso sulla pagina dell'opera. */
  artworkItemsCount(): string {
    const n = this.shownArtworkItems().length;
    if (n === 1) return this.t("1 descrizione");
    return this.t("{n} descrizioni", { n });
  }

  /** Se la pagina dell'opera ha un filtro attivo. */
  artworkFiltered(): boolean {
    return (
      this.artworkLevelFilter !== "tutti" ||
      this.artworkDurationFilter !== "tutti"
    );
  }

  /** Azzera i filtri della pagina dell'opera. */
  resetArtworkFilters() {
    this.artworkLevelFilter = "tutti";
    this.artworkDurationFilter = "tutti";
  }

  /**
   * La classe CSS della pastiglia di un tono, ricavata dal nome del tono invece
   * che da una tabella parallela. Un tono senza riga in `components.css` esce
   * come pastiglia neutra: il colore conferma soltanto, il nome sta dentro.
   */
  toneClass(livello: string | undefined): string {
    if (!livello) return "";
    return "pastiglia-tono-" + livello.toLowerCase();
  }

  // **********************************************************************
  //                   Generi, figure e link
  // **********************************************************************

  /**
   * I generi di contenuto e i soggetti che il museo gia' nomina (stili e autori
   * delle sue opere). I secondi sono suggerimenti, non un elenco chiuso: si puo'
   * scrivere di un soggetto nuovo, e lo si ritrova dalla pagina dell'opera.
   */
  itemKinds = itemKinds;
  museumTopics: { name: string; kind: string }[] = [];

  /** Il tetto agli itinerari di un visitatore, per i binding che lo scrivono. */
  maxVisiteVisitatore = MAX_VISITE_VISITATORE;

  /** I nomi suggeriti per il genere scelto nella bozza. Un periodo o un evento non ne hanno. */
  topicSuggestions(): string[] {
    const genere = this.draft.genere;
    const nomi: string[] = [];
    for (const t of this.museumTopics) {
      if (t.kind === genere) nomi.push(t.name);
    }
    return nomi;
  }

  /**
   * La copertina di una visita, se chi l'ha composta ne ha caricata una. Vuoto e'
   * il caso normale: senza immagine la tessera resta il titolo sulla struttura.
   * Non si ripiega sulla prima tappa, o le visite di catalogo di un museo -- le
   * stesse opere nello stesso ordine -- uscirebbero tutte con la stessa foto.
   */
  visitImage(v: any): string {
    if (!v) return "";
    return v.imagePath || "";
  }

  /**
   * La copertina di un museo, se il curatore gliene ha messa una accanto alla
   * configurazione. Vuoto quando non c'e', e la carta resta di solo testo:
   * aggiungere un museo non deve avere un requisito grafico. L'indirizzo si
   * codifica perche' quei file prendono il nome del museo, spazi compresi.
   */
  museumImage(m: any): string {
    if (!m || !m.imagePath) return "";
    return encodeURI(m.imagePath);
  }

  /** Carica l'immagine della bozza: il file lo scrive il server, che risponde con l'indirizzo. */
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
   * L'indirizzo della pagina di uno stile o di un autore. Vuoto se nessuno ne ha
   * ancora scritto: un link a una pagina vuota e' peggio di nessun link.
   */
  soggettoLink(nome: string, genere: string): string {
    if (!nome || nome === "Unknown") return "";
    const chiave = `${genere}:${nome}`;
    for (const i of this.visibleItems()) {
      if (this.soggettoIdOf(i) === chiave)
        return `/opera/${encodeURIComponent(chiave)}`;
    }
    return "";
  }

  /** Il nome di un genere quando lo si mostra da solo. */
  kindName(id: string): string {
    const genere = kindById(id);
    if (genere) return genere.name;
    return "";
  }

  /* I quattro metodi che seguono sono espressioni corte tenute fuori dal markup:
   * i binding di Alpine sono stringhe che nessun compilatore controlla. */

  /** Il nome dell'autore dell'opera aperta, vuoto se Wikidata lascia solo un nodo anonimo. */
  nomeAutore(): string {
    const a: any = this.currentArtwork();
    if (!a || !a.author || !a.author.name) return "";
    if (a.author.name.startsWith("http")) return "";
    return a.author.name;
  }

  /** Il nome dello stile dell'opera aperta. */
  nomeStile(): string {
    const a: any = this.currentArtwork();
    if (a && a.style && a.style.name) return a.style.name;
    return "";
  }

  /** L'indirizzo della pagina dell'autore dell'opera aperta. */
  linkAutore(): string {
    return this.soggettoLink(this.nomeAutore(), "artista");
  }

  /** L'indirizzo della pagina dello stile dell'opera aperta. */
  linkStile(): string {
    return this.soggettoLink(this.nomeStile(), "stile");
  }

  // **********************************************************************
  //                  Pagina di un'opera: i testi
  // **********************************************************************

  openItems: string[] = [];
  /** Le opere di cui si sono gia' chiesti i testi: non si richiedono due volte. */
  artworksWithText: string[] = [];

  /**
   * Apre o chiude una descrizione. Aprendola, ne chiede il testo: se e' di
   * un'opera prende tutti i testi di quell'opera (`caricaTesti`), altrimenti
   * solo il suo. L'opera si ricava dalla descrizione, cosi' funziona da
   * qualunque schermata.
   */
  async toggleItem(id: string) {
    const i = this.openItems.indexOf(id);
    if (i >= 0) return this.openItems.splice(i, 1);
    this.openItems.push(id);
    const item = this.findItem(id);
    if (!item || !isItem(item)) return;
    const art = item.about;
    if (art && typeof art === "object") {
      await this.caricaTesti(art.qid);
      return;
    }
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
   * gia' in memoria. Testo assente (`text` non c'e' ancora) e testo negato
   * (`text: ""` con `locked`, per una descrizione a pagamento non comprata) sono
   * distinti: solo il primo si rimedia richiedendolo.
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

  // **********************************************************************
  //                     Pagina di una visita
  // **********************************************************************

  /** La visita della pagina aperta, o `null`. */
  currentVisit(): Visit | null {
    if (this.view !== "visita" || !this.param) return null;
    return this.visits.find((v) => v["@id"] === this.param) || null;
  }

  /** Le tappe di una visita, ognuna col suo numero, nome, item e se e' opzionale. */
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

  /** Le note logistiche ancorate a una certa tappa. */
  notesAfter(v: any, itemId: string): string[] {
    const notes: string[] = [];
    for (const n of v.logistics || []) {
      if (n && typeof n === "object" && n.after === itemId && n.text)
        notes.push(n.text);
    }
    return notes;
  }

  /** Le note logistiche d'apertura: quelle senza tappa a cui appoggiarsi. */
  openingNotes(v: any): string[] {
    const notes: string[] = [];
    for (const n of v.logistics || []) {
      if (typeof n === "string" && n.trim() !== "") notes.push(n);
      else if (n && typeof n === "object" && !n.after && n.text)
        notes.push(n.text);
    }
    return notes;
  }

  // **********************************************************************
  //                    Libreria e "I miei contenuti"
  // **********************************************************************

  /** Le visite nella libreria del visitatore, filtrate dalla sua ricerca. */
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

  /** Le descrizioni possedute dal visitatore, raggruppate per opera e filtrate dalla ricerca. */
  myItemGroups(): { artwork: any; items: any[] }[] {
    const posseduti = this.visibleItems().filter(
      (i: any) =>
        this.inLibrary(i) && this.matchesSearch(i, this.librarySearch),
    );
    return this.groupByArtwork(posseduti);
  }

  /** Le descrizioni scritte dall'autore in questo museo, raggruppate per opera. */
  workItemGroups(): { artwork: any; items: any[] }[] {
    if (this.worksTypeFilter === "visite") return [];
    const items = this.myItems.filter(
      (i) => this.belongsToMuseum(i) && this.matchesSearch(i, this.worksSearch),
    );
    return this.groupByArtwork(items);
  }

  /** Le visite scritte dall'autore in questo museo. */
  workVisits(): any[] {
    if (this.worksTypeFilter === "item") return [];
    return this.visits.filter(
      (v) =>
        v.author === this.currentUser &&
        this.belongsToMuseum(v) &&
        this.matchesSearch(v, this.worksSearch),
    );
  }

  /** Quante volte un contenuto e' stato adottato, o `null` se non e' fra le vendite. */
  adoptionsOf(id: string): number | null {
    const riga = this.sales.find((r: any) => r.id === id);
    return riga ? riga.adozioni : null;
  }

  // **********************************************************************
  //                     Bozza: soggetto e anteprima
  // **********************************************************************

  /**
   * Il soggetto della bozza, da tenere sott'occhio mentre si scrive: l'opera del
   * catalogo se il genere e' "opera", altrimenti la bozza stessa (nome e
   * immagine caricata), perche' li' il soggetto non esiste altrove.
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
   * Le righe sotto il nome del soggetto della bozza: autore e stile per un'opera,
   * il genere per il resto. Si salta quel che il catalogo non sa: Wikidata
   * scrive "Unknown", e stamparlo fa sembrare rotta una scheda solo incompleta.
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

  /** La figura grande di un'opera: la copia locale, o l'indirizzo remoto se manca. */
  artworkImage(about: any): string {
    if (!about || typeof about !== "object") return "";
    return about.imagePath || about.imageUri || "";
  }

  /**
   * La versione in piccolo di una figura, per tessere e righe d'elenco: dove la
   * casella e' minuscola l'originale da 960 px e' quasi tutto peso sprecato
   * sulla rete. Il nome si calcola (`percorsoMiniatura`), non si chiede: accanto
   * a ogni originale il server scrive sempre il suo `-c`.
   */
  miniatura(figura: string): string {
    return percorsoMiniatura(figura);
  }

  // **********************************************************************
  //             Navigator: passaggio all'app da museo
  // **********************************************************************

  /** L'origine del navigator: quella data dalla config, o la porta 5173 in sviluppo. */
  private navigatorBase(): string {
    if (this.navigatorOrigin) return this.navigatorOrigin;
    return `${window.location.protocol}//${window.location.hostname}:5173`;
  }

  /**
   * L'indirizzo di una visita nel navigator. Non porta identita' -- e' pensato
   * per finire in un QR su carta -- quindi chi lo inquadra da un altro telefono
   * entra da li'.
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
   * Passa al navigator coniando un biglietto per questo viaggio: vale dieci
   * minuti e una volta sola, quindi si conia adesso e non si puo' mettere in un
   * `href` preparato prima. E' l'unico modo che il navigator, su un'altra
   * origine, ha di sapere chi e' entrato. Il velo resta acceso: da qui comanda
   * il browser, e si spegne solo se il biglietto non si conia e si resta qui.
   */
  async openNavigator(url: string): Promise<boolean> {
    if (!url || url === "#") return false;
    this.loading = true;
    await this.afterPaint(); // dipingi il velo prima di occupare il filo
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

  /**
   * La porta scelta sulla soglia: marketplace o app da museo. E' un'intenzione da
   * tenere fino a dopo il login, non una seconda strada d'ingresso, perche' il
   * biglietto per il navigator si conia solo da chi ha gia' una sessione. Vive
   * in memoria e non in `localStorage`: vale per questo ingresso.
   */
  entryTarget: "marketplace" | "navigator" = "marketplace";

  /** Registra la porta scelta e manda all'accesso. */
  enterFrom(target: "marketplace" | "navigator") {
    this.entryTarget = target;
    this.goTo("accedi");
  }

  /**
   * Se la porta scelta e' l'app da museo, ci porta: senza `?visit=`, cosi' si
   * atterra nella biglietteria. Vuole un museo (`?museum=`); l'intenzione si
   * consuma solo quando il viaggio parte davvero, cosi' un biglietto non coniato
   * lascia riprovare.
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

  // **********************************************************************
  //               Visita su misura e visita guidata
  // **********************************************************************

  /** Se la richiesta a parole e' pronta da mandare al navigator. */
  customReady(): boolean {
    return this.customRequest.trim() !== "" && !!this.selectedMuseum;
  }

  /** L'indirizzo del navigator con la richiesta di una visita su misura. */
  customVisitUrl(): string {
    if (!this.customReady()) return "#";
    return (
      `${this.navigatorBase()}/` +
      `?museum=${encodeURIComponent(this.selectedMuseum!.qid)}` +
      `&custom=${encodeURIComponent(this.customRequest.trim())}`
    );
  }

  /** L'indirizzo della sala d'attesa dello studente per una visita guidata. */
  waitingRoomUrl(): string {
    if (!this.guidedSession) return "#";
    return (
      `${this.navigatorBase()}/` +
      `?guidedSession=${encodeURIComponent(this.guidedSession.id)}&role=studente`
    );
  }

  /** L'indirizzo con cui il docente apre e conduce una visita guidata. */
  startGuidedUrl(visit: any): string {
    return (
      `${this.navigatorBase()}/` +
      `?guidedVisit=${encodeURIComponent(visit["@id"])}&role=docente`
    );
  }

  /** L'indirizzo del foglio stampabile dei QR delle opere del museo. */
  qrSheetUrl(): string {
    if (!this.selectedMuseum) return "#";
    return `/api/museums/${encodeURIComponent(this.selectedMuseum.qid)}/qrcodes`;
  }

  /** Lo studente entra in una sessione guidata con la parola chiave del docente. */
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
      this.announce(
        `Sei in sala d'attesa per ${this.guidedSession.visitName}.`,
      );
    } catch (e) {
      this.guidedSession = null;
      this.showToast((e as Error).message, "error");
    }
  }

  // **********************************************************************
  //              Editor: apertura, salvataggio, compositore
  // **********************************************************************

  /** Una bozza vuota: la forma unica che serve sia a una descrizione sia a una visita. */
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

  /** Apre l'editor su una descrizione nuova. */
  openNewItem() {
    this.editingId = null;
    this.draft = this.emptyDraft();
    this.goTo("nuovo");
  }

  /** Apre l'editor su una descrizione esistente, versandola nella bozza. Solo la propria. */
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

  /** L'identita' del soggetto della bozza, nella stessa forma di `soggettoIdOf`. */
  private draftSubjectKey(): string {
    if (this.draft.genere === "opera")
      return this.draft.selectedArtworkUri || "";
    if (!this.draft.soggetto.trim()) return "";
    return `${this.draft.genere}:${this.draft.soggetto.trim()}`;
  }

  /**
   * Stima parole e secondi di lettura del testo della bozza, e li confronta con
   * la durata dichiarata per dire se e' piu' corta, piu' lunga o in linea.
   */
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

  /** Cosa manca ancora perche' una descrizione si possa pubblicare. */
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

  /** Pubblica o aggiorna una descrizione, poi ricarica e torna a "I miei contenuti". */
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

  /** Apre il compositore su una visita nuova. */
  openComposer() {
    this.editingId = null;
    this.visitStep = "percorso";
    this.editorPane = "percorso";
    this.editorSearch = "";
    this.editorFilter = "tutti";
    this.draft = this.emptyDraft();
    this.goTo("componi");
  }

  /** Apre il compositore su una visita esistente, ricostruendone la bozza. Solo la propria. */
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

  /** Ricostruisce le tappe della bozza da una visita: tappe, opzionali e note in fila. */
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

  /** Le visite da cui si puo' importare un percorso: del museo, non guidate e gratuite. */
  importableVisits(): Visit[] {
    return this.visits.filter(
      (v) =>
        this.belongsToMuseum(v) &&
        !v.accessKey &&
        (!v.price || Number(v.price) === 0),
    );
  }

  /**
   * Copia nella bozza il percorso di un'altra visita, senza toccare l'originale.
   * Non decide il tipo della visita: guidata o in vetrina resta una scelta,
   * reversibile, di chi compone.
   */
  importVisit(visitId: string) {
    if (!visitId) return;
    const src: any = this.visits.find((v) => v["@id"] === visitId);
    if (!src) return;
    this.draft.tappe = this.rebuildStops(src);
    this.editingId = null;
    if (this.currentUserRole === "autore") {
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
   * Se una descrizione si puo' leggere (regola in `shared/access.ts`). Non e'
   * `inLibrary()`: una descrizione gratuita si legge senza averla presa.
   */
  canRead(item: any): boolean {
    if (!item) return false;
    const id = item["@id"];
    return isReadable(
      item,
      this.currentUser || "",
      this.userCollection.includes(id),
    );
  }

  /**
   * Ordina i gruppi come si attraversa il museo, cosi' chi compone scegliendo
   * dall'alto in basso ottiene un percorso che non torna indietro. I soggetti
   * senza una sala restano in fondo.
   */
  private percorrenza(gruppi: { artwork: any; items: any[] }[]) {
    const posto = new Map<string, number>();
    this.availableArtworks.forEach((a: any, i: number) =>
      posto.set(a["@id"], i),
    );
    const dopo = this.availableArtworks.length;
    return [...gruppi].sort((a, b) => {
      const ia = posto.get(a.artwork["@id"]);
      const ib = posto.get(b.artwork["@id"]);
      return (ia === undefined ? dopo : ia) - (ib === undefined ? dopo : ib);
    });
  }

  /**
   * La libreria del compositore: le descrizioni disponibili, in ordine di
   * percorrenza e passate per filtro e ricerca. Per una visita guidata restano
   * solo quelle leggibili, che sono le uniche che l'autore puo' incastonare.
   */
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

  // **********************************************************************
  //                Indice dei contenuti e loro etichette
  // **********************************************************************

  /**
   * Rifa' l'indice dei contenuti, e va chiamata a ogni riassegnazione dei tre
   * elenchi: un indice fuori passo mostra il prezzo di prima di un acquisto
   * appena fatto. Si riempie in quest'ordine perche' l'ultimo `set` vince: i
   * propri contenuti, per ultimi, restano quelli che rispondono.
   */
  private reindicizza() {
    indiceContenuti.clear();
    for (const c of this.visits) indiceContenuti.set(c["@id"], c);
    for (const c of this.marketItems) indiceContenuti.set(c["@id"], c);
    for (const c of this.myItems) indiceContenuti.set(c["@id"], c);
  }

  /** Un contenuto per `@id`, o `null`. */
  findItem(id: string) {
    return indiceContenuti.get(id) || null;
  }

  /** Il nome di un contenuto dato il suo `@id`: l'opera che descrive, o il titolo della visita. */
  itemName(id: string) {
    const item = this.findItem(id);
    if (!item) return "Contenuto non disponibile";
    if (isItem(item)) {
      const art = item.about;
      return typeof art === "object" && art ? art.name : "Descrizione";
    }
    return item.name || "Senza titolo";
  }

  /** "Semplice · 60s": tono e secondi di una tappa in una frase sola, per una riga stretta. */
  itemDetail(id: string): string {
    const item = this.findItem(id);
    if (!item || !isItem(item)) return "";
    return `${item.educationalLevel} · ${item.timeRequired}s`;
  }

  /**
   * Il tono di una tappa, preso a parte da `itemSeconds`: dove la tappa e' una
   * tessera i due sono due pastiglie di colore diverso, e una stringa unica non
   * si dividerebbe.
   */
  itemTone(id: string): string {
    const item = this.findItem(id);
    if (!item || !isItem(item)) return "";
    return item.educationalLevel || "";
  }

  /** I secondi di lettura di una tappa, presi a parte dal tono. */
  itemSeconds(id: string): string {
    const item = this.findItem(id);
    if (!item || !isItem(item)) return "";
    return item.timeRequired || "";
  }

  /**
   * La figura di una tappa: l'opera che la descrizione racconta, o l'immagine
   * caricata dall'autore per un soggetto che opera non e'. Vuota va bene: la
   * riga tiene il posto lo stesso, perche' sotto resta la velatura.
   */
  itemImage(id: string): string {
    const item = this.findItem(id);
    if (!item || !isItem(item)) return "";
    if (item.about) return this.artworkImage(item.about);
    return item.imagePath || "";
  }

  // **********************************************************************
  //               Compositore: tappe, durata, quiz
  // **********************************************************************

  /** Se una descrizione e' gia' nel percorso della bozza. */
  itemInVisit(id: string) {
    return this.draft.tappe.some((t) => t.tipo === "item" && t.value === id);
  }

  /** Aggiunge una tappa in fondo al percorso; rifiuta una descrizione gia' presente. */
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

  /** Toglie una tappa dal percorso. */
  removeStop(index: number) {
    this.draft.tappe.splice(index, 1);
  }

  /** Sposta una tappa di un posto in su o in giu'. */
  moveStop(index: number, dir: -1 | 1) {
    const j = index + dir;
    const t = this.draft.tappe;
    if (j < 0 || j >= t.length) return;
    [t[index], t[j]] = [t[j], t[index]];
  }

  /** Rende una tappa opzionale o di nuovo obbligatoria. */
  toggleOptional(index: number) {
    const t = this.draft.tappe[index];
    if (t && t.tipo === "item") t.opzionale = !t.opzionale;
  }

  /** Quante tappe-opera ha il percorso (le note logistiche non contano). */
  stopCount(): number {
    return this.draft.tappe.filter((t) => t.tipo === "item").length;
  }

  /** Il numero d'ordine di una tappa fra le sole tappe-opera, o `null` se e' una nota. */
  stopNumber(index: number): number | null {
    const t = this.draft.tappe[index];
    if (!t || t.tipo !== "item") return null;
    let n = 0;
    for (let i = 0; i <= index; i++) {
      if (this.draft.tappe[i].tipo === "item") n++;
    }
    return n;
  }

  /** La durata della bozza: la somma dei secondi di lettura delle sue tappe. */
  estimatedDuration(): number {
    let tot = 0;
    for (const t of this.draft.tappe) {
      if (t.tipo !== "item") continue;
      const it = this.findItem(t.value);
      if (it && isItem(it)) tot += Number(it.timeRequired) || 0;
    }
    return tot;
  }

  /** Aggiunge una domanda vuota al quiz della visita guidata. */
  addQuizQuestion() {
    this.draft.quiz.push({
      question: "",
      options: ["", "", "", ""],
      correct: 0,
    });
  }

  /** Toglie una domanda dal quiz. */
  removeQuizQuestion(index: number) {
    this.draft.quiz.splice(index, 1);
  }

  /** Cosa manca perche' una visita si possa salvare; per una guidata anche chiave e quiz. */
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

  /**
   * Quanti itinerari questa persona ha gia' composto in questo museo. Si conta su
   * `visits`, gia' in memoria: le proprie private ci sono per costruzione,
   * essendo l'unico caso in cui una privata esce dalla rotta.
   */
  composedVisitCount(): number {
    if (!this.currentUser) return 0;
    return this.visits.filter(
      (v: any) => v.author === this.currentUser && this.belongsToMuseum(v),
    ).length;
  }

  /**
   * Se il visitatore ha raggiunto il tetto di itinerari per museo. Vale per il
   * solo visitatore (l'autore pubblica di mestiere) e non per chi sta
   * modificando un itinerario che ha gia', o non lo potrebbe piu' correggere.
   */
  visitCapReached(): boolean {
    if (this.currentUserRole !== "visitatore") return false;
    if (this.editingId) return false;
    return this.composedVisitCount() >= MAX_VISITE_VISITATORE;
  }

  /** Quanti itinerari restano al visitatore, per dirlo mentre compone. */
  visitsLeft(): number {
    return Math.max(0, MAX_VISITE_VISITATORE - this.composedVisitCount());
  }

  /** Il messaggio che spiega il tetto raggiunto. */
  visitCapMessage(): string {
    return this.t(
      "Hai raggiunto i {n} itinerari di questo museo. Eliminane uno dalla tua libreria per comporne un altro.",
      { n: MAX_VISITE_VISITATORE },
    );
  }

  /** "3 tappe · 2 min": il riepilogo della bozza, letto in due punti del compositore. */
  draftSummary(): string {
    const tappe = this.stopCount();
    const conta =
      tappe === 1 ? this.t("1 tappa") : this.t("{n} tappe", { n: tappe });
    return `${conta} · ${this.readableDuration(this.estimatedDuration())}`;
  }

  /** La riga di stato del compositore: il tetto se raggiunto, poi cosa manca, poi "Pronta". */
  visitStatus(): string {
    // Il tetto viene prima di quel che manca: inutile dire che serve un titolo
    // a chi comunque non potra' salvare.
    if (this.visitCapReached()) return this.visitCapMessage();
    const issues = this.visitIssues();
    if (issues.length > 0)
      return this.t("Manca ancora: {elenco}.", { elenco: issues.join(", ") });
    return this.t("Pronta · {riepilogo}", { riepilogo: this.draftSummary() });
  }

  /**
   * Il passo dopo quello aperto, "" se e' l'ultimo. E' quel che fa del
   * compositore una strada e non tre schede: si pubblica solo dall'ultimo passo,
   * quindi dalle impostazioni si passa per forza. Il quiz e' un passo solo per
   * le guidate, percio' l'ultimo non e' sempre lo stesso.
   */
  nextVisitStep(): string {
    if (this.visitStep === "percorso") return "impostazioni";
    if (this.visitStep === "impostazioni") {
      if (this.currentUserRole === "autore" && this.draft.guidata)
        return "quiz";
      return "";
    }
    return "";
  }

  /** L'etichetta del bottone "Continua" col nome del passo che apre. */
  nextVisitStepLabel(): string {
    const dopo = this.nextVisitStep();
    if (dopo === "impostazioni") return "Continua · Impostazioni";
    if (dopo === "quiz") return "Continua · Quiz";
    return "";
  }

  /** L'etichetta del bottone finale del compositore, secondo ruolo e tipo di visita. */
  publishLabel(): string {
    if (this.currentUserRole !== "autore") return "Salva nella mia libreria";
    if (this.draft.guidata) return "Attiva la visita guidata";
    return this.editingId ? "Salva le modifiche" : "Pubblica in vetrina";
  }

  /**
   * Salva la visita, poi ricarica e torna a "I miei contenuti" o alla libreria.
   * Il controllo del tetto qui e' una cortesia: a rifiutare davvero e' il
   * server, ma cosi' non si compone un percorso intero per poi buttarlo.
   */
  async saveVisit() {
    if (this.visitCapReached())
      return this.showToast(this.visitCapMessage(), "error");
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
      // Una visita composta da un visitatore non e' pubblicata da lui: prende la
      // licenza chiusa di default.
      licenza:
        this.currentUserRole === "autore"
          ? this.draft.license
          : DEFAULT_LICENSE,
      museumUri: this.selectedMuseum
        ? `http://www.wikidata.org/entity/${this.selectedMuseum.qid}`
        : undefined,
      // Si manda sempre, anche vuota: e' cosi' che si toglie una copertina.
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

  // **********************************************************************
  //                Vendite, licenze e prezzi
  // **********************************************************************

  periodFilter: string = "sempre";

  /** Scarica le righe di vendita dell'utente. */
  async loadSales() {
    if (!this.currentUser) return;
    try {
      this.sales = await ArtAPI.fetchSales();
    } catch (e) {
      console.error(e);
      this.sales = [];
    }
  }

  /** Le vendite del museo scelto. */
  filteredSales(): SaleRow[] {
    const museo = this.museumEntityId();
    if (!museo) return [];
    return this.sales.filter((r) => r.ofMuseum === museo);
  }

  /** Il totale delle adozioni nel museo scelto. */
  totalAdoptions() {
    return this.filteredSales().reduce((s, r) => s + (r.adozioni || 0), 0);
  }

  /** Il ricavo totale nel museo scelto. */
  totalRevenue() {
    return this.filteredSales().reduce((s, r) => s + (r.ricavo || 0), 0);
  }

  /** Il ricavo di una riga; "n/d" per un contenuto gratuito, che non ne produce. */
  readableRevenue(r: any): string {
    if (!r.price || Number(r.price) === 0) return "n/d";
    return `€ ${(r.ricavo || 0).toFixed(2)}`;
  }

  /**
   * L'indirizzo dove una licenza e' spiegata per esteso, da chi la pubblica
   * (RightsStatements.org, Creative Commons). Vuoto per un valore che non
   * riconosciamo: meglio nessun link che uno che promette e non spiega.
   */
  licenseHref(nome: string | undefined): string {
    if (!nome) return "";
    return licenseUri[nome] || "";
  }

  /** Un prezzo reso leggibile: "Gratis" per zero, altrimenti "€ X.XX". */
  readablePrice(p: number | undefined): string {
    if (!p || Number(p) === 0) return this.t("Gratis");
    return `€ ${Number(p).toFixed(2)}`;
  }
}

export const state = new AppState();
