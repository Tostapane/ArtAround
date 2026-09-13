/**
 * Stato unico e azioni del marketplace. Tiene insieme router History API, sessione,
 * catalogo per museo ed editor, cosi' i binding Alpine chiamano metodi semplici; le
 * note logistiche conservano l'ordine relativo alle tappe.
 */
import {
  UserRole,
  Author,
  Content,
  Item,
  Visit,
  Artwork,
  ArtworkImpactReport,
  ImpactReport,
  Museum,
  MuseumOverview,
  SaleRow,
  Style,
  VisitaNominata,
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
  UserDTO,
  clearToken,
  hasToken,
  onSessionExpired,
  setToken,
} from "./api.js";

export type Catalogabile = Content | Soggetto;

function isSoggetto(c: Catalogabile): c is Soggetto {
  return "qid" in c;
}

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
  qid?: string;
  descrizioni?: number;
  raw: Artwork | Item | Visit;
}

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

export interface SoggettoBozza {
  name: string;
  imagePath?: string;
  kind?: string;
  author?: Author;
  style?: Style;
}

export interface ArtworkGroup {
  artwork: Soggetto;
  items: Item[];
}

export type View = "avvio" | (typeof marketplaceViews)[number];

const indiceContenuti = new Map<string, Content>();

export class AppState {

  view: View = "avvio";
  param: string = "";

  currentUser: string | null = null;
  currentUserRole: UserRole | null = null;

  announcement: string = "";

  marketSearch: string = "";
  marketType: "tutti" | "visite" | "opere" | "meta" = "tutti";
  marketLevelFilter: string = "tutti";
  marketDurationFilter: string = "tutti";

  librarySearch: string = "";
  libraryTypeFilter: "tutti" | "item" | "visite" = "tutti";

  worksSearch: string = "";
  worksTypeFilter: "tutti" | "item" | "visite" = "tutti";

  catalogSearch: string = "";

  catalogTypeFilter: "tutti" | "opere" | "descrizioni" | "visite" = "tutti";

  catalogSubjectFilter: "tutti" | "opera" | "meta" = "tutti";
  catalogToneFilter: string = "tutti";
  catalogDurationFilter: string = "tutti";
  catalogAuthorFilter: string = "tutti";

  editorSearch: string = "";
  editorFilter: "tutti" | "disponibili" | "da_acquistare" = "tutti";

  customRequest: string = "";

  passkeyInput: string = "";
  guidedSession: { id: string; visitName: string } | null = null;

  wallet: number = 0;
  userCollection: string[] = [];

  confirmOpen: boolean = false;
  itemToBuy: Content | null = null;
  visitToComplete: Visit | null = null;
  visitToDelete: Visit | null = null;

  museoToWipe: Museum | null = null;

  nuovaOperaQid = "";
  aggiungendoOpera = false;
  operaToDelete: Artwork | null = null;
  operaImpact: ArtworkImpactReport | null = null;

  visiteScelta: "accorcia" | "elimina" = "accorcia";

  itemToDelete: { id: string; name: string } | null = null;
  itemImpact: ImpactReport | null = null;

  toast: { messaggio: string; tipo: "success" | "error" } | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  visits: Visit[] = [];
  marketItems: Item[] = [];
  myItems: Item[] = [];
  availableArtworks: Artwork[] = [];
  museums: Museum[] = [];
  selectedMuseum: Museum | null = null;
  sales: SaleRow[] = [];
  loading: boolean = false;

  overview: MuseumOverview | null = null;
  curatedItems: Item[] = [];

  private navigatorOrigin: string = "";

  lingua: string = SOURCE_LANG;

  catalogoPronto = false;
  lingueDisponibili = languages;

  licenseOptions: string[] = licenses;
  tones: string[] = educationalLevels;
  toneHints: Record<string, string> = educationalLevelHints;

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

