import {
  UserRole,
  Contenuto,
  Item,
  Visit,
  Artwork,
  Museum,
} from "../../../shared/types.js";
import {
  licenses,
  educationalLevels,
  educationalLevelHints,
  formatDurata,
} from "../../../shared/constants.js";
import { ArtAPI } from "./api.js";

/**
 * IL DEPOSITO — stato del marketplace (prelude.md §7).
 *
 * Tre cose distinguono questo file dalla versione precedente:
 *
 *  1. C'E' UN ROUTER. Ogni schermata ha un indirizzo (`#/opere`, `#/opera/Q12418`).
 *     Il tasto "indietro" del browser funziona, un ricaricamento non perde il
 *     posto, un link si puo' passare a qualcuno. Le finestre modali restano solo
 *     per le CONFERME: erano diventate un sistema di navigazione travestito.
 *  2. NON SI CHIEDE PRIMA DI MOSTRARE. Si entra da una soglia, non da un modulo;
 *     il ruolo non e' piu' una domanda al login (lo risolve il server); il museo
 *     si sceglie una volta e poi resta nel binario laterale.
 *  3. SI VENDONO VISITE, SI SFOGLIANO OPERE. Due cataloghi con un tipo di
 *     oggetto ciascuno, invece di una griglia mista con cinque filtri sopra.
 */

/** Le schermate. Una vista = un indirizzo (vedi `parseHash`). */
export type Vista =
  | "soglia"
  | "accedi"
  | "registrati"
  | "musei"
  | "banco"
  | "visite"
  | "opere"
  | "opera"
  | "visita"
  | "libreria"
  | "componi"
  | "nuovo"
  | "lavori"
  | "vendite";

export class AppState {
  // --- Rotta corrente -------------------------------------------------------
  vista: Vista = "soglia";
  parametro: string = ""; // qid dell'opera o @id della visita, secondo la vista

  currentUser: string | null = null;
  currentUserType: UserRole | null = null;

  // Messaggio per la live region: ogni cambio di vista e ogni conteggio di
  // risultati passano di qui (in una SPA nulla si annuncia da solo).
  annuncio: string = "";

  // --- Ricerca e filtri -----------------------------------------------------
  // Una barra per catalogo e AL MASSIMO due filtri: cinque controlli sopra
  // dodici risultati sono arredamento. Il filtro "durata per opera" e' stato
  // rimosso del tutto perche' escludeva silenziosamente ogni visita.
  ricercaVisite: string = "";
  filtroLivelloVisite: string = "tutti";
  filtroDurataVisite: "tutti" | "breve" | "media" | "lunga" = "tutti";

  ricercaOpere: string = "";
  filtroLivelloOpere: string = "tutti";

  ricercaLibreria: string = "";
  filtroTipoLibreria: "tutti" | "item" | "visite" = "tutti";

  ricercaLavori: string = "";
  filtroTipoLavori: "tutti" | "item" | "visite" = "tutti";

  ricercaEditor: string = "";
  filtroEditor: "tutti" | "disponibili" | "da_acquistare" = "tutti";

  // --- Visita guidata (studente) --------------------------------------------
  passkeyInput: string = "";
  guidedTrovata: { id: string; visitName: string } | null = null;

  // --- Portafoglio e possesso ----------------------------------------------
  wallet: number = 0;
  collezioneUtente: string[] = [];

  // --- Conferme (l'unica finestra modale rimasta) ---------------------------
  modalConferma: boolean = false;
  itemDaAcquistare: Contenuto | null = null;
  visitaAcquistoMancanti: any = null;
  visitaDaEliminare: any = null;

  // --- Notifiche ------------------------------------------------------------
  toast: { messaggio: string; tipo: "success" | "error" } | null = null;
  private toastTimer: any = null;

  // --- Dati -----------------------------------------------------------------
  contenuti: Contenuto[] = []; // visite
  itemsMarket: Item[] = []; // item pubblici
  mieOpere: Item[] = []; // item dell'autore collegato (inclusi i privati)
  availableArtworks: Artwork[] = [];
  musei: Museum[] = [];
  museoSelezionato: Museum | null = null;
  vendite: any[] = [];
  caricamento: boolean = false;

  // Origine del navigator: arriva dal server (/api/config), non e' piu' una
  // porta scritta a mano in tre punti del file.
  private navigatorOrigin: string = "";

  licenze: string[] = licenses;
  toni: string[] = educationalLevels;
  toniDescrizione: Record<string, string> = educationalLevelHints;

  // --- Editor ---------------------------------------------------------------
  editingId: string | null = null;
  /** Passo del banco di lavoro della visita (prelude.md §M10) */
  passoVisita: "percorso" | "impostazioni" | "quiz" = "percorso";
  /** Su schermi stretti il banco di lavoro diventa due schede */
  pannelloEditor: "percorso" | "libreria" = "percorso";
  nuovaOpera = this.resetNuovaOpera();

  formLogin = { username: "", password: "" };
  formReg = {
    username: "",
    password: "",
    conferma: "",
    role: "visitatore" as UserRole,
  };
  /** Popolato quando le stesse credenziali valgono per due account di ruolo
   *  diverso: e' l'unico caso in cui il ruolo va ancora chiesto. */
  scegliRuolo: UserRole[] | null = null;

  // =========================================================================
  //  ROUTER
  // =========================================================================

