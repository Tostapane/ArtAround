import {
  UserRole,
  Contenuto,
  Item,
  Visit,
  Artwork,
  Museum,
} from "../../../shared/types.js";
import { licenses } from "../../../shared/constants.js";
import { ArtAPI } from "./api.js";

/**
 * Gestore dello Stato Globale (Marketplace & Editor)
 * Utilizza nativamente lo standard Schema.org:
 * - Item = CreativeWork (@id, about: Artwork, educationalLevel, text, price)
 * - Visit = ItemList (@id, name, itemListElement: string[], logistics: string[], price)
 */
export class AppState {
  currentView: string = "login";
  currentUser: string | null = null;
  // Modalità dell'interfaccia scelta dall'utente DOPO il login (non è il ruolo
  // dell'account: lo stesso utente può passare da autore a visitatore quando
  // vuole tramite il toggle in navbar). Default: visitatore.
  currentUserType: UserRole | null = null;
  ricerca: string = "";
  ricercaCollezione: string = "";
  ricercaLavori: string = "";
  // Filtro per tipo di contenuto (Tutti / solo Item / solo Visite), nelle viste
  // "I miei Lavori" (autore) e "La mia Collezione" (visitatore).
  filtroTipoLavori: "tutti" | "item" | "visite" = "tutti";
  filtroTipoCollezione: "tutti" | "item" | "visite" = "tutti";
  // Visita guidata (studente): parola chiave digitata e sessione trovata dopo
  // l'ingresso in sala d'attesa (id sessione + nome visita per conferma).
  passkeyInput: string = "";
  guidedTrovata: { id: string; visitName: string } | null = null;
  wallet: number = 100.0;
  collezioneUtente: string[] = []; // Array di @id
  modalDettaglio: boolean = false;
  itemSelezionato: Contenuto | null = null;
  // Cronologia delle schermate mostrate nel modale dettaglio: ogni volta che
  // il contenuto del modale cambia (es. visita -> suo item) la schermata
  // precedente viene impilata qui, cosi' si puo' sempre tornare indietro
  // senza chiudere la finestra.
  storiaModale: Contenuto[] = [];
  // Modale di conferma acquisto (non usiamo alert/confirm nativi)
  modalConferma: boolean = false;
  itemDaAcquistare: Contenuto | null = null;
  // Se valorizzata, la conferma riguarda l'acquisto in blocco degli item
  // mancanti di questa visita (non un singolo contenuto).
  visitaAcquistoMancanti: any = null;
  // Se valorizzata, la conferma riguarda l'ELIMINAZIONE di questa visita.
  visitaDaEliminare: any = null;
  // Toast di notifica (successo/errore) che scompare da solo
  toast: { messaggio: string; tipo: "success" | "error" } | null = null;
  private toastTimer: any = null;
  editingId: string | null = null;

  formLogin = { username: "", password: "" };
  formReg = {
    username: "",
    password: "",
    conferma: "",
  };

  contenuti: Contenuto[] = []; // Visite (Tour) globali
  itemsMarket: Item[] = []; // Tutti gli item (contenuti) acquistabili singolarmente
  mieOpere: Item[] = []; // Item creati dall'autore loggato
  availableArtworks: Artwork[] = []; // Tutti gli artwork dal database (seed)

  // Selezione del museo (requisito: pannello di scelta multipla all'accesso).
  // Tutti i contenuti mostrati sono poi filtrati per il museo selezionato.
  musei: Museum[] = [];
  museoSelezionato: Museum | null = null;

  // Licenze selezionabili + report vendite/adozioni dell'autore
  licenze: string[] = licenses;
  vendite: any[] = [];

  // Stato per l'editor (mappato sui nuovi tipi)
  nuovaOpera = this.resetNuovaOpera();

  // Filtro della libreria item nell'editor visite: "tutti", "posseduti"
  // (posseduti + gratis) o "non_posseduti" (a pagamento non ancora acquistati).
  filtroLibreria: "tutti" | "posseduti" | "non_posseduti" = "tutti";

  // Ricerca testuale nella libreria di item dell'editor visite (gestione della
  // scala: con centinaia/migliaia di contenuti si filtra per nome).
  ricercaLibreria: string = "";

  tornaHome() {
    this.currentView =
      this.currentUserType === "autore" ? "my_works" : "dashboard";
  }

  // Passa dalla modalità visitatore a quella autore (e viceversa) sullo stesso
  // account, senza logout. Chiude editor/modali e porta alla home della
  // modalità scelta.
  cambiaModalita(tipo: UserRole) {
    if (this.currentUserType === tipo) return;
    this.currentUserType = tipo;
    this.modalDettaglio = false;
    this.itemSelezionato = null;
    this.editingId = null;
    this.nuovaOpera = this.resetNuovaOpera();
    if (this.museoSelezionato) this.tornaHome();
    else this.currentView = "select_museum";
  }

