/**
 * IL DEPOSITO — l'unico stato del marketplace, piu' i metodi che i binding Alpine
 * chiamano. Quattro cose da sapere per leggerlo:
 *
 *  1. LA NAVIGAZIONE E' UN ROUTER A FRAMMENTO. `view` dice quale schermata e'
 *     attiva e la decide l'indirizzo (`#/opere`, `#/opera/Q12418`), non un click:
 *     quindi il tasto "indietro" funziona e un ricaricamento non perde il posto.
 *     Le finestre modali sono riservate alle CONFERME.
 *  2. RUOLO E MUSEO ARRIVANO PRIMA DEI DATI. Il ruolo lo risolve il server dalle
 *     credenziali; il museo si sceglie una volta e resta in `localStorage`. Il
 *     catalogo si scarica per museo, quindi entrambi vanno noti prima (`initApp`).
 *  3. DUE CATALOGHI SEPARATI: le visite si vendono, le opere si sfogliano.
 *  4. TRE RUOLI: visitatore, autore, curatore.
 *     ⚠️ Le diramazioni per ruolo qui dentro sono scritte `role === "autore"
 *     ? ... : ...`, col visitatore nel ramo altrimenti: un ruolo nuovo ci cade
 *     dentro senza che nulla protesti. Nominarlo esplicitamente dove conta.
 *
 * ⚠️ L'ORDINE di `draft.tappe` E' L'ANCORAGGIO delle note logistiche: il server non
 * riceve una posizione, la ricava percorrendo `percorso` e legando ogni nota alla
 * tappa che la precede (nessuna ⇒ `after: null`, cioe' nota d'apertura). Quindi
 * ricostruire un percorso nell'ordine sbagliato non e' un difetto di visualizzazione:
 * al primo salvataggio la nota si riancora dove l'ha messa `rebuildStops`.
 *
 * ⚠️ Nel catalogo del curatore la durata di una descrizione e' in SECONDI esatti e
 * non in `formatDuration()`: le descrizioni sono uniche per (opera, autore, tono,
 * DURATA), quindi ogni riga ha una gemella identica in tutto il resto, e i minuti
 * arrotondati le renderebbero indistinguibili. Non "correggerlo" in minuti.
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
  educationalLevels,
  educationalLevelHints,
  formatDuration,
  secPerArt,
} from "../../../shared/constants.js";
import { ArtAPI } from "./api.js";


/** Cio' su cui valgono gli aiutanti comuni (cercare, dire di che museo e', il tono). */
export type Catalogabile = Content | Artwork;

/** Riga della tabella del catalogo del curatore. */
export interface CatalogRow {
  kind: "item" | "visita";
  id: string;
  name: string;
  author: string;
  tone: string;
  duration: number;
  price: number;
  privato?: boolean;
  guidata?: boolean;
  raw: Content;
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

/** Riga del resoconto vendite, come la calcola il server. */
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

/** Un'opera con le descrizioni che le appartengono, come le raggruppa il catalogo. */
export interface ArtworkGroup {
  artwork: Artwork;
  items: Item[];
}

export type View =
  | "soglia"
  | "accedi"
  | "registrati"
  | "musei"
  | "home"
  | "visite"
  | "opere"
  | "opera"
  | "visita"
  | "libreria"
  | "componi"
  | "sumisura"
  | "nuovo"
  | "lavori"
  | "vendite"
  | "gestione"
  | "catalogo";

export class AppState {
  // --- Rotta corrente -------------------------------------------------------
  view: View = "soglia";
  param: string = ""; 

  currentUser: string | null = null;
  currentUserRole: UserRole | null = null;

  announcement: string = "";

  // --- Ricerca e filtri -----------------------------------------------------
  visitSearch: string = "";
  visitLevelFilter: string = "tutti";
  visitDurationFilter: "tutti" | "breve" | "media" | "lunga" = "tutti";