  /** Traduce `location.hash` in (vista, parametro). Sconosciuto -> home. */
  private parseHash(): { vista: Vista; parametro: string } {
    const raw = (window.location.hash || "").replace(/^#\/?/, "");
    const [testa, coda] = [raw.split("/")[0] || "", raw.split("/").slice(1).join("/")];
    const param = decodeURIComponent(coda || "");
    const note: Vista[] = [
      "soglia",
      "accedi",
      "registrati",
      "musei",
      "banco",
      "visite",
      "opere",
      "opera",
      "visita",
      "libreria",
      "componi",
      "nuovo",
      "lavori",
      "vendite",
    ];
    for (const v of note) {
      if (testa === v) return { vista: v, parametro: param };
    }
    return { vista: "soglia", parametro: "" };
  }

  /** Applica la rotta, facendo rispettare le due sole precondizioni:
   *  serve un utente, e serve un museo. */
  applicaRotta() {
    const { vista, parametro } = this.parseHash();
    const pubbliche: Vista[] = ["soglia", "accedi", "registrati"];

    // Non collegato: si resta sulle schermate pubbliche.
    if (!this.currentUser) {
      this.vista = pubbliche.includes(vista) ? vista : "soglia";
      this.parametro = "";
      this.annunciaVista();
      return;
    }
    // Collegato ma senza museo: il pannello di scelta e' l'unica tappa.
    if (!this.museoSelezionato) {
      this.vista = "musei";
      this.parametro = "";
      this.annunciaVista();
      return;
    }
    // Collegato con museo: le schermate pubbliche non hanno piu' senso.
    if (pubbliche.includes(vista)) {
      this.vaiA(this.homeDelRuolo());
      return;
    }
    this.vista = vista;
    this.parametro = parametro;
    this.annunciaVista();
  }

  /** Naviga: cambia l'hash e lascia che sia `applicaRotta` a reagire. */
  vaiA(vista: Vista, parametro?: string) {
    const nuovo = parametro
      ? `#/${vista}/${encodeURIComponent(parametro)}`
      : `#/${vista}`;
    if (window.location.hash === nuovo) this.applicaRotta();
    else window.location.hash = nuovo;
  }

  homeDelRuolo(): Vista {
    return this.currentUserType === "autore" ? "lavori" : "banco";
  }

  tornaHome() {
    this.vaiA(this.homeDelRuolo());
  }

  /** Titolo leggibile della vista: lo usano il <title>, l'h1 e la live region. */
  etichettaVista(): string {
    const nomi: Record<Vista, string> = {
      soglia: "ArtAround",
      accedi: "Accedi",
      registrati: "Crea un profilo",
      musei: "Scegli il museo",
      banco: "Il banco",
      visite: "Visite",
      opere: "Opere",
      opera: "Scheda dell'opera",
      visita: "Scheda della visita",
      libreria: "La mia libreria",
      componi: this.editingId ? "Modifica la visita" : "Componi una visita",
      nuovo: this.editingId ? "Modifica la descrizione" : "Nuova descrizione",
      lavori: "I miei contenuti",
      vendite: "Vendite e adozioni",
    };
    return nomi[this.vista] || "";
  }

  private annunciaVista() {
    document.title = `${this.etichettaVista()} · ArtAround`;
    this.annuncia(this.etichettaVista());
  }

  /** Scrive nella live region (azzerando prima, cosi' un messaggio identico
   *  viene comunque riletto dagli screen reader). */
  annuncia(testo: string) {
    this.annuncio = "";
    window.requestAnimationFrame(() => {
      this.annuncio = testo;
    });
  }

  // =========================================================================
  //  AVVIO
  // =========================================================================

  async avvia() {
    window.addEventListener("hashchange", () => this.applicaRotta());
    try {
      const cfg = await ArtAPI.fetchConfig();
      this.navigatorOrigin = cfg.navigatorOrigin || "";
    } catch {
      // il server non espone la configurazione: si ripiega sull'host corrente
      this.navigatorOrigin = "";
    }
    this.applicaRotta();
  }

  async initApp() {
    this.caricamento = true;
    try {
      this.musei = await ArtAPI.fetchMuseums();
      const arts = await ArtAPI.fetchArtworks();
      this.availableArtworks = arts.sort((a, b) =>
        (a.name || "").localeCompare(b.name || ""),
      );
      this.contenuti = await ArtAPI.fetchVisite();
      this.itemsMarket = await ArtAPI.fetchItems();

      if (this.currentUser && this.currentUserType === "autore") {
        this.mieOpere = await ArtAPI.fetchMyItems(this.currentUser);
      } else {
        this.mieOpere = [];
      }

      // Il museo si sceglie una volta sola: se ne resta uno solo, o se e' gia'
      // stato scelto in una sessione precedente, non si richiede.
      if (!this.museoSelezionato) {
        const ricordato = localStorage.getItem("artaround-museo");
        const trovato = this.musei.find((m) => m.qid === ricordato);
        if (trovato) this.museoSelezionato = trovato;
        else if (this.musei.length === 1) this.museoSelezionato = this.musei[0];
      }
      this.vaiA(this.museoSelezionato ? this.homeDelRuolo() : "musei");
    } catch (e) {
      console.error("Errore durante l'inizializzazione dei dati:", e);
      this.mostraToast(
        "Non riesco a contattare il server. Controlla che sia avviato e riprova.",
        "error",
      );
    } finally {
      this.caricamento = false;
    }
  }

  // =========================================================================
  //  ACCESSO
  // =========================================================================

  async effettuaLogin() {
    const { username, password } = this.formLogin;
    if (!username || !password)
      return this.mostraToast("Inserisci username e password.", "error");
    try {
      const esito = await ArtAPI.login(username, password);
      // Stesse credenziali valide per due profili: e' l'unico caso in cui il
      // ruolo va chiesto, e si chiede DOPO, con le due opzioni descritte.
      if ((esito as any).scelta) {
        this.scegliRuolo = (esito as any).ruoli as UserRole[];
        return;
      }
      await this.entraCome(esito as any);
    } catch (e) {
      this.mostraToast((e as Error).message, "error");
    }
  }

  /** Secondo passo del login ambiguo: l'utente ha scelto il profilo. */
  async confermaRuolo(role: UserRole) {
    try {
      const u = await ArtAPI.login(
        this.formLogin.username,
        this.formLogin.password,
        role,
      );
      this.scegliRuolo = null;
      await this.entraCome(u as any);
    } catch (e) {
      this.mostraToast((e as Error).message, "error");
    }
  }

  private async entraCome(u: {
    username: string;
    role: UserRole;
    wallet?: number;
    collezione: string[];
  }) {
    this.currentUser = u.username;
    this.currentUserType = u.role;
    this.wallet = typeof u.wallet === "number" ? u.wallet : 0;
    this.collezioneUtente = u.collezione || [];
    this.formLogin = { username: "", password: "" };
    await this.initApp();
  }

  async concludiRegistrazione() {
    const { username, password, conferma, role } = this.formReg;
    if (!username || !password)
      return this.mostraToast("Compila username e password.", "error");
    if (password !== conferma)
      return this.mostraToast("Le due password non coincidono.", "error");
    try {
      const u = await ArtAPI.register(username, password, role);
      this.formReg = {
        username: "",
        password: "",
        conferma: "",
        role: "visitatore",
      };
      await this.entraCome(u as any);
    } catch (e) {
      this.mostraToast((e as Error).message, "error");
    }
  }

  logout() {
    this.currentUser = null;
    this.currentUserType = null;
    this.wallet = 0;
    this.collezioneUtente = [];
    this.contenuti = [];
    this.itemsMarket = [];
    this.mieOpere = [];
    this.musei = [];
    this.museoSelezionato = null;
    this.vendite = [];
    this.editingId = null;
    this.scegliRuolo = null;
    this.guidedTrovata = null;
    this.passkeyInput = "";
    this.ricercaVisite = "";
    this.ricercaOpere = "";
    this.ricercaLibreria = "";
    this.ricercaLavori = "";
    this.ricercaEditor = "";
    this.filtroLivelloVisite = "tutti";
    this.filtroDurataVisite = "tutti";
    this.filtroLivelloOpere = "tutti";
    this.filtroTipoLibreria = "tutti";
    this.filtroTipoLavori = "tutti";
    this.filtroEditor = "tutti";
    this.nuovaOpera = this.resetNuovaOpera();
    localStorage.removeItem("artaround-museo");
    this.vaiA("soglia");
  }

  // =========================================================================
  //  MUSEO
  // =========================================================================

  private museoEntityId(): string | null {
    return this.museoSelezionato
      ? `http://www.wikidata.org/entity/${this.museoSelezionato.qid}`
      : null;
  }

  private appartieneAlMuseo(c: any): boolean {
    const museo = this.museoEntityId();
    if (!museo) return false;
    const ofMuseum =
      c && c.ofMuseum
        ? c.ofMuseum
        : c && typeof c.about === "object" && c.about
          ? c.about.ofMuseum
          : undefined;
    return ofMuseum === museo;
  }

  selezionaMuseo(m: Museum) {
    this.museoSelezionato = m;
    localStorage.setItem("artaround-museo", m.qid);
    this.vaiA(this.homeDelRuolo());
  }

  cambiaMuseo() {
    this.vaiA("musei");
  }

  /** Quante opere e quante visite ha un museo: sono i numeri che aiutano a
   *  scegliere, al posto del QID che non dice nulla a nessuno. */
  riepilogoMuseo(m: Museum): string {
    const uri = `http://www.wikidata.org/entity/${m.qid}`;
    const opere = this.availableArtworks.filter(
      (a: any) => a.ofMuseum === uri,
    ).length;
    const visite = (this.contenuti as any[]).filter(
      (v) => v.ofMuseum === uri && !v.accessKey,
    ).length;
    return `${opere} opere · ${visite} visite`;
  }

  opereDisponibili() {
    return this.availableArtworks.filter((a) => this.appartieneAlMuseo(a));
  }

  // =========================================================================
  //  RICERCA (motore invariato: funziona bene)
  // =========================================================================

  nomeContenuto(c: any): string {
    if (c && c["@type"] === "ItemList") return c.name || "";
    const art = c ? c.about : null;
    return (typeof art === "object" && art ? art.name : "") || "";
  }

  private normalizzaRicerca(s: string): string {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  private campiRicercabili(c: any): string {
    const parti: string[] = [this.nomeContenuto(c), (c && c.author) || ""];
    if (c && c["@type"] === "ItemList") {
      parti.push(c.level || "");
    } else if (c) {
      parti.push(c.educationalLevel || "");
      const art = c.about;
      if (art && typeof art === "object") {
        parti.push(
          art.name || "",
          (art.author && art.author.name) || "",
          (art.style && art.style.name) || "",
        );
      }
    }
    return this.normalizzaRicerca(parti.join(" "));
  }

  private corrispondeRicerca(c: any, query: string): boolean {
    const q = this.normalizzaRicerca(query);
    if (!q) return true;
    const haystack = this.campiRicercabili(c);
    const compatto = haystack.replace(/ /g, "");
    return q
      .split(" ")
      .every((tok) => !tok || haystack.includes(tok) || compatto.includes(tok));
  }

  private difficoltaDi(c: any): string {
    if (!c) return "";
    return (c["@type"] === "ItemList" ? c.level : c.educationalLevel) || "";
  }

  /** Difficolta' effettivamente presenti nel museo scelto, in ordine canonico. */
  difficoltaDisponibili(): string[] {
    const presenti = new Set<string>();
    for (const c of [
      ...this.itemsMarket,
      ...this.mieOpere,
      ...this.contenuti,
    ] as any[]) {
      if (!this.appartieneAlMuseo(c)) continue;
      const d = this.difficoltaDi(c);
      if (d) presenti.add(d);
    }
    const ordinate = educationalLevels.filter((l) => presenti.has(l));
    for (const d of presenti) if (!ordinate.includes(d)) ordinate.push(d);
    return ordinate;
  }

  // =========================================================================
  //  POSSESSO E ACQUISTO
  // =========================================================================

  haIlPossesso(item: Contenuto | null): boolean {
    if (!item) return false;
    if (this.currentUserType === "autore" && item.author === this.currentUser)
      return true;
    if (
      this.currentUserType === "visitatore" &&
      (item as any)["@type"] === "ItemList" &&
      item.author === this.currentUser
    )
      return true;
    return this.collezioneUtente.includes(item["@id"]);
  }

  /** Una visita guidata non si compra e non compare in vetrina: ci si entra
   *  con la parola chiave. Resta visibile al suo autore, che la gestisce. */
  private visibileNelMercato(c: any): boolean {
    if (!c || !c.accessKey) return true;
    return c.author === this.currentUser;
  }

  async compraOra(item: Contenuto) {
    if (!this.currentUser || this.haIlPossesso(item)) return;
    if ((item as any).accessKey) return;
    if (!item.price || item.price === 0) {
      await this.eseguiAcquisto(item);
      return;
    }
    this.itemDaAcquistare = item;
    this.modalConferma = true;
  }

  private async eseguiAcquisto(item: Contenuto) {
    if (!this.currentUser) return;
    try {
      const u = await ArtAPI.buy(this.currentUser, item["@id"], item.price || 0);
      this.wallet = typeof u.wallet === "number" ? u.wallet : 0;
      this.collezioneUtente = u.collezione;
      const nome = this.nomeContenuto(item) || "Contenuto";
      this.mostraToast(`"${nome}" è ora nella tua libreria.`);
    } catch (e) {
      this.mostraToast((e as Error).message, "error");
    }
  }

  itemsMancanti(visit: any): any[] {
    if (!visit || visit["@type"] !== "ItemList") return [];
    const mancanti: any[] = [];
    for (const id of visit.itemListElement || []) {
      const it = this.trovaItem(id);
      // Un id che non si risolve NON e' "posseduto": e' un contenuto che non
      // possiamo mostrare, e va segnalato come mancante (prima passava per buono).
      if (!it) {
        mancanti.push({ "@id": id, price: 0, sconosciuto: true });
        continue;
      }
      if (!this.haIlPossesso(it)) mancanti.push(it);
    }
    return mancanti;
  }

  costoMancanti(visit: any): number {
    return this.itemsMancanti(visit).reduce(
      (s: number, it: any) => s + (it.price || 0),
      0,
    );
  }

  visitaUtilizzabile(visit: any): boolean {
    return this.haIlPossesso(visit) && this.itemsMancanti(visit).length === 0;
  }

  apriAcquistoMancanti(visit: any) {
    if (!this.currentUser || this.itemsMancanti(visit).length === 0) return;
    this.visitaAcquistoMancanti = visit;
    this.modalConferma = true;
  }

  apriEliminaVisita(visit: any) {
    if (!visit || visit.author !== this.currentUser) return;
    this.visitaDaEliminare = visit;
    this.modalConferma = true;
  }

  titoloConferma(): string {
    if (this.visitaDaEliminare) return "Eliminare questa visita?";
    if (this.visitaAcquistoMancanti) return "Sbloccare i contenuti mancanti?";
    return "Confermi l'acquisto?";
  }

  messaggioConferma(): string {
    if (this.visitaDaEliminare) {
      return `"${this.visitaDaEliminare.name}" sparirà dal marketplace e dalle librerie di chi l'ha adottata. L'operazione non è reversibile.`;
    }
    if (this.visitaAcquistoMancanti) {
      const mancanti = this.itemsMancanti(this.visitaAcquistoMancanti);
      const costo = this.costoMancanti(this.visitaAcquistoMancanti);
      return `Per usare questa visita servono ${mancanti.length} contenuti che non hai ancora. Sbloccarli tutti costa € ${costo.toFixed(2)}.`;
    }
    const item = this.itemDaAcquistare;
    if (!item) return "";
    const nome = this.nomeContenuto(item) || "questo contenuto";
    return `"${nome}" resterà nella tua libreria. Costa € ${(item.price || 0).toFixed(2)}, il tuo credito è € ${this.wallet.toFixed(2)}.`;
  }

  verboConferma(): string {
    if (this.visitaDaEliminare) return "Elimina";
    if (this.visitaAcquistoMancanti) return "Sblocca tutto";
    return "Acquista";
  }

  annullaAcquisto() {
    this.modalConferma = false;
    this.itemDaAcquistare = null;
    this.visitaAcquistoMancanti = null;
    this.visitaDaEliminare = null;
  }

  async confermaAcquisto() {
    if (this.visitaDaEliminare) {
      const visita = this.visitaDaEliminare;
      this.annullaAcquisto();
      try {
        await ArtAPI.eliminaVisita(visita["@id"]);
        this.contenuti = this.contenuti.filter(
          (c: any) => c["@id"] !== visita["@id"],
        );
        this.collezioneUtente = this.collezioneUtente.filter(
          (id) => id !== visita["@id"],
        );
        this.mostraToast("Visita eliminata.");
        this.tornaHome();
      } catch (e) {
        this.mostraToast((e as Error).message, "error");
      }
      return;
    }

    if (this.visitaAcquistoMancanti) {
      const visita = this.visitaAcquistoMancanti;
      this.annullaAcquisto();
      if (!this.currentUser) return;
      try {
        for (const it of this.itemsMancanti(visita)) {
          if (it.sconosciuto) continue;
          const u = await ArtAPI.buy(this.currentUser, it["@id"], it.price || 0);
          this.wallet = typeof u.wallet === "number" ? u.wallet : 0;
          this.collezioneUtente = u.collezione;
        }
        this.mostraToast("Contenuti sbloccati: la visita è pronta.");
      } catch (e) {
        this.mostraToast((e as Error).message, "error");
      }
      return;
    }

    const item = this.itemDaAcquistare;
    this.annullaAcquisto();
    if (!item || !this.currentUser || this.haIlPossesso(item)) return;
    await this.eseguiAcquisto(item);
  }

  mostraToast(messaggio: string, tipo: "success" | "error" = "success") {
    this.toast = { messaggio, tipo };
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = null;
    }, 5500);
  }