  // Etichetta leggibile della vista corrente, annunciata dagli screen reader
  // tramite la live region (il cambio vista di una SPA è altrimenti silenzioso).
  etichettaVista(): string {
    const nomi: Record<string, string> = {
      login: "Accesso",
      register: "Registrazione",
      select_museum: "Selezione del museo",
      dashboard: "Marketplace",
      my_collection: "La mia collezione",
      my_works: "I miei lavori",
      editor: "Editor",
      sales: "Vendite e adozioni",
    };
    return nomi[this.currentView] || "";
  }

  // URI-museo canonico usato nei campi `ofMuseum` di artwork/visite.
  private museoEntityId(): string | null {
    return this.museoSelezionato
      ? `http://www.wikidata.org/entity/${this.museoSelezionato.qid}`
      : null;
  }

  // True se il contenuto (visita o item con `about` popolato) appartiene al
  // museo attualmente selezionato.
  private appartieneAlMuseo(c: any): boolean {
    const museo = this.museoEntityId();
    if (!museo) return false;
    // Visita: campo ofMuseum diretto. Item: ricavato dall'artwork (about).
    const ofMuseum =
      c?.ofMuseum ??
      (typeof c?.about === "object" ? c.about?.ofMuseum : undefined);
    return ofMuseum === museo;
  }

  // Seleziona un museo dal pannello e entra nella home del ruolo.
  selezionaMuseo(m: Museum) {
    this.museoSelezionato = m;
    this.ricerca = "";
    this.tornaHome();
  }

  // Torna al pannello di selezione del museo.
  cambiaMuseo() {
    this.museoSelezionato = null;
    this.ricerca = "";
    this.currentView = "select_museum";
  }

  // Opere selezionabili nell'editor: solo quelle del museo scelto, cosi' i
  // contenuti creati sono associati senza ambiguita' all'oggetto del museo.
  opereDisponibili() {
    return this.availableArtworks.filter((a) => this.appartieneAlMuseo(a));
  }

  async initApp() {
    try {
      // 0. Carichiamo l'elenco dei musei per il pannello di selezione
      this.musei = await ArtAPI.fetchMuseums();

      // 1. Carichiamo sempre gli Artwork disponibili (quelli caricati dal seed)
      const arts = await ArtAPI.fetchArtworks();
      this.availableArtworks = arts.sort((a, b) =>
        (a.name || "").localeCompare(b.name || ""),
      );

      // 2. Carichiamo le Visite (Tour) del Marketplace
      this.contenuti = await ArtAPI.fetchVisite();

      // 2b. Carichiamo gli item (contenuti) acquistabili singolarmente
      this.itemsMarket = await ArtAPI.fetchItems();

      // 3. Carichiamo i lavori pubblicati dall'utente: essendo l'account unico,
      // può passare in modalità autore in qualsiasi momento.
      if (this.currentUser) {
        this.mieOpere = await ArtAPI.fetchMyItems(this.currentUser);
      }

      // 4. Prima di operare, l'utente deve scegliere un museo (pannello di
      // scelta multipla). Se ne resta uno solo lo pre-selezioniamo.
      if (this.museoSelezionato) {
        this.tornaHome();
      } else if (this.musei.length === 1) {
        this.selezionaMuseo(this.musei[0]);
      } else {
        this.currentView = "select_museum";
      }
    } catch (e) {
      console.error("Errore durante l'inizializzazione dei dati:", e);
      this.mostraToast(
        "Errore: Impossibile connettersi al database. Assicurati che il server sia attivo.",
        "error",
      );
    }
  }

  async effettuaLogin() {
    try {
      const u = await ArtAPI.login(
        this.formLogin.username,
        this.formLogin.password,
      );
      this.currentUser = u.username;
      // L'account è unico: si entra di default in modalità visitatore, con il
      // toggle in navbar per passare a autore quando si vuole.
      this.currentUserType = "visitatore";
      this.wallet = u.wallet;
      this.collezioneUtente = u.collezione;
      this.formLogin = { username: "", password: "" };
      await this.initApp(); // carica musei/opere/visite/lavori
    } catch (e) {
      this.mostraToast((e as Error).message, "error");
    }
  }

  // Mostra la vista di registrazione (account unico, nessun ruolo da scegliere).
  preparaRegistrazione() {
    this.formReg = { username: "", password: "", conferma: "" };
    this.currentView = "register";
  }

  async concludiRegistrazione() {
    const { username, password, conferma } = this.formReg;
    if (!username || !password || password !== conferma)
      return this.mostraToast("Dati non validi o password non coincidenti", "error");

    try {
      const u = await ArtAPI.register(username, password);
      this.currentUser = u.username;
      this.currentUserType = "visitatore";
      this.wallet = u.wallet;
      this.collezioneUtente = u.collezione;
      this.formReg = { username: "", password: "", conferma: "" };
      await this.initApp();
    } catch (e) {
      this.mostraToast((e as Error).message, "error");
    }
  }