  artworkSearch: string = "";
  artworkLevelFilter: string = "tutti";

  librarySearch: string = "";
  libraryTypeFilter: "tutti" | "item" | "visite" = "tutti";

  worksSearch: string = "";
  worksTypeFilter: "tutti" | "item" | "visite" = "tutti";

  catalogSearch: string = "";
  catalogTypeFilter: "tutti" | "item" | "visite" = "tutti";
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

  private parseHash(): { view: View; param: string } {
    const raw = (window.location.hash || "").replace(/^#\/?/, "");
    const head = raw.split("/")[0] || "";
    const tail = raw.split("/").slice(1).join("/");
    const param = decodeURIComponent(tail || "");
    const knownViews: View[] = [
      "soglia",
      "accedi",
      "registrati",
      "musei",
      "home",
      "visite",
      "opere",
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
    ];
    for (const candidate of knownViews) {
      if (head === candidate) return { view: candidate, param };
    }
    return { view: "soglia", param: "" };
  }

  applyRoute() {
    const { view, param } = this.parseHash();
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
      this.goTo(this.roleHome());
      return;
    }
    this.view = view;
    this.param = param;
    this.announceView();
  }

  goTo(view: View, param?: string) {
    const nuovo = param
      ? `#/${view}/${encodeURIComponent(param)}`
      : `#/${view}`;
    if (window.location.hash === nuovo) this.applyRoute();
    else window.location.hash = nuovo;
  }

  roleHome(): View {
    if (this.currentUserRole === "curatore") return "gestione";
    if (this.currentUserRole === "autore") return "lavori";
    return "home";
  }

  goHome() {
    this.goTo(this.roleHome());
  }