  chiudiToast() {
    this.toast = null;
  }

  // =========================================================================
  //  CATALOGO VISITE  (#/visite)
  // =========================================================================

  /** Durata totale di una visita in minuti, per il filtro a fasce. */
  private minutiVisita(v: any): number {
    return Math.round((Number(v.duration) || 0) / 60);
  }

  durataLeggibile(secondi: number): string {
    return formatDurata(secondi);
  }

  /** Riga di metadati di una visita: quello su cui una persona sceglie. */
  riepilogoVisita(v: any): string {
    const tappe = (v.itemListElement || []).length;
    const parti = [
      `${tappe} ${tappe === 1 ? "tappa" : "tappe"}`,
      formatDurata(v.duration),
    ];
    if (v.level) parti.push(v.level);
    return parti.join(" · ");
  }

  visiteInVetrina(): any[] {
    const base = (this.contenuti as any[]).filter(
      (v) =>
        v["@type"] === "ItemList" &&
        this.appartieneAlMuseo(v) &&
        this.visibileNelMercato(v) &&
        this.corrispondeRicerca(v, this.ricercaVisite),
    );
    return base.filter((v) => {
      if (
        this.filtroLivelloVisite !== "tutti" &&
        v.level !== this.filtroLivelloVisite
      )
        return false;
      if (this.filtroDurataVisite === "tutti") return true;
      const min = this.minutiVisita(v);
      if (this.filtroDurataVisite === "breve") return min < 30;
      if (this.filtroDurataVisite === "media") return min >= 30 && min <= 60;
      return min > 60;
    });
  }