  logout() {
    this.currentUser = null;
    this.currentUserType = null;
    this.currentView = "login";
    this.wallet = 0;
    this.collezioneUtente = [];
    this.contenuti = [];
    this.itemsMarket = [];
    this.mieOpere = [];
    this.musei = [];
    this.museoSelezionato = null;
    // Stato di navigazione/editor residuo della sessione precedente
    this.ricerca = "";
    this.ricercaCollezione = "";
    this.ricercaLibreria = "";
    this.ricercaLavori = "";
    this.filtroTipoLavori = "tutti";
    this.filtroTipoCollezione = "tutti";
    this.passkeyInput = "";
    this.guidedTrovata = null;
    this.vendite = [];
    this.editingId = null;
    this.nuovaOpera = this.resetNuovaOpera();
  }

  haIlPossesso(item: Contenuto) {
    if (!item) return false;
    return (
      item.author === this.currentUser ||
      this.collezioneUtente.includes(item["@id"])
    );
  }

  // Acquisto: i contenuti GRATIS vengono aggiunti subito alla collezione,
  // per quelli a pagamento si apre il modale di conferma.
  async compraOra(item: Contenuto) {
    if (!this.currentUser || this.haIlPossesso(item)) return;
    // Le visite guidate non si comprano: si accede con la parola chiave.
    if ((item as any).accessKey) return;
    if (!item.price || item.price === 0) {
      await this.eseguiAcquisto(item);
      return;
    }
    this.itemDaAcquistare = item;
    this.modalConferma = true;
  }

  // Esegue l'acquisto vero e proprio (persistito lato server).
  private async eseguiAcquisto(item: Contenuto) {
    if (!this.currentUser) return;
    try {
      const u = await ArtAPI.buy(this.currentUser, item["@id"], item.price || 0);
      this.wallet = u.wallet;
      this.collezioneUtente = u.collezione;
      this.mostraToast("Contenuto sbloccato!");
    } catch (e) {
      this.mostraToast((e as Error).message, "error");
    }
  }

  // Apre la conferma per comprare in blocco gli item mancanti di una visita
  apriAcquistoMancanti(visit: any) {
    if (!this.currentUser || this.itemsMancanti(visit).length === 0) return;
    this.visitaAcquistoMancanti = visit;
    this.modalConferma = true;
  }

  // Apre la conferma di eliminazione di una visita creata dall'utente
  apriEliminaVisita(visit: any) {
    if (!visit || visit.author !== this.currentUser) return;
    this.visitaDaEliminare = visit;
    this.modalConferma = true;
  }

  // Apre l'editor precompilato con i dati di una visita esistente per modificarla
  modificaVisita(visit: any) {
    if (!visit || visit.author !== this.currentUser) return;
    this.chiudiDettaglio();
    this.currentView = "editor";
    this.filtroLibreria = "tutti";
    this.ricercaLibreria = "";
    this.editingId = visit["@id"];
    this.nuovaOpera = this.resetNuovaOpera();
    this.nuovaOpera.type = "Visita";
    this.nuovaOpera.titolo = visit.name || "";
    this.nuovaOpera.price = visit.price || 0;
    this.nuovaOpera.license = visit.license || licenses[0];
    // Ricostruisce il percorso: prima gli item nell'ordine salvato, poi le
    // note logistiche (l'ordine misto originale non e' persistito nel modello).
    // Ripristina lo stato "visita guidata" quando si modifica.
    this.nuovaOpera.guidata = !!visit.accessKey;
    this.nuovaOpera.accessKey = visit.accessKey || "";
    const opzionali = new Set<string>(visit.optionalItems || []);
    this.nuovaOpera.tappe = [
      ...(visit.itemListElement || []).map((id: string) => ({
        tipo: "item" as const,
        value: id,
        opzionale: opzionali.has(id),
      })),
      ...(visit.logistics || [])
        .filter((n: string) => n && n.trim() !== "")
        .map((n: string) => ({ tipo: "logistica" as const, value: n })),
    ];
  }

  // Messaggio mostrato nel modale di conferma
  messaggioConferma(): string {
    if (this.visitaDaEliminare) {
      return `Vuoi eliminare definitivamente la visita "${this.visitaDaEliminare.name}"? L'operazione non è reversibile.`;
    }
    if (this.visitaAcquistoMancanti) {
      const mancanti = this.itemsMancanti(this.visitaAcquistoMancanti);
      const costo = this.costoMancanti(this.visitaAcquistoMancanti);
      return `Questa visita contiene ${mancanti.length} item che non possiedi. Per usarla devi acquistarli tutti: vuoi procedere per € ${costo.toFixed(2)}?`;
    }
    // Qui arrivano solo i contenuti a pagamento (i gratis si acquistano
    // direttamente senza conferma).
    const item = this.itemDaAcquistare;
    if (!item) return "";
    const prezzo = item.price || 0;
    const nome = this.nomeContenuto(item) || "questo contenuto";
    return `Sei sicuro di voler acquistare "${nome}" per € ${prezzo.toFixed(2)}?`;
  }