  private inCima() {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    const main = document.getElementById("contenuto");
    if (main) main.scrollTop = 0;
  }

  private navigate(percorso: string, sostituendo: boolean) {
    if (window.location.pathname !== percorso) {
      if (sostituendo) window.history.replaceState(null, "", percorso);
      else window.history.pushState(null, "", percorso);
    }
    this.applyRoute();
  }

  goTo(view: View, param?: string) {
    if (param) this.navigate(`/${view}/${encodeURIComponent(param)}`, false);
    else this.navigate(`/${view}`, false);
  }

  redirectTo(view: View) {
    this.navigate(`/${view}`, true);
  }

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

  t(chiave: string, parametri?: Record<string, unknown>): string {
    if (!this.catalogoPronto) return chiave;
    return traduci(chiave, this.lingua, parametri);
  }

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
    window.addEventListener("pageshow", () => {
      this.loading = false;
    });
    this.interceptClicks();

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

  async initApp() {
    this.loading = true;
    await this.afterPaint();
    try {
      this.museums = await ArtAPI.fetchMuseums();

      if (!this.selectedMuseum && this.museums.length === 1) {
        this.selectedMuseum = this.museums[0];
      }

      if (await this.goToNavigatorIfAsked()) return;
      if (this.selectedMuseum) await this.loadCatalogue();

      this.redirectTo(this.selectedMuseum ? this.roleHome() : "musei");
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

  private async loadCatalogue() {
    if (!this.selectedMuseum) return;
    const qid = this.selectedMuseum.qid;

    const mieiInArrivo =
      this.currentUser && this.currentUserRole === "autore"
        ? ArtAPI.fetchMyItems(this.currentUser)
        : Promise.resolve([] as Item[]);

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
    this.loading = true;
    await this.afterPaint();
    try {
      await this.enterAs(await ArtAPI.login(username, password));
    } catch (e) {
      this.showToast((e as Error).message, "error");
    } finally {
      this.loading = false;
    }
  }

  private async enterAs(u: UserDTO & { token?: string }) {
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
      await this.enterAs(u);
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }
  }

  async logout() {
    await ArtAPI.logout();
    clearToken();
    this.resetToThreshold();
  }

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

  private belongsToMuseum(c: Content | Artwork): boolean {
    const museo = this.museumEntityId();
    if (!museo) return false;
    return c.ofMuseum === museo;
  }

  async selectMuseum(m: Museum) {
    this.selectedMuseum = m;

    if (await this.goToNavigatorIfAsked()) return;
    this.loading = true;
    await this.afterPaint();
    try {
      await this.loadCatalogue();
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }

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
    if (isSoggetto(c)) return c.name || "";
    if (isVisit(c)) return c.name || "";
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
    if (isSoggetto(c)) {
      parts.push((c.author && c.author.name) || "");
      parts.push((c.style && c.style.name) || "");
    } else if (isVisit(c)) {
      parts.push(c.author || "");
      parts.push(c.level || "");
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
    if (isSoggetto(c)) return "";
    if (isVisit(c)) return c.level || "";
    return c.educationalLevel || "";
  }

  private inTono(filtro: string, tono: string): boolean {
    if (filtro === "tutti") return true;
    return tono === filtro;
  }

  private inSecondi(filtro: string, secondi: number | string): boolean {
    if (filtro === "tutti") return true;
    return String(secondi) === filtro;
  }

  private inFascia(filtro: string, secondi: number): boolean {
    if (filtro === "tutti") return true;
    const banda = visitDurationBands.find((b) => b.value === filtro);
    if (!banda) return true;
    return banda.test(durationMinutes(secondi));
  }

  private opzioniSecondi(): { value: string; label: string }[] {
    return secPerArt.map((s) => ({
      value: String(s),
      label: this.t("{n} secondi di lettura", { n: s }),
    }));
  }

  private opzioniFasce(): { value: string; label: string }[] {
    return visitDurationBands.map((b) => ({
      value: b.value,
      label: this.t(b.label),
    }));
  }

  availableLevels(): string[] {
    const present = new Set<string>();
    const contenuti: Content[] = [
      ...this.marketItems,
      ...this.myItems,
      ...this.visits,
    ];
    for (const c of contenuti) {
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
      isVisit(item) &&
      item.author === this.currentUser
    )
      return true;
    return this.userCollection.includes(item["@id"]);
  }

  canBuy(): boolean {
    return this.currentUserRole === "visitatore";
  }

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

  private visibleInMarket(c: Content | null): boolean {
    if (!c) return true;
    if (isVisit(c) && c.accessKey) return c.author === this.currentUser;
    if (c.visibility === "privato") return c.author === this.currentUser;
    return true;
  }

  async buy(item: Content) {
    if (!this.currentUser || this.inLibrary(item)) return;
    if (isVisit(item) && item.accessKey) return;

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

      if (isItem(item) && item.about && typeof item.about === "object") {
        const qid = item.about.qid;
        const i = this.artworksWithText.indexOf(qid);
        if (i >= 0) this.artworksWithText.splice(i, 1);
      }

      await this.reloadVisits();
      const nome = this.contentName(item) || "Contenuto";
      this.showToast(`"${nome}" è ora nella tua libreria.`);
    } catch (e) {
      this.showToast((e as Error).message, "error");
    }
  }

  costoDi(content: Content | null): number {
    if (!content) return 0;
    if (isVisit(content) && typeof content.totale === "number")
      return content.totale;
    return Number(content.price) || 0;
  }

  visitPrice(v: Visit | null): string {
    if (this.inLibrary(v)) {
      if (v && v.author && v.author === this.currentUser)
        return this.t("Pubblicata da te");
      return this.t("Acquistato");
    }
    return this.readablePrice(this.costoDi(v));
  }

  mancantiDi(content: Content | null): number {
    if (!content || !isVisit(content)) return 0;
    if (typeof content.mancanti !== "number") return 0;
    return content.mancanti;
  }

  async reloadVisits() {
    const qid = this.selectedMuseum ? this.selectedMuseum.qid : "";
    if (!qid) return;
    this.visits = await ArtAPI.fetchVisite(qid);
    this.reindicizza();
  }

  unlockVisitLabel(v: Visit): string {
    return `Sblocca (€ ${(Number(v.costoMancanti) || 0).toFixed(2)})`;
  }

  visitUsable(visit: Visit): boolean {
    return this.inLibrary(visit) && this.mancantiDi(visit) === 0;
  }

  openCompleteVisit(visit: Visit) {
    if (!this.currentUser || this.mancantiDi(visit) === 0) return;
    this.visitToComplete = visit;
    this.confirmOpen = true;
  }

  canDeleteVisit(visit: Visit | null): boolean {
    if (!visit || !this.currentUser) return false;
    if (this.currentUserRole === "curatore") return true;
    return visit.author === this.currentUser;
  }

  canDeleteItem(item: Item | null): boolean {
    if (!item || !this.currentUser) return false;
    if (this.currentUserRole === "curatore") return true;
    return item.author === this.currentUser;
  }

  openDeleteVisit(visit: Visit) {
    if (!this.canDeleteVisit(visit)) return;
    this.visitToDelete = visit;
    this.confirmOpen = true;
  }

  async openDeleteItem(item: Item) {
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

    const mancanti = this.mancantiDi(item);
    if (mancanti > 0) {
      const curatela = (Number(item.price) || 0).toFixed(2);
      const daPagare = isVisit(item) ? item.costoMancanti : 0;
      const contenuti = (Number(daPagare) || 0).toFixed(2);
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

  private elencoVisite(visite: { name: string }[]): string {
    const nomi = visite
      .slice(0, 3)
      .map((v) => `"${v.name}"`)
      .join(", ");
    if (visite.length <= 3) return nomi;
    return this.t("{nomi} e altre {n}", { nomi, n: visite.length - 3 });
  }

  visiteInGioco(): VisitaNominata[] {
    if (this.operaToDelete && this.operaImpact)
      return this.operaImpact.visite || [];
    if (this.itemToDelete && this.itemImpact)
      return this.itemImpact.visite || [];
    return [];
  }

  visiteSvuotate(): VisitaNominata[] {
    if (this.operaToDelete && this.operaImpact)
      return this.operaImpact.svuotate || [];
    if (this.itemToDelete && this.itemImpact)
      return this.itemImpact.svuotate || [];
    return [];
  }

  scegliVisite(modo: "accorcia" | "elimina") {
    this.visiteScelta = modo;
  }

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
        this.visits = this.visits.filter((c) => c["@id"] !== visit["@id"]);
        this.reindicizza();
        this.userCollection = this.userCollection.filter(
          (id) => id !== visit["@id"],
        );
        this.showToast("Visita eliminata.");
        if (this.currentUserRole === "curatore") await this.loadMuseumState();

        if (this.view === "visita") this.goHome();
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
    if (tipo === "opere" || tipo === "visite")
      this.catalogSubjectFilter = "tutti";
  }

  setCatalogSubject(soggetto: "tutti" | "opera" | "meta") {
    this.catalogSubjectFilter = soggetto;
  }

  descrizioniDi(artwork: Artwork): number {
    const id = artwork["@id"];
    let quante = 0;
    for (const it of this.curatedItems) {
      const about = it.about;
      const suo = typeof about === "object" && about ? about["@id"] : about;
      if (suo === id) quante++;
    }
    return quante;
  }

  catalogDurationOptions(): { value: string; label: string }[] {
    if (this.catalogTypeFilter === "descrizioni") return this.opzioniSecondi();
    if (this.catalogTypeFilter === "visite") return this.opzioniFasce();
    return [];
  }

  catalogRowLabel(row: CatalogRow): string {
    if (row.kind === "opera") return this.t("Opera");
    if (row.kind === "visita") return this.t("Visita");
    return this.t("Descrizione");
  }

  catalogPriceLabel(row: CatalogRow): string {
    if (row.kind === "opera") return "n/d";
    return this.readablePrice(row.price);
  }

  catalogRowCaption(row: CatalogRow): string {
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

  durationLabel(row: CatalogRow): string {
    if (row.kind === "opera") return "n/d";
    if (row.kind === "item") return `${row.duration} s`;
    return this.readableDuration(row.duration);
  }

  private matchesCatalogDuration(row: CatalogRow): boolean {
    if (row.kind === "item")
      return this.inSecondi(this.catalogDurationFilter, row.duration);
    return this.inFascia(this.catalogDurationFilter, row.duration);
  }

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

        const soggetto = (it.kind || "opera") !== "opera";
        if (this.catalogSubjectFilter === "opera" && soggetto) continue;
        if (this.catalogSubjectFilter === "meta" && !soggetto) continue;
        rows.push({
          kind: "item",
          id: it["@id"],
          name: this.contentName(it),
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

  openWipeMuseum() {
    if (!this.selectedMuseum) return;
    this.museoToWipe = this.selectedMuseum;
    this.confirmOpen = true;
  }

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

  async openDeleteArtwork(opera: Artwork | null) {
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

  async openDeleteRow(row: CatalogRow) {
    if (!row) return;
    if (row.kind === "opera" && isArtwork(row.raw)) {
      await this.openDeleteArtwork(row.raw);
      return;
    }
    if (row.kind === "visita" && isVisit(row.raw)) {
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

  watchSales() {
    if (this.view === "vendite") this.loadSales();
  }

  showToast(messaggio: string, tipo: "success" | "error" = "success") {
    this.toast = { messaggio, tipo };
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = null;
    }, 5500);
  }

  closeToast() {
    this.toast = null;
  }

  readableDuration(secondi: number): string {
    const minuti = durationMinutes(secondi);
    if (minuti < 1) return this.t("meno di 1 min");
    return this.t("{n} min", { n: minuti });
  }

  visitSummary(v: Visit): string {
    const tappe = (v.itemListElement || []).length;
    const parts = [
      tappe === 1 ? this.t("1 tappa") : this.t("{n} tappe", { n: tappe }),
      this.readableDuration(v.duration),
    ];

    const livello = this.visitLevelLabel(v);
    if (livello) parts.push(livello);
    return parts.join(" · ");
  }

  setMarketType(tipo: "tutti" | "visite" | "opere" | "meta") {
    this.marketType = tipo;
    this.marketDurationFilter = "tutti";
  }

  private gruppoDiSoggetto(g: ArtworkGroup): boolean {
    return !!(g && g.artwork && g.artwork.kind);
  }

  marketDurationOptions(): { value: string; label: string }[] {
    if (this.marketType === "opere" || this.marketType === "meta")
      return this.opzioniSecondi();
    if (this.marketType === "visite") {
      return visitDurationBands.map((b) => ({
        value: b.value,
        label: this.t(b.label),
      }));
    }
    return [];
  }

  private matchesMarketDuration(secondi: number): boolean {
    if (this.marketType !== "visite") return true;
    return this.inFascia(this.marketDurationFilter, secondi);
  }

  visitTones(v: Visit): string[] {
    const toni = new Set<string>();
    for (const id of v.itemListElement || []) {
      const it = this.findItem(id);
      if (it && isItem(it) && it.educationalLevel)
        toni.add(it.educationalLevel);
    }
    if (toni.size === 0 && v.level) toni.add(v.level);
    return [...toni];
  }

  isMixedVisit(v: Visit): boolean {
    return this.visitTones(v).length > 1;
  }

  visitLevelLabel(v: Visit): string {
    if (this.isMixedVisit(v)) return this.t("Misto");
    const toni = this.visitTones(v);
    if (toni.length === 1) return this.t(toni[0]);
    if (v.level) return this.t(v.level);
    return "";
  }

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
      return this.matchesMarketDuration(v.duration);
    });
  }

  soggettoIdOf(c: Item | null): string {
    if (!c) return "?";
    const art = c.about;
    if (art && typeof art === "object") return art["@id"];
    if (typeof art === "string" && art) return art;
    if (c.subject) return `${c.kind}:${c.subject}`;
    return "?";
  }

  private soggettoDi(c: Item): Soggetto {
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
    const perId = new Map<string, Item>();
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

  groupByArtwork(lista: Item[]): ArtworkGroup[] {
    const groups = new Map<string, ArtworkGroup>();
    for (const c of lista) {
      if (!isItem(c)) continue;
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
    const items = this.visibleItems().filter((i) => {
      if (this.marketLevelFilter === "misto") return false;
      if (!this.inTono(this.marketLevelFilter, i.educationalLevel)) return false;
      if (this.marketType === "opere" || this.marketType === "meta")
        return this.inSecondi(this.marketDurationFilter, i.timeRequired);
      return true;
    });
    let groups = this.groupByArtwork(items);
    if (this.marketType === "opere")
      groups = groups.filter((g) => !this.gruppoDiSoggetto(g));
    if (this.marketType === "meta")
      groups = groups.filter((g) => this.gruppoDiSoggetto(g));
    if (!this.marketSearch.trim()) return groups;
    return groups.filter((g) =>
      this.matchesSearch(g.artwork, this.marketSearch),
    );
  }

  marketSummary(): string {
    const v = this.shownVisits().length;
    const gruppi = this.shownArtworks();

    const soggetti = gruppi.filter((g) => this.gruppoDiSoggetto(g)).length;
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

  artworkCount(g: ArtworkGroup): string {
    const n = g.items.length;
    if (n === 1) return this.t("1 descrizione");
    return this.t("{n} descrizioni", { n });
  }

  artworkFromPrice(g: ArtworkGroup): string {
    const prices = g.items.map((i) => Number(i.price) || 0);
    const cheapest = prices.length ? Math.min(...prices) : 0;
    if (cheapest === 0) return this.t("Gratis");
    return this.t("da {prezzo}", { prezzo: `€ ${cheapest.toFixed(2)}` });
  }

  currentArtwork(): Soggetto | null {
    if (this.view !== "opera" || !this.param) return null;
    const p = this.param;
    const opera = this.availableArtworks.find(
      (a) => a.qid === p || a["@id"] === p,
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
      (i) => this.soggettoIdOf(i) === art["@id"],
    );
    return items.sort(
      (a, b) =>
        educationalLevels.indexOf(a.educationalLevel) -
        educationalLevels.indexOf(b.educationalLevel),
    );
  }

  artworkLevelFilter: string = "tutti";
  artworkDurationFilter: string = "tutti";

  artworkLevels(): string[] {
    const presenti = new Set<string>();
    for (const i of this.artworkItems()) presenti.add(i.educationalLevel);
    return educationalLevels.filter((l) => presenti.has(l));
  }

  artworkDurations(): number[] {
    const presenti = new Set<string>();
    for (const i of this.artworkItems()) presenti.add(String(i.timeRequired));
    return secPerArt.filter((s) => presenti.has(String(s)));
  }

  shownArtworkItems(): Item[] {
    return this.artworkItems().filter(
      (i) =>
        this.inTono(this.artworkLevelFilter, i.educationalLevel) &&
        this.inSecondi(this.artworkDurationFilter, i.timeRequired),
    );
  }

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

  toneClass(livello: string | undefined): string {
    if (!livello) return "";
    return "pastiglia-tono-" + livello.toLowerCase();
  }

  itemKinds = itemKinds;
  museumTopics: { name: string; kind: string }[] = [];

  maxVisiteVisitatore = MAX_VISITE_VISITATORE;

  topicSuggestions(): string[] {
    const genere = this.draft.genere;
    const nomi: string[] = [];
    for (const t of this.museumTopics) {
      if (t.kind === genere) nomi.push(t.name);
    }
    return nomi;
  }

  visitImage(v: Visit | null): string {
    if (!v) return "";
    return v.imagePath || "";
  }

  museumImage(m: Museum | null): string {
    if (!m || !m.imagePath) return "";
    return encodeURI(m.imagePath);
  }

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

  soggettoLink(nome: string, genere: string): string {
    if (!nome || nome === "Unknown") return "";
    const chiave = `${genere}:${nome}`;
    for (const i of this.visibleItems()) {
      if (this.soggettoIdOf(i) === chiave)
        return `/opera/${encodeURIComponent(chiave)}`;
    }
    return "";
  }

  kindName(id: string): string {
    const genere = kindById(id);
    if (genere) return genere.name;
    return "";
  }

  nomeAutore(): string {
    const a = this.currentArtwork();
    if (!a || !a.author || !a.author.name) return "";
    if (a.author.name.startsWith("http")) return "";
    return a.author.name;
  }

  nomeStile(): string {
    const a = this.currentArtwork();
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

  artworksWithText: string[] = [];

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
    return this.visits.find((v) => v["@id"] === this.param) || null;
  }

  visitStops(v: Visit | null): {
    id: string;
    numero: number;
    nome: string;
    opzionale: boolean;
    item: Content | null;
  }[] {
    if (!v) return [];
    return (v.itemListElement || []).map((id: string, i: number) => ({
      id,
      numero: i + 1,
      nome: this.itemName(id),
      opzionale: (v.optionalItems || []).includes(id),
      item: this.findItem(id),
    }));
  }

  notesAfter(v: Visit | null, itemId: string): string[] {
    if (!v) return [];
    const notes: string[] = [];
    for (const n of v.logistics || []) {
      if (n && typeof n === "object" && n.after === itemId && n.text)
        notes.push(n.text);
    }
    return notes;
  }

  openingNotes(v: Visit | null): string[] {
    if (!v) return [];
    const notes: string[] = [];
    for (const n of v.logistics || []) {
      if (typeof n === "string" && n.trim() !== "") notes.push(n);
      else if (n && typeof n === "object" && !n.after && n.text)
        notes.push(n.text);
    }
    return notes;
  }

  myVisits(): Visit[] {
    const base = [...this.visits].filter(
      (v) =>
        this.belongsToMuseum(v) &&
        this.inLibrary(v) &&
        this.visibleInMarket(v) &&
        this.matchesSearch(v, this.librarySearch),
    );
    return base;
  }

  myItemGroups(): ArtworkGroup[] {
    const posseduti = this.visibleItems().filter(
      (i) =>
        this.inLibrary(i) && this.matchesSearch(i, this.librarySearch),
    );
    return this.groupByArtwork(posseduti);
  }

  workItemGroups(): ArtworkGroup[] {
    if (this.worksTypeFilter === "visite") return [];
    const items = this.myItems.filter(
      (i) => this.belongsToMuseum(i) && this.matchesSearch(i, this.worksSearch),
    );
    return this.groupByArtwork(items);
  }

  workVisits(): Visit[] {
    if (this.worksTypeFilter === "item") return [];
    return this.visits.filter(
      (v) =>
        v.author === this.currentUser &&
        this.belongsToMuseum(v) &&
        this.matchesSearch(v, this.worksSearch),
    );
  }

  adoptionsOf(id: string): number | null {
    const riga = this.sales.find((r) => r.id === id);
    return riga ? riga.adozioni : null;
  }

  draftSubject(): SoggettoBozza | null {
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
      (a) => a["@id"] === this.draft.selectedArtworkUri,
    );
    if (!trovata) return null;
    return trovata;
  }

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

  artworkImage(about: Artwork | Soggetto | string | null | undefined): string {
    if (!about || typeof about !== "object") return "";
    return about.imagePath || about.imageUri || "";
  }

  miniatura(figura: string): string {
    return percorsoMiniatura(figura);
  }

  private navigatorBase(): string {
    if (this.navigatorOrigin) return this.navigatorOrigin;
    return `${window.location.protocol}//${window.location.hostname}:5173`;
  }

  navigatorUrl(v: Visit | null): string {
    if (!v) return "#";
    const uri: string = v.ofMuseum || "";
    const museumQid = uri.split("/").pop() || "";
    return (
      `${this.navigatorBase()}/` +
      `?museum=${encodeURIComponent(museumQid)}` +
      `&visit=${encodeURIComponent(v["@id"])}`
    );
  }

  async openNavigator(url: string): Promise<boolean> {
    if (!url || url === "#") return false;
    this.loading = true;
    await this.afterPaint();
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

  entryTarget: "marketplace" | "navigator" = "marketplace";

  enterFrom(target: "marketplace" | "navigator") {
    this.entryTarget = target;
    this.goTo("accedi");
  }

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

  startGuidedUrl(visit: Visit): string {
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
      this.announce(
        `Sei in sala d'attesa per ${this.guidedSession.visitName}.`,
      );
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

  editItem(item: Item | null) {
    if (!item || !isItem(item) || item.author !== this.currentUser) return;
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

  private draftSubjectKey(): string {
    if (this.draft.genere === "opera")
      return this.draft.selectedArtworkUri || "";
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

  editVisit(visit: Visit | null) {
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
    this.draft.quiz = (visit.quiz || []).map((q) => ({
      question: q.question || "",
      options: [...(q.options || ["", "", "", ""])],
      correct: Number(q.correct) || 0,
    }));
    this.draft.immagine = visit.imagePath || "";
    this.draft.tappe = this.rebuildStops(visit);
    this.goTo("componi");
  }

  private rebuildStops(visit: Visit) {
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
    const src = this.visits.find((v) => v["@id"] === visitId);
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

  canRead(item: Item | null): boolean {
    if (!item) return false;
    const id = item["@id"];
    return isReadable(
      item,
      this.currentUser || "",
      this.userCollection.includes(id),
    );
  }

  private percorrenza(gruppi: ArtworkGroup[]): ArtworkGroup[] {
    const posto = new Map<string, number>();
    this.availableArtworks.forEach((a, i) =>
      posto.set(a["@id"], i),
    );
    const dopo = this.availableArtworks.length;
    return [...gruppi].sort((a, b) => {
      const ia = posto.get(a.artwork["@id"]);
      const ib = posto.get(b.artwork["@id"]);
      return (ia === undefined ? dopo : ia) - (ib === undefined ? dopo : ib);
    });
  }

  editorLibrary(): ArtworkGroup[] {
    let base = this.visibleItems();
    if (this.currentUserRole === "autore") {
      base = base.filter((i) => this.canRead(i));
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

  itemImage(id: string): string {
    const item = this.findItem(id);
    if (!item || !isItem(item)) return "";
    if (item.about) return this.artworkImage(item.about);
    return item.imagePath || "";
  }

  itemInVisit(id: string) {
    return this.draft.tappe.some((t) => t.tipo === "item" && t.value === id);
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

  composedVisitCount(): number {
    if (!this.currentUser) return 0;
    return this.visits.filter(
      (v) => v.author === this.currentUser && this.belongsToMuseum(v),
    ).length;
  }

  visitCapReached(): boolean {
    if (this.currentUserRole !== "visitatore") return false;
    if (this.editingId) return false;
    return this.composedVisitCount() >= MAX_VISITE_VISITATORE;
  }

  visitsLeft(): number {
    return Math.max(0, MAX_VISITE_VISITATORE - this.composedVisitCount());
  }

  visitCapMessage(): string {
    return this.t(
      "Hai raggiunto i {n} itinerari di questo museo. Eliminane uno dalla tua libreria per comporne un altro.",
      { n: MAX_VISITE_VISITATORE },
    );
  }

  draftSummary(): string {
    const tappe = this.stopCount();
    const conta =
      tappe === 1 ? this.t("1 tappa") : this.t("{n} tappe", { n: tappe });
    return `${conta} · ${this.readableDuration(this.estimatedDuration())}`;
  }

  visitStatus(): string {

    if (this.visitCapReached()) return this.visitCapMessage();
    const issues = this.visitIssues();
    if (issues.length > 0)
      return this.t("Manca ancora: {elenco}.", { elenco: issues.join(", ") });
    return this.t("Pronta · {riepilogo}", { riepilogo: this.draftSummary() });
  }

  nextVisitStep(): string {
    if (this.visitStep === "percorso") return "impostazioni";
    if (this.visitStep === "impostazioni") {
      if (this.currentUserRole === "autore" && this.draft.guidata)
        return "quiz";
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
    if (this.draft.guidata)
      return this.editingId ? "Salva le modifiche" : "Crea visita";
    return this.editingId ? "Salva le modifiche" : "Pubblica in vetrina";
  }

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

      licenza:
        this.currentUserRole === "autore"
          ? this.draft.license
          : DEFAULT_LICENSE,
      museumUri: this.selectedMuseum
        ? `http://www.wikidata.org/entity/${this.selectedMuseum.qid}`
        : undefined,

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

  readableRevenue(r: SaleRow): string {
    if (!r.price || Number(r.price) === 0) return "n/d";
    return `€ ${(r.ricavo || 0).toFixed(2)}`;
  }

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