  // =========================================================================
  //  CATALOGO OPERE  (#/opere)  — una card per opera, gli item dentro
  // =========================================================================

  private artworkIdDi(c: any): string {
    const art = c ? c.about : null;
    return (art && typeof art === "object" ? art["@id"] : art) || "?";
  }

  /** Item pubblici del museo scelto (piu' i propri, se autore). */
  private itemVisibili(): any[] {
    const perId = new Map<string, any>();
    for (const i of this.itemsMarket as any[]) {
      if (this.appartieneAlMuseo(i)) perId.set(i["@id"], i);
    }
    if (this.currentUserType === "autore") {
      for (const i of this.mieOpere as any[]) {
        if (this.appartieneAlMuseo(i)) perId.set(i["@id"], i);
      }
    }
    return [...perId.values()];
  }

  raggruppaPerArtwork(lista: any[]): { artwork: any; items: any[] }[] {
    const gruppi = new Map<string, { artwork: any; items: any[] }>();
    for (const c of lista) {
      if (c["@type"] !== "CreativeWork") continue;
      const id = this.artworkIdDi(c);
      if (!gruppi.has(id)) {
        const art = c.about;
        gruppi.set(id, {
          artwork:
            art && typeof art === "object" ? art : { "@id": id, name: id },
          items: [],
        });
      }
      gruppi.get(id)!.items.push(c);
    }
    return [...gruppi.values()];
  }

  opereInVetrina(): { artwork: any; items: any[] }[] {
    const items = this.itemVisibili().filter((i) => {
      if (
        this.filtroLivelloOpere !== "tutti" &&
        i.educationalLevel !== this.filtroLivelloOpere
      )
        return false;
      return true;
    });
    const gruppi = this.raggruppaPerArtwork(items);
    if (!this.ricercaOpere.trim()) return gruppi;
    // La ricerca sulle opere confronta l'opera stessa, non i singoli item
    return gruppi.filter((g) =>
      this.corrispondeRicerca({ about: g.artwork, "@type": "CreativeWork" }, this.ricercaOpere),
    );
  }

