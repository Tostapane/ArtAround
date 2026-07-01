import {
  UserRole,
  Contenuto,
  Item,
  Visit,
  Artwork,
  Museum,
} from "../../../shared/types.js";
import { educationalLevels, licenses } from "../../../shared/constants.js";
import { ArtAPI } from "./api.js";

/**
 * Gestore dello Stato Globale (Marketplace & Editor)
 * Utilizza nativamente lo standard Schema.org:
 * - Item = CreativeWork (@id, about: Artwork, educationalLevel, text, price)
 * - Visit = ItemList (@id, name, itemListElement: string[], logistics: string[], price)
 */
export class AppState {
  currentView: string = "welcome";
  currentUser: string | null = null;
  currentUserType: UserRole | null = null;
  ricerca: string = "";
  wallet: number = 100.0;
  collezioneUtente: string[] = []; // Array di @id
  modalDettaglio: boolean = false;
  itemSelezionato: Contenuto | null = null;
  editingId: string | null = null;

  formLogin = { username: "", password: "" };
  formReg = {
    username: "",
    password: "",
    conferma: "",
    tipo: "" as UserRole | "",
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

  tornaHome() {
    this.currentView =
      this.currentUserType === "autore" ? "my_works" : "dashboard";
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
      console.log("[FRONTEND] Inizializzazione dati globali dal database...");

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

      // 3. Se l'utente è un autore, carichiamo i suoi lavori personali
      if (this.currentUserType === "autore" && this.currentUser) {
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
      alert(
        "Errore: Impossibile connettersi al database. Assicurati che il server sia attivo.",
      );
    }
  }

  async effettuaLogin(portalType: UserRole) {
    try {
      const u = await ArtAPI.login(
        this.formLogin.username,
        this.formLogin.password,
        portalType,
      );
      this.currentUser = u.username;
      this.currentUserType = u.role;
      this.wallet = u.wallet;
      this.collezioneUtente = u.collezione;
      this.formLogin = { username: "", password: "" };
      await this.initApp(); // carica musei/opere/visite/lavori
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async concludiRegistrazione() {
    const { username, password, conferma, tipo } = this.formReg;
    if (!username || !password || password !== conferma)
      return alert("Dati non validi o password non coincidenti");
    if (tipo !== "autore" && tipo !== "visitatore")
      return alert("Seleziona un tipo di profilo");

    try {
      const u = await ArtAPI.register(username, password, tipo);
      this.currentUser = u.username;
      this.currentUserType = u.role;
      this.wallet = u.wallet;
      this.collezioneUtente = u.collezione;
      this.formReg = { username: "", password: "", conferma: "", tipo: "" };
      await this.initApp();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  logout() {
    this.currentUser = null;
    this.currentUserType = null;
    this.currentView = "welcome";
    this.wallet = 0;
    this.collezioneUtente = [];
    this.contenuti = [];
    this.itemsMarket = [];
    this.mieOpere = [];
    this.musei = [];
    this.museoSelezionato = null;
  }

  haIlPossesso(item: Contenuto) {
    if (!item) return false;
    return (
      item.author === this.currentUser ||
      this.collezioneUtente.includes(item["@id"])
    );
  }

  async compraOra(item: Contenuto) {
    if (!this.currentUser || this.haIlPossesso(item)) return;

    // Chiede conferma prima dell'acquisto (a prezzo o gratuito).
    const prezzo = item.price || 0;
    const nome = this.nomeContenuto(item) || "questo contenuto";
    const messaggio =
      prezzo > 0
        ? `Sei sicuro di voler acquistare "${nome}" per € ${prezzo.toFixed(2)}?`
        : `Vuoi aggiungere "${nome}" alla tua collezione? È gratuito.`;
    if (!confirm(messaggio)) return;

    try {
      // L'acquisto e' persistito: il server scala il wallet e aggiorna la
      // collezione, poi rispecchiamo il nuovo stato nel client.
      const u = await ArtAPI.buy(this.currentUser, item["@id"], item.price || 0);
      this.wallet = u.wallet;
      this.collezioneUtente = u.collezione;
      alert("Contenuto sbloccato!");
    } catch (e) {
      alert((e as Error).message);
    }
  }

  // Nome ricercabile di un contenuto (visita: name; item: nome dell'artwork).
  private nomeContenuto(c: any): string {
    if (c?.["@type"] === "ItemList") return c.name || "";
    const art = c?.about;
    return (typeof art === "object" ? art?.name : "") || "";
  }

  // Filtro basato sui nuovi nomi delle proprietà (sempre ristretto al museo scelto)
  contenutiFiltrati() {
    const q = this.ricerca.toLowerCase();
    // Per i visitatori: mostra SIA i singoli item SIA le visite del museo,
    // entrambi acquistabili (slide 20: "contenuti ... sia gratuiti sia in vendita").
    if (this.currentUserType === "visitatore") {
      const tutto = [...this.itemsMarket, ...this.contenuti] as any[];
      return tutto.filter(
        (c) =>
          this.appartieneAlMuseo(c) &&
          this.nomeContenuto(c).toLowerCase().includes(q),
      );
    }
    // Per gli autori nella dashboard: mostra i propri item del museo selezionato
    return this.mieOpere.filter((i) => {
      const artwork = i.about as Artwork;
      return (
        this.appartieneAlMuseo(i) &&
        artwork.name?.toLowerCase().includes(q)
      );
    });
  }

  miaCollezione() {
    // Collezione = item e visite posseduti nel museo selezionato
    const tutto = [...this.itemsMarket, ...this.contenuti] as any[];
    return tutto.filter(
      (c) => this.appartieneAlMuseo(c) && this.haIlPossesso(c),
    );
  }
  mieiLavori() {
    return this.mieOpere;
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
    this.modalDettaglio = true;
  }

  apriEditor() {
    this.currentView = "editor";
    this.editingId = null;
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
      // Struttura per i 4 toni richiesti
      descrizioni: {
        infantile: { testo: "", durata: "10" },
        semplice: { testo: "", durata: "30" },
        medio: { testo: "", durata: "60" },
        avanzato: { testo: "", durata: "120" },
      },
      tappe: [] as { tipo: "item" | "logistica"; value: string }[],
      titolo: "",
    };
  }

  // Restituisce gli item che l'utente può inserire in una visita
  // (limitati al museo selezionato)
  listaOpereSelezionabili() {
    if (this.currentUserType === "autore") {
      // Un autore può inserire solo i propri item del museo scelto
      return this.mieOpere.filter((i) => this.appartieneAlMuseo(i));
    } else {
      // Un visitatore può inserire gli item che ha ACQUISTATO nel museo scelto
      return this.itemsMarket.filter(
        (i) =>
          this.appartieneAlMuseo(i) &&
          this.collezioneUtente.includes(i["@id"]),
      );
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
      return alert("Questo item è già presente nella visita.");
    }
    this.nuovaOpera.tappe.push({ tipo, value });
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

  async salvaOpera() {
    let payload: any;

    if (this.nuovaOpera.type === "Item") {
      if (!this.nuovaOpera.selectedArtworkUri)
        return alert("Seleziona un'opera d'arte.");

      // Il prezzo non può essere negativo
      if (Number(this.nuovaOpera.price) < 0)
        return alert("Il prezzo non può essere negativo.");

      // Le durate delle descrizioni non possono essere negative
      const durataNegativa = Object.values(this.nuovaOpera.descrizioni).some(
        (d) => Number(d.durata) < 0,
      );
      if (durataNegativa)
        return alert("La durata delle descrizioni non può essere negativa.");

      // Filtriamo solo le descrizioni che sono state effettivamente scritte
      const descrizioniValide = Object.entries(this.nuovaOpera.descrizioni)
        .filter(([_, data]) => data.testo.trim() !== "")
        .map(([tono, data]) => ({
          tono: tono.charAt(0).toUpperCase() + tono.slice(1), // Capitalizza
          lunghezza: data.durata,
          testo: data.testo,
        }));

      if (descrizioniValide.length === 0)
        return alert("Inserisci almeno una descrizione.");

      payload = {
        tipo: "Item",
        id_oper_universale: this.nuovaOpera.selectedArtworkUri,
        autore: this.currentUser!,
        prezzo: this.nuovaOpera.price,
        licenza: this.nuovaOpera.license,
        descrizioni: descrizioniValide,
      };
    } else {
      // Visita (Tour)
      if (!this.nuovaOpera.titolo)
        return alert("Inserisci un titolo per la visita.");

      if (this.currentUserType === "autore" && Number(this.nuovaOpera.price) < 0)
        return alert("Il prezzo non può essere negativo.");

      payload = {
        tipo: "Visita",
        id: `tour-${Date.now()}`,
        titolo: this.nuovaOpera.titolo,
        autore: this.currentUser!,
        // I visitatori non possono mettere prezzi (prezzo 0)
        prezzo: this.currentUserType === "autore" ? this.nuovaOpera.price : 0,
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
        percorso: this.nuovaOpera.tappe.map((t) => ({
          tipo: t.tipo,
          id_item: t.tipo === "item" ? t.value : undefined,
          indicazione: t.tipo === "logistica" ? t.value : undefined,
        })),
      };
    }

    try {
      await ArtAPI.pubblica(payload);
      alert("Pubblicazione avvenuta con successo!");
      await this.initApp();
    } catch (e) {
      alert("Errore: " + (e as Error).message);
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