  viewLabel(): string {
    const labels: Record<View, string> = {
      soglia: "ArtAround",
      accedi: "Accedi",
      registrati: "Crea un profilo",
      musei: "Scegli il museo",
      home: "Home",
      visite: "Visite",
      opere: "Opere",
      opera: "Scheda dell'opera",
      visita: "Scheda della visita",
      libreria: "La mia libreria",
      componi: this.editingId ? "Modifica la visita" : "Componi una visita",
      sumisura: "Visita su misura",
      nuovo: this.editingId ? "Modifica la descrizione" : "Nuova descrizione",
      lavori: "I miei contenuti",
      vendite: "Vendite e adozioni",
      gestione: "Gestione del museo",
      catalogo: "Catalogo del museo",
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

  async start() {
    window.addEventListener("hashchange", () => this.applyRoute());
    try {
      const cfg = await ArtAPI.fetchConfig();
      this.navigatorOrigin = cfg.navigatorOrigin || "";
    } catch {
      this.navigatorOrigin = "";
    }
    this.applyRoute();
  }

  /**
   * L'ordine conta: prima si RISOLVE il museo, poi si scarica. Il catalogo si
   * chiede per museo (`?museum=`), quindi sapere quale museo e' scelto e'
   * precondizione dello scaricamento, non una conseguenza. Per lo stesso motivo
   * cambiare museo deve ricaricare: vedi `selectMuseum`.
   */
  async initApp() {
    this.loading = true;
    try {
      this.museums = await ArtAPI.fetchMuseums();

      if (!this.selectedMuseum) {
        const ricordato = localStorage.getItem("artaround-museo");
        const trovato = this.museums.find((m) => m.qid === ricordato);
        if (trovato) this.selectedMuseum = trovato;
        else if (this.museums.length === 1) this.selectedMuseum = this.museums[0];
      }
      if (this.selectedMuseum) await this.loadCatalogue();

      this.goTo(this.selectedMuseum ? this.roleHome() : "musei");
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

  /** Scarica il catalogo del museo scelto, e solo quello. */
  private async loadCatalogue() {
    if (!this.selectedMuseum) return;
    const qid = this.selectedMuseum.qid;

    const arts = await ArtAPI.fetchArtworks(qid);
    this.availableArtworks = arts.sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
    this.visits = await ArtAPI.fetchVisite(qid);
    this.marketItems = await ArtAPI.fetchItems(qid);

    if (this.currentUser && this.currentUserRole === "autore") {
      this.myItems = await ArtAPI.fetchMyItems(this.currentUser);
    } else {
      this.myItems = [];
    }
    if (this.currentUserRole === "curatore") await this.loadMuseumState();
  }

  async login() {
    const { username, password } = this.loginForm;
    if (!username || !password)
      return this.showToast("Inserisci username e password.", "error");
    try {
      const esito = await ArtAPI.login(username, password);
      if ((esito as any).scelta) {
        this.roleChoice = (esito as any).ruoli as UserRole[];
        return;
      }
      await this.enterAs(esito as any);
    } catch (e) {
      this.showToast((e as Error).message, "error");
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
  }) {
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

  logout() {
    this.currentUser = null;
    this.currentUserRole = null;
    this.wallet = 0;
    this.userCollection = [];
    this.visits = [];
    this.marketItems = [];
    this.myItems = [];
    this.museums = [];
    this.selectedMuseum = null;
    this.sales = [];
    this.editingId = null;
    this.roleChoice = null;
    this.guidedSession = null;
    this.passkeyInput = "";
    this.customRequest = "";
    this.visitSearch = "";
    this.artworkSearch = "";
    this.librarySearch = "";
    this.worksSearch = "";
    this.editorSearch = "";
    this.visitLevelFilter = "tutti";
    this.visitDurationFilter = "tutti";
    this.artworkLevelFilter = "tutti";
    this.libraryTypeFilter = "tutti";
    this.worksTypeFilter = "tutti";
    this.editorFilter = "tutti";
    this.draft = this.emptyDraft();
    localStorage.removeItem("artaround-museo");
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
    let ofMuseum: string | undefined;
    if (isItem(c)) {
      const art = c.about;
      if (typeof art === "object" && art) ofMuseum = art.ofMuseum;
    } else {
      ofMuseum = c.ofMuseum;
    }
    return ofMuseum === museo;
  }

  async selectMuseum(m: Museum) {
    this.selectedMuseum = m;
    localStorage.setItem("artaround-museo", m.qid);
    this.loading = true;
    try {
      await this.loadCatalogue();
    } catch (e) {
      this.showToast((e as Error).message, "error");
    } finally {
      this.loading = false;
    }
    this.goTo(this.roleHome());
  }

  changeMuseum() {
    this.goTo("musei");
  }

  museumSummary(m: Museum): string {
    const opere = typeof m.opere === "number" ? m.opere : 0;
    const visite = typeof m.visite === "number" ? m.visite : 0;
    return `${opere} opere · ${visite} visite`;
  }

  museumArtworks() {
    return this.availableArtworks.filter((a) => this.belongsToMuseum(a));
  }

  contentName(c: Catalogabile): string {
    if (isVisit(c)) return c.name || "";
    if (isArtwork(c)) return c.name || "";
    const art = c.about;
    return (typeof art === "object" && art ? art.name : "") || "";
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
    const ordered = educationalLevels.filter((l) => present.has(l));
    for (const d of present) if (!ordered.includes(d)) ordered.push(d);
    return ordered;
  }

  owns(item: Content | null): boolean {
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

  private visibleInMarket(c: any): boolean {
    if (!c || !c.accessKey) return true;
    return c.author === this.currentUser;
  }

  async buy(item: Content) {
    if (!this.currentUser || this.owns(item)) return;
    if ((item as any).accessKey) return;
    if (!item.price || item.price === 0) {
      await this.performPurchase(item);
      return;
    }
    this.itemToBuy = item;
    this.confirmOpen = true;
  }

  private async performPurchase(item: Content) {
    if (!this.currentUser) return;
    try {
      const u = await ArtAPI.buy(this.currentUser, item["@id"], item.price || 0);
      this.wallet = typeof u.wallet === "number" ? u.wallet : 0;
      this.userCollection = u.collezione;
      const nome = this.contentName(item) || "Contenuto";
      this.showToast(`"${nome}" è ora nella tua libreria.`);
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }
  }

  missingItems(visit: any): any[] {
    if (!visit || visit["@type"] !== "ItemList") return [];
    const missing: any[] = [];
    for (const id of visit.itemListElement || []) {
      const it = this.findItem(id);
      if (!it) {
        missing.push({ "@id": id, price: 0, sconosciuto: true });
        continue;
      }
      if (!this.owns(it)) missing.push(it);
    }
    return missing;
  }

  missingCost(visit: any): number {
    return this.missingItems(visit).reduce(
      (s: number, it: any) => s + (it.price || 0),
      0,
    );
  }

  visitUsable(visit: any): boolean {
    return this.owns(visit) && this.missingItems(visit).length === 0;
  }

  openCompleteVisit(visit: any) {
    if (!this.currentUser || this.missingItems(visit).length === 0) return;
    this.visitToComplete = visit;
    this.confirmOpen = true;
  }

  openDeleteVisit(visit: any) {
    if (!visit || visit.author !== this.currentUser) return;
    this.visitToDelete = visit;
    this.confirmOpen = true;
  }

  confirmTitle(): string {
    if (this.itemToDelete) return "Eliminare questa descrizione?";
    if (this.visitToDelete) return "Eliminare questa visita?";
    if (this.visitToComplete) return "Sbloccare i contenuti mancanti?";
    return "Confermi l'acquisto?";
  }

  confirmMessage(): string {
    if (this.itemToDelete) {
      if (!this.itemImpact) return "Sto calcolando che cosa comporta…";
      const visite = this.itemImpact.visite || [];
      const adozioni = this.itemImpact.adozioni || 0;

      let testo = `"${this.itemToDelete.name}" sparirà dal catalogo`;
      if (visite.length > 0) {
        const nomi = visite.map((v: any) => `"${v.name}"`).join(", ");
        const quali =
          visite.length === 1
            ? "la visita che la contiene"
            : `le ${visite.length} visite che la contengono`;
        testo += `, e con essa ${quali} — ${nomi} — perché una tappa che non si risolve non darebbe errore, semplicemente non comparirebbe`;
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
      const missing = this.missingItems(this.visitToComplete);
      const cost = this.missingCost(this.visitToComplete);
      return `Per usare questa visita servono ${missing.length} contenuti che non hai ancora. Sbloccarli tutti costa € ${cost.toFixed(2)}.`;
    }
    const item = this.itemToBuy;
    if (!item) return "";
    const nome = this.contentName(item) || "questo contenuto";
    return `"${nome}" resterà nella tua libreria. Costa € ${(item.price || 0).toFixed(2)}, il tuo credito è € ${this.wallet.toFixed(2)}.`;
  }

  confirmVerb(): string {
    if (this.itemToDelete) return "Elimina";
    if (this.visitToDelete) return "Elimina";
    if (this.visitToComplete) return "Sblocca tutto";
    return "Acquista";
  }

  confirmReady(): boolean {
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
  }

  async runConfirm() {
    if (this.itemToDelete) {
      const row = this.itemToDelete;
      this.cancelConfirm();
      try {
        const esito = await ArtAPI.eliminaItem(row.id);
        const eliminate = esito.visiteEliminate || [];
        await this.loadMuseumState();
        if (eliminate.length > 0) {
          const quante =
            eliminate.length === 1 ? "1 visita" : `${eliminate.length} visite`;
          this.showToast(`Descrizione eliminata, insieme a ${quante}.`);
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

    if (this.visitToComplete) {
      const visit = this.visitToComplete;
      this.cancelConfirm();
      if (!this.currentUser) return;
      try {
        for (const it of this.missingItems(visit)) {
          if (it.sconosciuto) continue;
          const u = await ArtAPI.buy(this.currentUser, it["@id"], it.price || 0);
          this.wallet = typeof u.wallet === "number" ? u.wallet : 0;
          this.userCollection = u.collezione;
        }
        this.showToast("Contenuti sbloccati: la visita è pronta.");
      } catch (e) {
        this.showToast((e as Error).message, "error");
      }
      return;
    }

    const item = this.itemToBuy;
    this.cancelConfirm();
    if (!item || !this.currentUser || this.owns(item)) return;
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


  setCatalogType(tipo: "tutti" | "item" | "visite") {
    this.catalogTypeFilter = tipo;
    this.catalogDurationFilter = "tutti";
  }

  catalogDurationOptions(): { value: string; label: string }[] {
    if (this.catalogTypeFilter === "item") {
      return secPerArt.map((s) => ({ value: String(s), label: `${s} secondi` }));
    }
    if (this.catalogTypeFilter === "visite") {
      return [
        { value: "breve", label: "meno di 30 min" },
        { value: "media", label: "da 30 a 60 min" },
        { value: "lunga", label: "oltre 60 min" },
      ];
    }
    return [];
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
    if (row.kind === "item") return `${row.duration} s`;
    return this.readableDuration(row.duration);
  }

  private matchesCatalogDuration(row: any): boolean {
    if (this.catalogDurationFilter === "tutti") return true;
    if (row.kind === "item") return String(row.duration) === this.catalogDurationFilter;
    const min = Math.round(row.duration / 60);
    if (this.catalogDurationFilter === "breve") return min < 30;
    if (this.catalogDurationFilter === "media") return min >= 30 && min <= 60;
    if (this.catalogDurationFilter === "lunga") return min > 60;
    return true;
  }

  catalogRows(): CatalogRow[] {
    const cerca = this.catalogSearch.trim().toLowerCase();
    const rows: CatalogRow[] = [];

    if (this.catalogTypeFilter !== "visite") {
      for (const it of this.curatedItems) {
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
    if (this.catalogTypeFilter !== "item") {
      for (const v of this.curatedVisits()) {
        rows.push({
          kind: "visita",
          id: v["@id"],
          name: v.name,
          author: v.author || "—",
          tone: v.level,
          duration: Number(v.duration) || 0,
          price: v.price || 0,
          guidata: Boolean(v.accessKey),
          raw: v,
        });
      }
    }

    return rows.filter((r) => {
      if (this.catalogToneFilter !== "tutti" && r.tone !== this.catalogToneFilter)
        return false;
      if (
        this.catalogAuthorFilter !== "tutti" &&
        r.author !== this.catalogAuthorFilter
      )
        return false;
      if (!this.matchesCatalogDuration(r)) return false;
      if (!cerca) return true;
      const dove = `${r.name} ${r.author} ${r.tone}`.toLowerCase();
      return dove.includes(cerca);
    });
  }

  async openDeleteRow(row: any) {
    if (!row) return;
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
    if (!v.price || Number(v.price) === 0) return "Aggiungi alla libreria";
    return "Sblocca la visita";
  }

  unlockMissingLabel(): string {
    const v = this.currentVisit();
    if (!v) return "";
    const quanti = this.missingItems(v).length;
    const costo = this.missingCost(v).toFixed(2);
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
   * entrando in #/vendite dall'indirizzo diretto il guardiano non scatta.
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
    return formatDuration(secondi);
  }

  visitSummary(v: any): string {
    const tappe = (v.itemListElement || []).length;
    const parts = [
      `${tappe} ${tappe === 1 ? "tappa" : "tappe"}`,
      formatDuration(v.duration),
    ];
    if (v.level) parts.push(v.level);
    return parts.join(" · ");
  }

  shownVisits(): Visit[] {
    const base = this.visits.filter(
      (v) =>
        this.belongsToMuseum(v) &&
        this.visibleInMarket(v) &&
        this.matchesSearch(v, this.visitSearch),
    );
    return base.filter((v) => {
      if (
        this.visitLevelFilter !== "tutti" &&
        v.level !== this.visitLevelFilter
      )
        return false;
      if (this.visitDurationFilter === "tutti") return true;
      const min = this.visitMinutes(v);
      if (this.visitDurationFilter === "breve") return min < 30;
      if (this.visitDurationFilter === "media") return min >= 30 && min <= 60;
      return min > 60;
    });
  }

  private artworkIdOf(c: any): string {
    const art = c ? c.about : null;
    return (art && typeof art === "object" ? art["@id"] : art) || "?";
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
      const id = this.artworkIdOf(c);
      if (!groups.has(id)) {
        const art = c.about;
        groups.set(id, {
          artwork:
            art && typeof art === "object" ? art : { "@id": id, name: id },
          items: [],
        });
      }
      groups.get(id)!.items.push(c);
    }
    return [...groups.values()];
  }

  shownArtworks(): ArtworkGroup[] {
    const items = this.visibleItems().filter((i) => {
      if (
        this.artworkLevelFilter !== "tutti" &&
        i.educationalLevel !== this.artworkLevelFilter
      )
        return false;
      return true;
    });
    const groups = this.groupByArtwork(items);
    if (!this.artworkSearch.trim()) return groups;
    return groups.filter((g) =>
      this.matchesSearch(g.artwork, this.artworkSearch),
    );
  }

  artworkSummary(g: ArtworkGroup): string {
    const n = g.items.length;
    const prices = g.items.map((i: any) => Number(i.price) || 0);
    const cheapest = prices.length ? Math.min(...prices) : 0;
    const priceLabel = cheapest === 0 ? "da gratis" : `da € ${cheapest.toFixed(2)}`;
    return `${n} ${n === 1 ? "descrizione" : "descrizioni"} · ${priceLabel}`;
  }

  currentArtwork(): Artwork | null {
    if (this.view !== "opera" || !this.param) return null;
    const p = this.param;
    return (
      this.availableArtworks.find(
        (a: any) => a.qid === p || a["@id"] === p,
      ) || null
    );
  }

  artworkItems(): Item[] {
    const art = this.currentArtwork();
    if (!art) return [];
    const items = this.visibleItems().filter(
      (i: any) => this.artworkIdOf(i) === art["@id"],
    );
    return items.sort(
      (a: any, b: any) =>
        educationalLevels.indexOf(a.educationalLevel) -
        educationalLevels.indexOf(b.educationalLevel),
    );
  }

  openItems: string[] = [];

  toggleItem(id: string) {
    const i = this.openItems.indexOf(id);
    if (i >= 0) this.openItems.splice(i, 1);
    else this.openItems.push(id);
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
        this.owns(v) &&
        this.visibleInMarket(v) &&
        this.matchesSearch(v, this.librarySearch),
    );
    return base;
  }

  myItemGroups(): { artwork: any; items: any[] }[] {
    const posseduti = this.visibleItems().filter(
      (i: any) =>
        this.owns(i) && this.matchesSearch(i, this.librarySearch),
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

  artworkImage(about: any): string {
    if (!about || typeof about !== "object") return "";
    return about.imagePath || about.imageUri || "";
  }

  private navigatorBase(): string {
    if (this.navigatorOrigin) return this.navigatorOrigin;
    return `${window.location.protocol}//${window.location.hostname}:5173`;
  }

  navigatorUrl(v: any): string {
    if (!v) return "#";
    const uri: string = v.ofMuseum || "";
    const museumQid = uri.split("/").pop() || "";
    return (
      `${this.navigatorBase()}/` +
      `?museum=${encodeURIComponent(museumQid)}` +
      `&visit=${encodeURIComponent(v["@id"])}` +
      `&user=${encodeURIComponent(this.currentUser || "")}`
    );
  }

  // --- Visita su misura -----------------------------------------------------

  customExamples: string[] = [
    "Ho solo mezz'ora, mostrami le cose più importanti",
    "Siamo due adulti e due bambini di 5 e 8 anni",
    "Mi piace il giallo",
  ];

  customReady(): boolean {
    return this.customRequest.trim() !== "" && !!this.selectedMuseum;
  }

  customVisitUrl(): string {
    if (!this.customReady()) return "#";
    return (
      `${this.navigatorBase()}/` +
      `?museum=${encodeURIComponent(this.selectedMuseum!.qid)}` +
      `&custom=${encodeURIComponent(this.customRequest.trim())}` +
      `&user=${encodeURIComponent(this.currentUser || "")}`
    );
  }

  waitingRoomUrl(): string {
    if (!this.guidedSession) return "#";
    return (
      `${this.navigatorBase()}/` +
      `?guidedSession=${encodeURIComponent(this.guidedSession.id)}` +
      `&role=studente&user=${encodeURIComponent(this.currentUser || "")}`
    );
  }

  startGuidedUrl(visit: any): string {
    return (
      `${this.navigatorBase()}/` +
      `?guidedVisit=${encodeURIComponent(visit["@id"])}` +
      `&role=docente&user=${encodeURIComponent(this.currentUser || "")}`
    );
  }

  visitQrUrl(v: any): string {
    return `/api/qr?text=${encodeURIComponent(this.navigatorUrl(v))}`;
  }

  sampleUrl(): string {
    return `${this.navigatorBase()}/?demo=1`;
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
        this.currentUser,
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
      selectedArtworkUri: "",
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
    this.draft.selectedArtworkUri =
      (typeof item.about === "object" ? item.about["@id"] : item.about) || "";
    this.draft.tono = item.educationalLevel || "";
    this.draft.durata = String(item.timeRequired || "");
    this.draft.testo = item.text || "";
    this.draft.price = item.price || 0;
    this.draft.license = item.license || licenses[0];
    this.draft.privato = item.visibility === "privato";
    this.goTo("nuovo");
  }

  toneAlreadyUsed(tono: string): boolean {
    const art = this.draft.selectedArtworkUri;
    if (!art) return false;
    return this.myItems.some(
      (i: any) =>
        (typeof i.about === "object" ? i.about["@id"] : i.about) === art &&
        i.educationalLevel === tono &&
        i["@id"] !== this.editingId,
    );
  }

  readingEstimate(): string {
    const parole = this.draft.testo.trim().split(/\s+/).filter(Boolean).length;
    if (parole === 0) return "";
    const secondi = Math.round((parole / 100) * 60); 
    const dichiarata = Number(this.draft.durata) || 0;
    let giudizio = "";
    if (dichiarata > 0) {
      const scarto = secondi / dichiarata;
      if (scarto < 0.6) giudizio = " — più corta della durata dichiarata";
      else if (scarto > 1.6) giudizio = " — più lunga della durata dichiarata";
      else giudizio = " — in linea con la durata dichiarata";
    }
    return `${parole} parole · circa ${secondi}s di lettura${giudizio}`;
  }

  itemIssues(): string[] {
    const issues: string[] = [];
    if (!this.draft.selectedArtworkUri) issues.push("l'opera");
    if (!this.draft.tono) issues.push("il tono");
    if (!(Number(this.draft.durata) > 0)) issues.push("la durata");
    if (this.draft.testo.trim() === "") issues.push("il testo");
    if (Number(this.draft.price) < 0) issues.push("un prezzo non negativo");
    return issues;
  }

  async saveItem() {
    const issues = this.itemIssues();
    if (issues.length > 0)
      return this.showToast(`Manca ancora: ${issues.join(", ")}.`, "error");
    if (!this.editingId && this.toneAlreadyUsed(this.draft.tono))
      return this.showToast(
        `Hai già una descrizione "${this.draft.tono}" per quest'opera. Modificala invece di crearne un'altra.`,
        "error",
      );

    const payload = {
      tipo: "Item",
      editId: this.editingId || undefined,
      id_oper_universale: this.draft.selectedArtworkUri,
      autore: this.currentUser!,
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

  availableNow(item: any): boolean {
    return this.owns(item) || !item.price || item.price === 0;
  }

  allowedInGuided(item: any): boolean {
    if (!item) return false;
    return !item.price || item.price === 0 || this.owns(item);
  }

  editorLibrary(): { artwork: any; items: any[] }[] {
    let base = this.visibleItems();
    if (this.currentUserRole === "autore") {
      base = base.filter(
        (i: any) =>
          i.author === this.currentUser || !i.price || Number(i.price) === 0,
      );
    }
    if (this.draft.guidata) {
      base = base.filter((op) => this.allowedInGuided(op));
    }
    if (this.editorFilter !== "tutti") {
      base = base.filter((i) =>
        this.editorFilter === "disponibili"
          ? this.availableNow(i)
          : !this.availableNow(i),
      );
    }
    const groups = this.groupByArtwork(base);
    if (!this.editorSearch.trim()) return groups;
    return groups.filter((g) =>
      this.matchesSearch(g.artwork, this.editorSearch),
    );
  }

  findItem(id: string) {
    const all = [
      ...this.myItems,
      ...this.marketItems,
      ...this.visits,
    ];
    return all.find((i) => i["@id"] === id) || null;
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
    if (!this.draft.titolo.trim()) issues.push("il titolo");
    if (this.stopCount() === 0) issues.push("almeno una tappa");
    if (this.currentUserRole === "autore" && Number(this.draft.price) < 0)
      issues.push("un prezzo non negativo");
    const guidata = this.currentUserRole === "autore" && this.draft.guidata;
    if (guidata) {
      if (!this.draft.accessKey.trim()) issues.push("la parola chiave");
      const notAllowed = this.draft.tappe.filter(
        (t) =>
          t.tipo === "item" && !this.allowedInGuided(this.findItem(t.value)),
      );
      if (notAllowed.length > 0)
        issues.push(
          `${notAllowed.length} contenuti a pagamento non tuoi da rimuovere`,
        );
      for (const q of this.draft.quiz) {
        if (
          !q.question.trim() ||
          q.options.length !== 4 ||
          q.options.some((o) => !o.trim())
        ) {
          issues.push("le domande del quiz complete");
          break;
        }
      }
    }
    return issues;
  }

  visitStatus(): string {
    const issues = this.visitIssues();
    if (issues.length > 0) return `Manca ancora: ${issues.join(", ")}.`;
    return `Pronta · ${this.stopCount()} tappe · ${formatDuration(this.estimatedDuration())}`;
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
      autore: this.currentUser!,
      accessKey: guidata ? this.draft.accessKey.trim() : undefined,
      quiz: quizPayload,
      prezzo:
        guidata || this.currentUserRole !== "autore" ? 0 : this.draft.price,
      licenza:
        this.currentUserRole === "autore"
          ? this.draft.license
          : "Tutti i diritti riservati",
      museumUri: this.selectedMuseum
        ? `http://www.wikidata.org/entity/${this.selectedMuseum.qid}`
        : undefined,
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
      this.sales = await ArtAPI.fetchSales(this.currentUser);
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
    if (!r.price || Number(r.price) === 0) return "—";
    return `€ ${(r.ricavo || 0).toFixed(2)}`;
  }

  readablePrice(p: number | undefined): string {
    if (!p || Number(p) === 0) return "Gratis";
    return `€ ${Number(p).toFixed(2)}`;
  }
}

export const state = new AppState();