  /** Sottotitolo di una card-opera: quanti contenuti e da che prezzo. */
  riepilogoOpera(g: { artwork: any; items: any[] }): string {
    const n = g.items.length;
    const prezzi = g.items.map((i: any) => Number(i.price) || 0);
    const minimo = prezzi.length ? Math.min(...prezzi) : 0;
    const testoPrezzo = minimo === 0 ? "da gratis" : `da € ${minimo.toFixed(2)}`;
    return `${n} ${n === 1 ? "descrizione" : "descrizioni"} · ${testoPrezzo}`;
  }

  // =========================================================================
  //  SCHEDA OPERA  (#/opera/<qid>)
  // =========================================================================

  operaCorrente(): any | null {
    if (this.vista !== "opera" || !this.parametro) return null;
    const p = this.parametro;
    return (
      this.availableArtworks.find(
        (a: any) => a.qid === p || a["@id"] === p,
      ) || null
    );
  }

  /** Le descrizioni disponibili per l'opera aperta, ordinate per tono. */
  itemDellOpera(): any[] {
    const art = this.operaCorrente();
    if (!art) return [];
    const items = this.itemVisibili().filter(
      (i: any) => this.artworkIdDi(i) === art["@id"],
    );
    return items.sort(
      (a: any, b: any) =>
        educationalLevels.indexOf(a.educationalLevel) -
        educationalLevels.indexOf(b.educationalLevel),
    );
  }

  /** Righe che l'utente sta espandendo nella scheda opera (niente finestre). */
  itemAperti: string[] = [];

  alternaItem(id: string) {
    const i = this.itemAperti.indexOf(id);
    if (i >= 0) this.itemAperti.splice(i, 1);
    else this.itemAperti.push(id);
  }

  // =========================================================================
  //  SCHEDA VISITA  (#/visita/<id>)
  // =========================================================================

  visitaCorrente(): any | null {
    if (this.vista !== "visita" || !this.parametro) return null;
    return (
      (this.contenuti as any[]).find((v) => v["@id"] === this.parametro) || null
    );
  }

  /** Il percorso della visita come sequenza leggibile: le tappe con il loro
   *  numero e le note logistiche al posto giusto (vedi `logisticaDopo`). */
  tappeDellaVisita(v: any): any[] {
    if (!v) return [];
    return (v.itemListElement || []).map((id: string, i: number) => ({
      id,
      numero: i + 1,
      nome: this.trovaNomeItem(id),
      opzionale: (v.optionalItems || []).includes(id),
      item: this.trovaItem(id),
    }));
  }

  /** Note logistiche ancorate DOPO una certa tappa. Il modello nuovo salva
   *  `{after, text}`; quello vecchio (solo testo) finisce in coda. */
  logisticaDopo(v: any, itemId: string): string[] {
    const note: string[] = [];
    for (const n of v.logistics || []) {
      if (n && typeof n === "object" && n.after === itemId && n.text)
        note.push(n.text);
    }
    return note;
  }

  logisticaSenzaPosizione(v: any): string[] {
    const note: string[] = [];
    for (const n of v.logistics || []) {
      if (typeof n === "string" && n.trim() !== "") note.push(n);
      else if (n && typeof n === "object" && !n.after && n.text) note.push(n.text);
    }
    return note;
  }

  // =========================================================================
  //  LIBRERIA (visitatore)  e  LAVORI (autore)
  // =========================================================================

  /** Visite possedute e utilizzabili: sono la cosa piu' azionabile che esista
   *  in tutta l'app, quindi vengono sempre per prime. */
  mieVisite(): any[] {
    const base = [...(this.contenuti as any[])].filter(
      (v) =>
        this.appartieneAlMuseo(v) &&
        this.haIlPossesso(v) &&
        this.visibileNelMercato(v) &&
        this.corrispondeRicerca(v, this.ricercaLibreria),
    );
    return base;
  }

  mieiItem(): { artwork: any; items: any[] }[] {
    const posseduti = this.itemVisibili().filter(
      (i: any) =>
        this.haIlPossesso(i) && this.corrispondeRicerca(i, this.ricercaLibreria),
    );
    return this.raggruppaPerArtwork(posseduti);
  }

  /** "I miei contenuti" (autore) = solo la sua produzione, non cio' che ha
   *  adottato: item propri (privati inclusi) + visite proprie. */
  lavoriItem(): { artwork: any; items: any[] }[] {
    if (this.filtroTipoLavori === "visite") return [];
    const items = (this.mieOpere as any[]).filter(
      (i) =>
        this.appartieneAlMuseo(i) && this.corrispondeRicerca(i, this.ricercaLavori),
    );
    return this.raggruppaPerArtwork(items);
  }

  lavoriVisite(): any[] {
    if (this.filtroTipoLavori === "item") return [];
    return (this.contenuti as any[]).filter(
      (v) =>
        v.author === this.currentUser &&
        this.appartieneAlMuseo(v) &&
        this.corrispondeRicerca(v, this.ricercaLavori),
    );
  }

  /** Quante persone hanno adottato un contenuto (dal report vendite). */
  adozioniDi(id: string): number | null {
    const riga = this.vendite.find((r: any) => r.id === id);
    return riga ? riga.adozioni : null;
  }

  // =========================================================================
  //  IMMAGINI
  // =========================================================================

  imgOpera(about: any): string {
    if (!about || typeof about !== "object") return "";
    return about.imagePath || about.imageUri || "";
  }

  // =========================================================================
  //  COLLEGAMENTI AL NAVIGATOR
  // =========================================================================

  private origineNavigator(): string {
    if (this.navigatorOrigin) return this.navigatorOrigin;
    return `${window.location.protocol}//${window.location.hostname}:5173`;
  }

  urlNavigator(v: any): string {
    if (!v) return "#";
    const uri: string = v.ofMuseum || "";
    const museumQid = uri.split("/").pop() || "";
    return (
      `${this.origineNavigator()}/` +
      `?museum=${encodeURIComponent(museumQid)}` +
      `&visit=${encodeURIComponent(v["@id"])}` +
      `&user=${encodeURIComponent(this.currentUser || "")}`
    );
  }

  salaAttesaUrl(): string {
    if (!this.guidedTrovata) return "#";
    return (
      `${this.origineNavigator()}/` +
      `?guidedSession=${encodeURIComponent(this.guidedTrovata.id)}` +
      `&role=studente&user=${encodeURIComponent(this.currentUser || "")}`
    );
  }