  annullaAcquisto() {
    this.modalConferma = false;
    this.itemDaAcquistare = null;
    this.visitaAcquistoMancanti = null;
    this.visitaDaEliminare = null;
  }

  // Toast non bloccante per notifiche post-azione (successo/errore)
  mostraToast(messaggio: string, tipo: "success" | "error" = "success") {
    this.toast = { messaggio, tipo };
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = null;
    }, 3500);
  }

  async confermaAcquisto() {
    // Caso eliminazione visita
    if (this.visitaDaEliminare) {
      const visita = this.visitaDaEliminare;
      this.modalConferma = false;
      this.visitaDaEliminare = null;
      try {
        await ArtAPI.eliminaVisita(visita["@id"]);
        this.chiudiDettaglio();
        // Rispecchia l'eliminazione nello stato locale senza ricaricare tutto
        this.contenuti = this.contenuti.filter(
          (c: any) => c["@id"] !== visita["@id"],
        );
        this.collezioneUtente = this.collezioneUtente.filter(
          (id) => id !== visita["@id"],
        );
        this.mostraToast("Visita eliminata.");
      } catch (e) {
        this.mostraToast((e as Error).message, "error");
      }
      return;
    }

    // Caso acquisto in blocco: tutti gli item mancanti di una visita
    if (this.visitaAcquistoMancanti) {
      const visita = this.visitaAcquistoMancanti;
      this.modalConferma = false;
      this.visitaAcquistoMancanti = null;
      if (!this.currentUser) return;
      try {
        for (const it of this.itemsMancanti(visita)) {
          const u = await ArtAPI.buy(this.currentUser, it["@id"], it.price || 0);
          this.wallet = u.wallet;
          this.collezioneUtente = u.collezione;
        }
        this.mostraToast("Item acquistati: ora puoi usare la visita!");
      } catch (e) {
        // Budget esaurito a meta': gli item gia' comprati restano acquisiti
        this.mostraToast((e as Error).message, "error");
      }
      return;
    }

    const item = this.itemDaAcquistare;
    this.modalConferma = false;
    this.itemDaAcquistare = null;
    if (!item || !this.currentUser || this.haIlPossesso(item)) return;
    await this.eseguiAcquisto(item);
  }

  // Nome ricercabile di un contenuto (visita: name; item: nome dell'artwork).
  // Pubblico: usato anche dai template per le aria-label contestuali.
  nomeContenuto(c: any): string {
    if (c?.["@type"] === "ItemList") return c.name || "";
    const art = c?.about;
    return (typeof art === "object" ? art?.name : "") || "";
  }

  // Normalizza una stringa per la ricerca: minuscolo, accenti rimossi, ogni
  // sequenza non alfanumerica ridotta a un singolo spazio. Così "Léonardo",
  // "leonardo" e "LEONARDO," collassano nella stessa forma.
  private normalizzaRicerca(s: string): string {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  // Tutti i campi su cui ha senso cercare un contenuto, concatenati e
  // normalizzati: nome (opera o visita), autore del contenuto (curatore),
  // difficoltà, e per gli item anche autore dell'opera e stile.
  private campiRicercabili(c: any): string {
    const parti: string[] = [this.nomeContenuto(c), c?.author || ""];
    if (c?.["@type"] === "ItemList") {
      parti.push(c?.level || ""); // difficoltà della visita
    } else {
      parti.push(c?.educationalLevel || ""); // difficoltà dell'item
      const art = c?.about;
      if (art && typeof art === "object") {
        parti.push(art?.name || "", art?.author?.name || "", art?.style?.name || "");
      }
    }
    return this.normalizzaRicerca(parti.join(" "));
  }

  // True se la query corrisponde al contenuto. La query è spezzata in token
  // (spazi): OGNI token deve comparire (semantica AND), così "gioconda infantile"
  // richiede sia il nome sia la difficoltà. Il match tollera l'assenza di spazi
  // ("davinci"/"leonardodavinci" trovano "Leonardo da Vinci") confrontando anche
  // contro l'haystack privato degli spazi.
  private corrispondeRicerca(c: any, query: string): boolean {
    const q = this.normalizzaRicerca(query);
    if (!q) return true;
    const haystack = this.campiRicercabili(c);
    const haystackCompatto = haystack.replace(/ /g, "");
    return q
      .split(" ")
      .every(
        (tok) =>
          !tok || haystack.includes(tok) || haystackCompatto.includes(tok),
      );
  }

  // Filtro basato sui nuovi nomi delle proprietà (sempre ristretto al museo scelto)
  contenutiFiltrati() {
    // Per i visitatori: mostra SIA i singoli item SIA le visite del museo,
    // entrambi acquistabili (slide 20: "contenuti ... sia gratuiti sia in vendita").
    if (this.currentUserType === "visitatore") {
      const tutto = [...this.itemsMarket, ...this.contenuti] as any[];
      return tutto.filter(
        (c) =>
          this.appartieneAlMuseo(c) &&
          this.visibileNelMercato(c) &&
          this.corrispondeRicerca(c, this.ricerca),
      );
    }
    // Per gli autori nella dashboard: mostra i propri item del museo selezionato
    return this.mieOpere.filter(
      (i) =>
        this.appartieneAlMuseo(i) && this.corrispondeRicerca(i, this.ricerca),
    );
  }

  // Filtra una lista per tipo di contenuto: "item" (CreativeWork), "visite"
  // (ItemList) o "tutti".
  private filtraPerTipo(
    lista: any[],
    filtro: "tutti" | "item" | "visite",
  ): any[] {
    if (filtro === "item")
      return lista.filter((c) => c["@type"] === "CreativeWork");
    if (filtro === "visite")
      return lista.filter((c) => c["@type"] === "ItemList");
    return lista;
  }

  miaCollezione() {
    // Collezione (VISITATORE) = item e visite POSSEDUTI (propri + acquistati) nel
    // museo selezionato, filtrati da ricerca e filtro-tipo.
    const tutto = [...this.itemsMarket, ...this.contenuti] as any[];
    const filtrati = tutto.filter(
      (c) =>
        this.appartieneAlMuseo(c) &&
        this.haIlPossesso(c) &&
        this.visibileNelMercato(c) &&
        this.corrispondeRicerca(c, this.ricercaCollezione),
    );
    return this.filtraPerTipo(filtrati, this.filtroTipoCollezione);
  }

  // Una visita GUIDATA (con parola chiave) non compare nel marketplace né si
  // acquista: vi si accede solo con la parola chiave. Resta visibile al suo
  // autore (per gestirla). Gli altri contenuti sono sempre visibili.
  private visibileNelMercato(c: any): boolean {
    if (!c?.accessKey) return true;
    return c.author === this.currentUser;
  }

  mieiLavori() {
    // "I miei Lavori" (AUTORE) = SOLO ciò che ha creato lui: i propri item
    // (mieOpere, inclusi i privati) + le proprie visite (create da lui), nel
    // museo selezionato. NB: a differenza della collezione del visitatore, qui
    // NON compaiono contenuti acquistati da altri — solo produzione propria.
    const items = this.mieOpere.filter((i) => this.appartieneAlMuseo(i));
    const visite = this.contenuti.filter(
      (v: any) => v.author === this.currentUser && this.appartieneAlMuseo(v),
    );
    const base = this.filtraPerTipo(
      [...items, ...visite],
      this.filtroTipoLavori,
    );
    return base.filter((c) => this.corrispondeRicerca(c, this.ricercaLavori));
  }

  // Sorgente immagine di un'opera: prima l'immagine scaricata sul server
  // (imagePath), poi come fallback l'URI remoto di Wikidata (imageUri).
  // Restituisce "" se l'opera non ha immagini (il template mostra un placeholder).
  imgOpera(about: any): string {
    if (!about || typeof about !== "object") return "";
    return about.imagePath || about.imageUri || "";
  }

  apriDettaglio(item: Contenuto | Item) {
    this.itemSelezionato = item as any;
    this.storiaModale = [];
    this.modalDettaglio = true;
  }

  chiudiDettaglio() {
    this.modalDettaglio = false;
    this.storiaModale = [];
  }

  // Item di una visita che l'utente NON possiede ancora (oggetti popolati).
  itemsMancanti(visit: any): any[] {
    if (!visit || visit["@type"] !== "ItemList") return [];
    return (visit.itemListElement || [])
      .map((id: string) => this.trovaItem(id))
      .filter((it: any) => it && !this.haIlPossesso(it));
  }

  // Costo totale degli item mancanti di una visita.
  costoMancanti(visit: any): number {
    return this.itemsMancanti(visit).reduce(
      (s: number, it: any) => s + (it.price || 0),
      0,
    );
  }

  // Una visita e' utilizzabile (avviabile nel navigator) solo se posseduta
  // E tutti i suoi item sono posseduti: altrimenti si potrebbero leggere
  // descrizioni non acquistate.
  visitaUtilizzabile(visit: any): boolean {
    return this.haIlPossesso(visit) && this.itemsMancanti(visit).length === 0;
  }

  // Torna alla schermata precedente del modale (es. dall'item alla visita)
  tornaIndietroModale() {
    const prev = this.storiaModale.pop();
    if (prev) this.itemSelezionato = prev;
  }

  // URL del navigator per avviare una visita posseduta: stesso host del
  // marketplace, porta 5173 (il navigator), con museo e visita nella query.
  // Il navigator carica il museo dal suo file di configurazione e la visita
  // dal database, e parte direttamente.
  urlNavigator(v: any): string {
    if (!v) return "#";
    const uri: string = v.ofMuseum || "";
    const parts = uri.split("/");
    const museumQid = parts[parts.length - 1] || "";
    const base = `${window.location.protocol}//${window.location.hostname}:5173/`;
    return (
      base +
      `?museum=${encodeURIComponent(museumQid)}` +
      `&visit=${encodeURIComponent(v["@id"])}`
    );
  }

  // --- Visita guidata: ingresso dello studente con parola chiave ---

  // Lo studente digita la parola chiave: entra nella sala d'attesa (server) e,
  // se la sessione esiste (docente l'ha avviata), memorizza id + nome visita.
  // Se il docente non ha ancora avviato, il server risponde 404 → messaggio.
  async entraConPasskey() {
    const key = this.passkeyInput.trim();
    if (!key || !this.currentUser)
      return this.mostraToast("Inserisci la parola chiave della visita.", "error");
    try {
      const s = await ArtAPI.joinGuidedSession(key, this.currentUser);
      this.guidedTrovata = { id: s.id, visitName: s.visitName || "Visita guidata" };
      this.mostraToast(`Sei in sala d'attesa per «${this.guidedTrovata.visitName}».`);
    } catch (e) {
      this.guidedTrovata = null;
      this.mostraToast((e as Error).message, "error");
    }
  }

  // Deep-link alla sala d'attesa del navigator per la sessione trovata. Il
  // navigator (Fase 2) legge questi parametri per mostrare l'attesa del via.
  salaAttesaUrl(): string {
    if (!this.guidedTrovata) return "#";
    const base = `${window.location.protocol}//${window.location.hostname}:5173/`;
    return (
      base +
      `?guidedSession=${encodeURIComponent(this.guidedTrovata.id)}` +
      `&role=studente` +
      `&user=${encodeURIComponent(this.currentUser || "")}`
    );
  }

  apriEditor() {
    this.currentView = "editor";
    this.editingId = null;
    this.filtroLibreria = "tutti";
    this.ricercaLibreria = "";
    this.nuovaOpera = this.resetNuovaOpera();
    // Se è un visitatore, di default l'editor crea una visita
    if (this.currentUserType === "visitatore") {
      this.nuovaOpera.type = "Visita";
    }
  }

  cambiaTipoEditor(nuovoTipo: "Item" | "Visita") {
    // Se l'utente è un visitatore, non può creare Item (solo Visite)
    if (this.currentUserType === "visitatore" && nuovoTipo === "Item") return;

    this.nuovaOpera.type = nuovoTipo;
    // Resettiamo i campi specifici per evitare sporcizia nei dati
    if (nuovoTipo === "Item") {
      this.nuovaOpera.tappe = [];
      this.nuovaOpera.titolo = "";
    } else {
      this.nuovaOpera.selectedArtworkUri = "";
    }
  }

  private resetNuovaOpera() {
    return {
      type: "Item" as "Item" | "Visita",
      price: 0,
      license: licenses[0],
      selectedArtworkUri: "",
      // Un item = UNA descrizione con un solo tono (niente piu' 4 item in uno)
      tono: "",
      durata: "30",
      testo: "",
      // Item privato: non pubblicato/venduto, riservato alle visite guidate.
      privato: false,
      // Visita guidata (18-27): se true, la visita è protetta da parola chiave.
      guidata: false,
      accessKey: "",
      tappe: [] as {
        tipo: "item" | "logistica";
        value: string;
        opzionale?: boolean;
      }[],
      titolo: "",
    };
  }

  // Restituisce gli item che l'utente può inserire in una visita
  // (limitati al museo selezionato)
  listaOpereSelezionabili() {
    let base: any[];
    if (this.currentUserType === "autore") {
      // Un autore può inserire i PROPRI item del museo (pubblici e privati) più
      // gli item GRATUITI presenti nel marketplace. Unione deduplicata per @id.
      const propri = this.mieOpere.filter((i) => this.appartieneAlMuseo(i));
      const gratis = this.itemsMarket.filter(
        (i) => this.appartieneAlMuseo(i) && (!i.price || i.price === 0),
      );
      const perId = new Map<string, any>();
      for (const i of [...propri, ...gratis]) perId.set(i["@id"], i);
      base = [...perId.values()];
    } else {
      // Un visitatore può inserire QUALSIASI item del museo scelto, anche non
      // posseduto: ma prima di poter USARE la visita dovrà acquistare tutti
      // gli item mancanti (vedi visitaUtilizzabile/itemsMancanti).
      base = this.itemsMarket.filter(
        (i) =>
          this.appartieneAlMuseo(i) &&
          (this.filtroLibreria === "tutti" ||
            (this.filtroLibreria === "posseduti"
              ? this.disponibileSubito(i)
              : !this.disponibileSubito(i))),
      );
    }
    // Se sto componendo una visita GUIDATA, la libreria mostra solo item
    // ammessi (gratuiti o miei): niente item a pagamento di altri autori.
    if (this.nuovaOpera.guidata) {
      base = base.filter((op) => this.usabileInGuidata(op));
    }
    // Ricerca robusta (nome opera / autore opera / curatore / difficoltà, con
    // tolleranza ad accenti e spazi), coerente con dashboard e collezione.
    return base.filter((op) => this.corrispondeRicerca(op, this.ricercaLibreria));
  }

  // True se l'item e' usabile senza spendere: posseduto oppure gratuito
  // (i gratis contano come "posseduti" nel filtro della libreria).
  disponibileSubito(item: any): boolean {
    return this.haIlPossesso(item) || !item.price || item.price === 0;
  }

  // True se l'item può stare in una visita GUIDATA: gratuito oppure posseduto
  // dall'autore (creato da lui, anche privato, o acquistato). Vieta gli item a
  // pagamento di altri autori (che verrebbero regalati tramite la parola chiave).
  usabileInGuidata(item: any): boolean {
    if (!item) return false;
    return !item.price || item.price === 0 || this.haIlPossesso(item);
  }

  // Trova l'oggetto item a partire dal suo @id (tra lavori, mercato e visite)
  trovaItem(id: string) {
    const all = [
      ...(this.mieOpere as any[]),
      ...(this.itemsMarket as any[]),
      ...(this.contenuti as any[]),
    ];
    return all.find((i) => i["@id"] === id || i._id === id) || null;
  }

  // Dal modale di una visita: apre il dettaglio di uno dei suoi item,
  // ricordando la visita nella cronologia per il pulsante "indietro".
  apriItemDaVisita(id: string) {
    const item = this.trovaItem(id);
    if (item && this.itemSelezionato) {
      this.storiaModale.push(this.itemSelezionato);
      this.itemSelezionato = item;
    }
  }

  trovaNomeItem(id: string) {
    // Cerca tra i propri lavori, gli item di mercato e le visite
    const all = [
      ...(this.mieOpere as any[]),
      ...(this.itemsMarket as any[]),
      ...(this.contenuti as any[]),
    ];
    const item = all.find((i) => i["@id"] === id || i._id === id);
    if (!item) return "Item sconosciuto";

    // Se è un item popolato, restituisce il nome dell'artwork
    if (item["@type"] === "CreativeWork" || item.tipo === "Item") {
      const art = item.about;
      return typeof art === "object" ? art.name : "Descrizione Opera";
    }
    return item.titolo || item.name || "Senza titolo";
  }

  aggiungiTappa(tipo: "item" | "logistica", value: string = "") {
    // Un item non puo' essere inserito piu' volte nella stessa visita.
    if (
      tipo === "item" &&
      this.nuovaOpera.tappe.some((t) => t.tipo === "item" && t.value === value)
    ) {
      return this.mostraToast("Questo item è già presente nella visita.", "error");
    }
    this.nuovaOpera.tappe.push({ tipo, value });
  }

  // True se l'autore ha gia' pubblicato una descrizione con questo tono
  // per l'opera selezionata nell'editor.
  tonoGiaUsato(tono: string): boolean {
    const art = this.nuovaOpera.selectedArtworkUri;
    if (!art) return false;
    const cap = tono.charAt(0).toUpperCase() + tono.slice(1);
    return this.mieOpere.some(
      (i: any) =>
        (typeof i.about === "object" ? i.about?.["@id"] : i.about) === art &&
        i.educationalLevel === cap,
    );
  }

  // True se l'item e' gia' stato inserito nella visita in costruzione.
  itemGiaInVisita(id: string) {
    return this.nuovaOpera.tappe.some(
      (t) => t.tipo === "item" && t.value === id,
    );
  }

  rimuoviTappa(index: number) {
    this.nuovaOpera.tappe.splice(index, 1);
  }

  // Riorganizzazione del percorso: sposta una tappa in su (-1) o in giù (+1).
  spostaTappa(index: number, dir: -1 | 1) {
    const j = index + dir;
    const t = this.nuovaOpera.tappe;
    if (j < 0 || j >= t.length) return;
    [t[index], t[j]] = [t[j], t[index]];
  }

  // Marca/smarca una tappa-item come "opzionale" (solo per gli item).
  toggleOpzionale(index: number) {
    const t = this.nuovaOpera.tappe[index];
    if (t && t.tipo === "item") t.opzionale = !t.opzionale;
  }

  async salvaOpera() {
    let payload: any;

    if (this.nuovaOpera.type === "Item") {
      if (!this.nuovaOpera.selectedArtworkUri)
        return this.mostraToast("Seleziona un'opera d'arte.", "error");

      // Il prezzo non può essere negativo
      if (Number(this.nuovaOpera.price) < 0)
        return this.mostraToast("Il prezzo non può essere negativo.", "error");

      if (!this.nuovaOpera.tono)
        return this.mostraToast("Seleziona un tono per la descrizione.", "error");

      if (Number(this.nuovaOpera.durata) < 0)
        return this.mostraToast("La durata della descrizione non può essere negativa.", "error");

      if (this.nuovaOpera.testo.trim() === "")
        return this.mostraToast("Scrivi il testo della descrizione.", "error");

      // Un solo item per coppia opera+tono (il server lo verifica comunque)
      if (this.tonoGiaUsato(this.nuovaOpera.tono))
        return this.mostraToast(
          "Hai già pubblicato una descrizione con questo tono per quest'opera.",
          "error",
        );

      payload = {
        tipo: "Item",
        id_oper_universale: this.nuovaOpera.selectedArtworkUri,
        autore: this.currentUser!,
        // Un item privato non ha prezzo (non è in vendita): forzato a 0.
        prezzo: this.nuovaOpera.privato ? 0 : this.nuovaOpera.price,
        privato: !!this.nuovaOpera.privato,
        licenza: this.nuovaOpera.license,
        // Un item = una sola descrizione
        descrizioni: [
          {
            tono:
              this.nuovaOpera.tono.charAt(0).toUpperCase() +
              this.nuovaOpera.tono.slice(1),
            lunghezza: this.nuovaOpera.durata,
            testo: this.nuovaOpera.testo,
          },
        ],
      };
    } else {
      // Visita (Tour)
      if (!this.nuovaOpera.titolo)
        return this.mostraToast("Inserisci un titolo per la visita.", "error");

      if (this.currentUserType === "autore" && Number(this.nuovaOpera.price) < 0)
        return this.mostraToast("Il prezzo non può essere negativo.", "error");

      // Una visita e' una sequenza di item: senza almeno un item non ha senso
      if (!this.nuovaOpera.tappe.some((t) => t.tipo === "item"))
        return this.mostraToast(
          "Aggiungi almeno un item al percorso della visita.",
          "error",
        );

      // Visita GUIDATA (solo autore): richiede la parola chiave e ammette solo
      // item gratuiti o posseduti dall'autore (il server rivalida comunque).
      const guidata = this.currentUserType === "autore" && this.nuovaOpera.guidata;
      if (guidata) {
        if (this.nuovaOpera.accessKey.trim() === "")
          return this.mostraToast(
            "Inserisci la parola chiave della visita guidata.",
            "error",
          );
        const nonAmmessi = this.nuovaOpera.tappe.filter(
          (t) => t.tipo === "item" && !this.usabileInGuidata(this.trovaItem(t.value)),
        );
        if (nonAmmessi.length > 0)
          return this.mostraToast(
            "Una visita guidata può contenere solo item gratuiti o tuoi. Rimuovi gli item a pagamento non tuoi.",
            "error",
          );
      }

      payload = {
        tipo: "Visita",
        // In modifica riusa l'id esistente (upsert), altrimenti ne crea uno nuovo
        id: this.editingId || `tour-${Date.now()}`,
        titolo: this.nuovaOpera.titolo,
        autore: this.currentUser!,
        // Visita guidata: gratuita (parola chiave). Altrimenti prezzo autore
        // (i visitatori non mettono prezzi → 0).
        accessKey: guidata ? this.nuovaOpera.accessKey.trim() : undefined,
        prezzo:
          guidata || this.currentUserType !== "autore"
            ? 0
            : this.nuovaOpera.price,
        // solo gli autori pubblicano con licenza; le visite dei visitatori
        // restano private (prezzo 0) ma manteniamo comunque una licenza di default
        licenza:
          this.currentUserType === "autore"
            ? this.nuovaOpera.license
            : "Tutti i diritti riservati",
        // la visita appartiene al museo selezionato (necessario per i filtri)
        museumUri: this.museoSelezionato
          ? `http://www.wikidata.org/entity/${this.museoSelezionato.qid}`
          : undefined,
        // Le note logistiche lasciate vuote non vengono salvate
        percorso: this.nuovaOpera.tappe
          .filter((t) => t.tipo === "item" || t.value.trim() !== "")
          .map((t) => ({
            tipo: t.tipo,
            id_item: t.tipo === "item" ? t.value : undefined,
            opzionale: t.tipo === "item" ? !!t.opzionale : undefined,
            indicazione: t.tipo === "logistica" ? t.value : undefined,
          })),
      };
    }

    try {
      await ArtAPI.pubblica(payload);
      this.mostraToast("Pubblicazione avvenuta con successo!");
      await this.initApp();
    } catch (e) {
      this.mostraToast("Errore: " + (e as Error).message, "error");
    }
  }

  // --- Gestione adozioni / vendite (autore) ---

  // Apre la vista vendite e carica il report dal server.
  async apriVendite() {
    this.currentView = "sales";
    await this.caricaVendite();
  }

  async caricaVendite() {
    if (!this.currentUser) return;
    try {
      this.vendite = await ArtAPI.fetchSales(this.currentUser);
    } catch (e) {
      console.error(e);
      this.vendite = [];
    }
  }

  // Righe vendite ristrette al museo selezionato.
  venditeFiltrate() {
    return this.vendite.filter((r) => this.appartieneAlMuseo(r));
  }

  // Totali del museo selezionato (adozioni e ricavo complessivo).
  totaleAdozioni() {
    return this.venditeFiltrate().reduce((s, r) => s + (r.adozioni || 0), 0);
  }
  totaleRicavo() {
    return this.venditeFiltrate().reduce((s, r) => s + (r.ricavo || 0), 0);
  }
}

export const state = new AppState();