  avviaGuidataUrl(visit: any): string {
    return (
      `${this.origineNavigator()}/` +
      `?guidedVisit=${encodeURIComponent(visit["@id"])}` +
      `&role=docente&user=${encodeURIComponent(this.currentUser || "")}`
    );
  }

  /**
   * QR del collegamento a una visita, per passare dal PC al telefono.
   * Il marketplace e' un'app da scrivania e il navigator un'app da museo — per
   * requisito, non per caso. Il prodotto non aveva mai riconosciuto che a un
   * certo punto la persona deve cambiare dispositivo: inquadrare un QR e' il
   * gesto con cui questo succede davvero.
   */
  urlQrVisita(v: any): string {
    return `/api/qr?text=${encodeURIComponent(this.urlNavigator(v))}`;
  }

  /** "Guarda com'e' fatta una visita": apre l'app da museo senza profilo.
   *  Nessuno dovrebbe dover creare un account per capire cosa fa un prodotto —
   *  e senza utente il navigator mostra solo le visite gratuite. */
  urlEsempio(): string {
    return `${this.origineNavigator()}/?demo=1`;
  }

  /** Foglio stampabile dei QR delle opere: e' un deliverable, non un URL
   *  segreto — dall'area autore ci si arriva con un click. */
  urlQrCodes(): string {
    if (!this.museoSelezionato) return "#";
    return `/api/museums/${encodeURIComponent(this.museoSelezionato.qid)}/qrcodes`;
  }

  // =========================================================================
  //  VISITA GUIDATA (studente)
  // =========================================================================

  async entraConPasskey() {
    const key = this.passkeyInput.trim();
    if (!key || !this.currentUser)
      return this.mostraToast(
        "Scrivi la parola chiave che ti ha dato il docente.",
        "error",
      );
    try {
      const s = await ArtAPI.joinGuidedSession(
        key,
        this.currentUser,
        this.museoEntityId() || undefined,
      );
      this.guidedTrovata = {
        id: s.id,
        visitName: s.visitName || "Visita guidata",
      };
      this.annuncia(`Sei in sala d'attesa per ${this.guidedTrovata.visitName}.`);
    } catch (e) {
      this.guidedTrovata = null;
      this.mostraToast((e as Error).message, "error");
    }
  }

  // =========================================================================
  //  EDITOR — descrizione (item)
  // =========================================================================

  private resetNuovaOpera() {
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

  apriNuovoItem() {
    this.editingId = null;
    this.nuovaOpera = this.resetNuovaOpera();
    this.vaiA("nuovo");
  }

  modificaItem(item: any) {
    if (
      !item ||
      item["@type"] !== "CreativeWork" ||
      item.author !== this.currentUser
    )
      return;
    this.editingId = item["@id"];
    this.nuovaOpera = this.resetNuovaOpera();
    this.nuovaOpera.selectedArtworkUri =
      (typeof item.about === "object" ? item.about["@id"] : item.about) || "";
    this.nuovaOpera.tono = item.educationalLevel || "";
    this.nuovaOpera.durata = String(item.timeRequired || "");
    this.nuovaOpera.testo = item.text || "";
    this.nuovaOpera.price = item.price || 0;
    this.nuovaOpera.license = item.license || licenses[0];
    this.nuovaOpera.privato = item.visibility === "privato";
    this.vaiA("nuovo");
  }

  /** Nome dell'opera scelta nell'editor (per l'intestazione della scheda). */
  nomeOperaScelta(): string {
    const a = this.availableArtworks.find(
      (x: any) => x["@id"] === this.nuovaOpera.selectedArtworkUri,
    );
    return a ? a.name : "";
  }

  operaScelta(): any | null {
    return (
      this.availableArtworks.find(
        (x: any) => x["@id"] === this.nuovaOpera.selectedArtworkUri,
      ) || null
    );
  }

  tonoGiaUsato(tono: string): boolean {
    const art = this.nuovaOpera.selectedArtworkUri;
    if (!art) return false;
    return this.mieOpere.some(
      (i: any) =>
        (typeof i.about === "object" ? i.about["@id"] : i.about) === art &&
        i.educationalLevel === tono &&
        i["@id"] !== this.editingId,
    );
  }

  /** Stima della lunghezza del testo rispetto alla durata dichiarata: chiude
   *  l'anello fra il metadato e il testo scritto davvero. */
  stimaLettura(): string {
    const parole = this.nuovaOpera.testo.trim().split(/\s+/).filter(Boolean).length;
    if (parole === 0) return "";
    const secondi = Math.round((parole / 100) * 60); // ~100 parole al minuto
    const dichiarata = Number(this.nuovaOpera.durata) || 0;
    let giudizio = "";
    if (dichiarata > 0) {
      const scarto = secondi / dichiarata;
      if (scarto < 0.6) giudizio = " — più corta della durata dichiarata";
      else if (scarto > 1.6) giudizio = " — più lunga della durata dichiarata";
      else giudizio = " — in linea con la durata dichiarata";
    }
    return `${parole} parole · circa ${secondi}s di lettura${giudizio}`;
  }

  /** Cosa manca per poter pubblicare (testo, non un pulsante spento). */
  validazioneItem(): string[] {
    const mancano: string[] = [];
    if (!this.nuovaOpera.selectedArtworkUri) mancano.push("l'opera");
    if (!this.nuovaOpera.tono) mancano.push("il tono");
    if (!(Number(this.nuovaOpera.durata) > 0)) mancano.push("la durata");
    if (this.nuovaOpera.testo.trim() === "") mancano.push("il testo");
    if (Number(this.nuovaOpera.price) < 0) mancano.push("un prezzo non negativo");
    return mancano;
  }

  async salvaItem() {
    const mancano = this.validazioneItem();
    if (mancano.length > 0)
      return this.mostraToast(`Manca ancora: ${mancano.join(", ")}.`, "error");
    if (!this.editingId && this.tonoGiaUsato(this.nuovaOpera.tono))
      return this.mostraToast(
        `Hai già una descrizione "${this.nuovaOpera.tono}" per quest'opera. Modificala invece di crearne un'altra.`,
        "error",
      );

    const payload = {
      tipo: "Item",
      editId: this.editingId || undefined,
      id_oper_universale: this.nuovaOpera.selectedArtworkUri,
      autore: this.currentUser!,
      prezzo: this.nuovaOpera.privato ? 0 : this.nuovaOpera.price,
      privato: !!this.nuovaOpera.privato,
      licenza: this.nuovaOpera.license,
      descrizioni: [
        {
          tono: this.nuovaOpera.tono,
          lunghezza: this.nuovaOpera.durata,
          testo: this.nuovaOpera.testo,
        },
      ],
    };

    try {
      await ArtAPI.pubblica(payload);
      this.mostraToast(
        this.editingId ? "Descrizione aggiornata." : "Descrizione pubblicata.",
      );
      this.editingId = null;
      await this.initApp();
      this.vaiA("lavori");
    } catch (e) {
      this.mostraToast((e as Error).message, "error");
    }
  }

  // =========================================================================
  //  EDITOR — visita (banco di lavoro a tre passi)
  // =========================================================================

  apriComponi() {
    this.editingId = null;
    this.passoVisita = "percorso";
    this.pannelloEditor = "percorso";
    this.ricercaEditor = "";
    this.filtroEditor = "tutti";
    this.nuovaOpera = this.resetNuovaOpera();
    this.vaiA("componi");
  }

  modificaVisita(visit: any) {
    if (!visit || visit.author !== this.currentUser) return;
    this.editingId = visit["@id"];
    this.passoVisita = "percorso";
    this.pannelloEditor = "percorso";
    this.ricercaEditor = "";
    this.filtroEditor = "tutti";
    this.nuovaOpera = this.resetNuovaOpera();
    this.nuovaOpera.titolo = visit.name || "";
    this.nuovaOpera.price = visit.price || 0;
    this.nuovaOpera.license = visit.license || licenses[0];
    this.nuovaOpera.guidata = !!visit.accessKey;
    this.nuovaOpera.accessKey = visit.accessKey || "";
    this.nuovaOpera.quiz = (visit.quiz || []).map((q: any) => ({
      question: q.question || "",
      options: [...(q.options || ["", "", "", ""])],
      correct: Number(q.correct) || 0,
    }));
    this.nuovaOpera.tappe = this.ricostruisciTappe(visit);
    this.vaiA("componi");
  }

  /** Ricostruisce il percorso RISPETTANDO le posizioni: le note logistiche del
   *  modello nuovo ({after,text}) tornano dove l'autore le aveva messe. */
  private ricostruisciTappe(visit: any) {
    const opzionali = new Set<string>(visit.optionalItems || []);
    const tappe: {
      tipo: "item" | "logistica";
      value: string;
      opzionale?: boolean;
    }[] = [];
    for (const id of visit.itemListElement || []) {
      tappe.push({ tipo: "item", value: id, opzionale: opzionali.has(id) });
      for (const nota of this.logisticaDopo(visit, id)) {
        tappe.push({ tipo: "logistica", value: nota });
      }
    }
    for (const nota of this.logisticaSenzaPosizione(visit)) {
      tappe.push({ tipo: "logistica", value: nota });
    }
    return tappe;
  }

  visiteBaseImportabili(): any[] {
    return (this.contenuti as any[]).filter(
      (v) =>
        v["@type"] === "ItemList" &&
        this.appartieneAlMuseo(v) &&
        !v.accessKey &&
        (!v.price || Number(v.price) === 0),
    );
  }

  importaVisitaBase(visitId: string) {
    if (!visitId) return;
    const src: any = (this.contenuti as any[]).find((v) => v["@id"] === visitId);
    if (!src) return;
    this.nuovaOpera.tappe = this.ricostruisciTappe(src);
    this.editingId = null;
    if (this.currentUserType === "autore") {
      this.nuovaOpera.guidata = true;
      if (!this.nuovaOpera.titolo.trim())
        this.nuovaOpera.titolo = src.name ? `${src.name} (guidata)` : "";
      this.mostraToast(
        "Percorso importato. L'originale non è stato toccato: aggiungi parola chiave e quiz.",
      );
    } else {
      if (!this.nuovaOpera.titolo.trim())
        this.nuovaOpera.titolo = src.name ? `${src.name} (mia versione)` : "";
      this.mostraToast(
        "Percorso importato. L'originale non è stato toccato: personalizzalo e salvalo.",
      );
    }
  }

  disponibileSubito(item: any): boolean {
    return this.haIlPossesso(item) || !item.price || item.price === 0;
  }

  usabileInGuidata(item: any): boolean {
    if (!item) return false;
    return !item.price || item.price === 0 || this.haIlPossesso(item);
  }

  /** La libreria del banco di lavoro, raggruppata per opera. */
  libreriaEditor(): { artwork: any; items: any[] }[] {
    let base = this.itemVisibili();
    if (this.currentUserType === "autore") {
      // L'autore compone con i propri item (anche privati) e con i gratuiti.
      base = base.filter(
        (i: any) =>
          i.author === this.currentUser || !i.price || Number(i.price) === 0,
      );
    }
    if (this.nuovaOpera.guidata) {
      base = base.filter((op) => this.usabileInGuidata(op));
    }
    if (this.filtroEditor !== "tutti") {
      base = base.filter((i) =>
        this.filtroEditor === "disponibili"
          ? this.disponibileSubito(i)
          : !this.disponibileSubito(i),
      );
    }
    const gruppi = this.raggruppaPerArtwork(base);
    if (!this.ricercaEditor.trim()) return gruppi;
    return gruppi.filter((g) =>
      this.corrispondeRicerca(
        { about: g.artwork, "@type": "CreativeWork" },
        this.ricercaEditor,
      ),
    );
  }

  trovaItem(id: string) {
    const all = [
      ...(this.mieOpere as any[]),
      ...(this.itemsMarket as any[]),
      ...(this.contenuti as any[]),
    ];
    return all.find((i) => i["@id"] === id) || null;
  }

  trovaNomeItem(id: string) {
    const item = this.trovaItem(id);
    if (!item) return "Contenuto non disponibile";
    if (item["@type"] === "CreativeWork") {
      const art = item.about;
      return typeof art === "object" && art ? art.name : "Descrizione";
    }
    return item.name || "Senza titolo";
  }

  /** Tono e durata di un item, per la riga della timeline. */
  dettaglioItem(id: string): string {
    const item = this.trovaItem(id);
    if (!item || item["@type"] !== "CreativeWork") return "";
    return `${item.educationalLevel} · ${item.timeRequired}s`;
  }

  itemGiaInVisita(id: string) {
    return this.nuovaOpera.tappe.some(
      (t) => t.tipo === "item" && t.value === id,
    );
  }

  aggiungiTappa(tipo: "item" | "logistica", value: string = "") {
    if (tipo === "item" && this.itemGiaInVisita(value)) {
      return this.mostraToast("Questa descrizione è già nel percorso.", "error");
    }
    this.nuovaOpera.tappe.push({ tipo, value });
    if (tipo === "item") {
      this.annuncia(
        `${this.trovaNomeItem(value)} aggiunta. ${this.numeroTappe()} tappe nel percorso.`,
      );
    }
  }

  rimuoviTappa(index: number) {
    this.nuovaOpera.tappe.splice(index, 1);
  }

  spostaTappa(index: number, dir: -1 | 1) {
    const j = index + dir;
    const t = this.nuovaOpera.tappe;
    if (j < 0 || j >= t.length) return;
    [t[index], t[j]] = [t[j], t[index]];
  }

  toggleOpzionale(index: number) {
    const t = this.nuovaOpera.tappe[index];
    if (t && t.tipo === "item") t.opzionale = !t.opzionale;
  }

  numeroTappe(): number {
    return this.nuovaOpera.tappe.filter((t) => t.tipo === "item").length;
  }

  /** Numero progressivo mostrato accanto a una tappa: le note logistiche non
   *  sono tappe e non prendono numero. */
  numeroDiTappa(index: number): number | null {
    const t = this.nuovaOpera.tappe[index];
    if (!t || t.tipo !== "item") return null;
    let n = 0;
    for (let i = 0; i <= index; i++) {
      if (this.nuovaOpera.tappe[i].tipo === "item") n++;
    }
    return n;
  }

  durataStimataVisita(): number {
    let tot = 0;
    for (const t of this.nuovaOpera.tappe) {
      if (t.tipo !== "item") continue;
      const it = this.trovaItem(t.value);
      if (it) tot += Number(it.timeRequired) || 0;
    }
    return tot;
  }

  aggiungiDomandaQuiz() {
    this.nuovaOpera.quiz.push({
      question: "",
      options: ["", "", "", ""],
      correct: 0,
    });
  }

  rimuoviDomandaQuiz(index: number) {
    this.nuovaOpera.quiz.splice(index, 1);
  }

  /** Cosa manca alla visita, in italiano. Mostrato SEMPRE, non solo al
   *  momento del rifiuto: un pulsante che tace e non salva e' il peggior
   *  modo di fallire. */
  validazioneVisita(): string[] {
    const mancano: string[] = [];
    if (!this.nuovaOpera.titolo.trim()) mancano.push("il titolo");
    if (this.numeroTappe() === 0) mancano.push("almeno una tappa");
    if (this.currentUserType === "autore" && Number(this.nuovaOpera.price) < 0)
      mancano.push("un prezzo non negativo");
    const guidata = this.currentUserType === "autore" && this.nuovaOpera.guidata;
    if (guidata) {
      if (!this.nuovaOpera.accessKey.trim()) mancano.push("la parola chiave");
      const nonAmmessi = this.nuovaOpera.tappe.filter(
        (t) =>
          t.tipo === "item" && !this.usabileInGuidata(this.trovaItem(t.value)),
      );
      if (nonAmmessi.length > 0)
        mancano.push(
          `${nonAmmessi.length} contenuti a pagamento non tuoi da rimuovere`,
        );
      for (const q of this.nuovaOpera.quiz) {
        if (
          !q.question.trim() ||
          q.options.length !== 4 ||
          q.options.some((o) => !o.trim())
        ) {
          mancano.push("le domande del quiz complete");
          break;
        }
      }
    }
    return mancano;
  }

  /** Riga di stato del banco di lavoro: o cosa manca, o cosa si sta per fare. */
  statoVisita(): string {
    const mancano = this.validazioneVisita();
    if (mancano.length > 0) return `Manca ancora: ${mancano.join(", ")}.`;
    return `Pronta · ${this.numeroTappe()} tappe · ${formatDurata(this.durataStimataVisita())}`;
  }

  etichettaPubblica(): string {
    if (this.currentUserType !== "autore") return "Salva nella mia libreria";
    // Una visita guidata NON viene pubblicata in vetrina: dirlo.
    if (this.nuovaOpera.guidata) return "Attiva la visita guidata";
    return this.editingId ? "Salva le modifiche" : "Pubblica in vetrina";
  }

  async salvaVisita() {
    const mancano = this.validazioneVisita();
    if (mancano.length > 0)
      return this.mostraToast(`Manca ancora: ${mancano.join(", ")}.`, "error");

    const guidata = this.currentUserType === "autore" && this.nuovaOpera.guidata;
    let quizPayload:
      | { question: string; options: string[]; correct: number }[]
      | undefined;
    if (guidata && this.nuovaOpera.quiz.length > 0) {
      quizPayload = this.nuovaOpera.quiz.map((q) => ({
        question: q.question.trim(),
        options: q.options.map((o) => o.trim()),
        correct: Number(q.correct),
      }));
    }

    const payload = {
      tipo: "Visita",
      id: this.editingId || `tour-${Date.now()}`,
      titolo: this.nuovaOpera.titolo,
      autore: this.currentUser!,
      accessKey: guidata ? this.nuovaOpera.accessKey.trim() : undefined,
      quiz: quizPayload,
      prezzo:
        guidata || this.currentUserType !== "autore" ? 0 : this.nuovaOpera.price,
      licenza:
        this.currentUserType === "autore"
          ? this.nuovaOpera.license
          : "Tutti i diritti riservati",
      museumUri: this.museoSelezionato
        ? `http://www.wikidata.org/entity/${this.museoSelezionato.qid}`
        : undefined,
      // Il percorso conserva l'ORDINE misto: ogni nota logistica sa dopo quale
      // tappa si trova, cosi' il navigator puo' mostrarla al momento giusto.
      percorso: this.nuovaOpera.tappe
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
      this.mostraToast(
        guidata
          ? "Visita guidata attiva: comunica la parola chiave alla classe."
          : "Visita salvata.",
      );
      this.editingId = null;
      await this.initApp();
      this.vaiA(this.currentUserType === "autore" ? "lavori" : "libreria");
    } catch (e) {
      this.mostraToast((e as Error).message, "error");
    }
  }

  // =========================================================================
  //  VENDITE
  // =========================================================================

  filtroPeriodo: string = "sempre";

  async caricaVendite() {
    if (!this.currentUser) return;
    try {
      this.vendite = await ArtAPI.fetchSales(this.currentUser);
    } catch (e) {
      console.error(e);
      this.vendite = [];
    }
  }

  venditeFiltrate() {
    return this.vendite.filter((r) => this.appartieneAlMuseo(r));
  }

  totaleAdozioni() {
    return this.venditeFiltrate().reduce((s, r) => s + (r.adozioni || 0), 0);
  }

  totaleRicavo() {
    return this.venditeFiltrate().reduce((s, r) => s + (r.ricavo || 0), 0);
  }

  /** Il ricavo di un contenuto gratuito non e' "€ 0,00": non esiste. Quello
   *  che conta, per il gratuito, e' la diffusione. */
  ricavoLeggibile(r: any): string {
    if (!r.price || Number(r.price) === 0) return "—";
    return `€ ${(r.ricavo || 0).toFixed(2)}`;
  }

  prezzoLeggibile(p: number | undefined): string {
    if (!p || Number(p) === 0) return "Gratis";
    return `€ ${Number(p).toFixed(2)}`;
  }
}

export const state = new AppState();
