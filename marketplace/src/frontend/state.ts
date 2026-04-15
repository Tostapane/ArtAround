import { UserRole, Contenuto, Item, Visit, Artwork, EducationalLevel } from '../../../shared/types.js';
import { ArtAPI } from './api.js';

/**
 * Gestore dello Stato Globale (Marketplace & Editor)
 * Utilizza nativamente lo standard Schema.org:
 * - Item = CreativeWork (@id, about: Artwork, educationalLevel, text, price)
 * - Visit = ItemList (@id, name, itemListElement: string[], logistics: string[], price)
 */
export class AppState {
  currentView: string = 'welcome';
  currentUser: string | null = null;
  currentUserType: UserRole | null = null;
  ricerca: string = '';
  wallet: number = 100.00;
  collezioneUtente: string[] = []; // Array di @id
  modalDettaglio: boolean = false;
  itemSelezionato: Contenuto | null = null;
  editingId: string | null = null;

  formLogin = { username: '', password: '' };
  formReg = { username: '', password: '', conferma: '', tipo: '' as UserRole | '' };

  utentiRegistrati = [
    { username: 'autore1', password: '12345678', type: 'autore' as UserRole },
    { username: 'visitatore1', password: '12345678', type: 'visitatore' as UserRole }
  ];
  contenuti: Contenuto[] = []; // Visite (Tour) globali
  mieOpere: Item[] = [];      // Item creati dall'autore loggato
  availableArtworks: Artwork[] = []; // Tutti gli artwork dal database (seed)

  // Stato per l'editor (mappato sui nuovi tipi)
  nuovaOpera = this.resetNuovaOpera();

  tornaHome() {
    this.currentView = (this.currentUserType === 'autore') ? 'my_works' : 'dashboard';
  }

  async initApp() {
    try {
      console.log("[FRONTEND] Inizializzazione dati globali dal database...");

      // 1. Carichiamo sempre gli Artwork disponibili (quelli caricati dal seed)
      const arts = await ArtAPI.fetchArtworks();
      this.availableArtworks = arts.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      // 2. Carichiamo le Visite (Tour) del Marketplace
      this.contenuti = await ArtAPI.fetchVisite();

      // 3. Se l'utente è un autore, carichiamo i suoi lavori personali
      if (this.currentUserType === 'autore' && this.currentUser) {
        this.mieOpere = await ArtAPI.fetchMyItems(this.currentUser);
      }

      this.tornaHome();
    } catch (e) {
      console.error("Errore durante l'inizializzazione dei dati:", e);
      alert("Errore: Impossibile connettersi al database. Assicurati che il server sia attivo.");
    }
  }

  effettuaLogin(portalType: UserRole) {
    const u = this.utentiRegistrati.find(u =>
      u.username === this.formLogin.username && u.password === this.formLogin.password
    );

    if (u) {
      this.currentUser = u.username;
      this.currentUserType = portalType;
      this.initApp(); // Chiamata al nuovo init
      this.formLogin = { username: '', password: '' };
    } else {
      alert("Credenziali non valide!");
    }
  }

  concludiRegistrazione() {
    const { username, password, conferma, tipo } = this.formReg;
    if (!username || !password || password !== conferma) return alert("Dati non validi o password non coincidenti");
    if (this.utentiRegistrati.some(u => u.username === username)) return alert("Username già registrato");

    this.utentiRegistrati.push({ username, password, type: tipo as UserRole });
    this.currentUser = username;
    this.currentUserType = tipo as UserRole;
    this.initApp(); // Chiamata al nuovo init
    this.formReg = { username: '', password: '', conferma: '', tipo: '' };
  }

  logout() {
    this.currentUser = null;
    this.currentUserType = null;
    this.currentView = 'welcome';
    this.collezioneUtente = [];
    this.contenuti = [];
    this.mieOpere = [];
  }

  haIlPossesso(item: Contenuto) {
    if (!item) return false;
    return (item.author === this.currentUser) || this.collezioneUtente.includes(item['@id']);
  }

  compraOra(item: Contenuto) {
    if (this.haIlPossesso(item)) return;
    const prezzo = item.price || 0;
    if (this.wallet >= prezzo) {
      this.wallet -= prezzo;
      this.collezioneUtente.push(item['@id']);
      alert("Contenuto sbloccato!");
    } else {
      alert("Budget insufficiente!");
    }
  }

  // Filtro basato sui nuovi nomi delle proprietà
  contenutiFiltrati() {
    // Per i visitatori: mostra le visite (tour)
    if (this.currentUserType === 'visitatore') {
      return this.contenuti.filter(c => 
        (c as Visit).name?.toLowerCase().includes(this.ricerca.toLowerCase())
      );
    }
    // Per gli autori nella dashboard: mostra i propri item
    return this.mieOpere.filter(i => {
      const artwork = i.about as Artwork;
      return artwork.name?.toLowerCase().includes(this.ricerca.toLowerCase());
    });
  }

  miaCollezione() { return this.contenuti.filter(c => this.haIlPossesso(c)); }
  mieiLavori() { return this.mieOpere; }
  
  apriDettaglio(item: Contenuto | Item) { 
    this.itemSelezionato = item as any; 
    this.modalDettaglio = true; 
  }

  apriEditor() {
    this.currentView = 'editor';
    this.editingId = null;
    this.nuovaOpera = this.resetNuovaOpera();
    // Se è un visitatore, di default l'editor crea una visita
    if (this.currentUserType === 'visitatore') {
      this.nuovaOpera.type = 'Visita';
    }
  }

  cambiaTipoEditor(nuovoTipo: 'Item' | 'Visita') {
    // Se l'utente è un visitatore, non può creare Item (solo Visite)
    if (this.currentUserType === 'visitatore' && nuovoTipo === 'Item') return;
    
    this.nuovaOpera.type = nuovoTipo;
    // Resettiamo i campi specifici per evitare sporcizia nei dati
    if (nuovoTipo === 'Item') {
      this.nuovaOpera.tappe = [];
      this.nuovaOpera.titolo = '';
    } else {
      this.nuovaOpera.selectedArtworkUri = '';
    }
  }

  private resetNuovaOpera() {
    return {
      type: 'Item' as 'Item' | 'Visita',
      price: 0,
      selectedArtworkUri: '', 
      // Struttura per i 4 toni richiesti
      descrizioni: {
        infantile: { testo: '', durata: '10' },
        semplice: { testo: '', durata: '30' },
        medio: { testo: '', durata: '60' },
        avanzato: { testo: '', durata: '120' }
      },
      tappe: [] as { tipo: 'item' | 'logistica', value: string }[],
      titolo: '',
    };
  }

  // Restituisce gli item che l'utente può inserire in una visita
  listaOpereSelezionabili() {
    if (this.currentUserType === 'autore') {
      // Un autore può inserire solo i propri item
      return this.mieOpere;
    } else {
      // Un visitatore può inserire gli item che ha comprato
      return this.contenuti.filter(c => {
        const item = c as any;
        return item['@type'] === 'CreativeWork' && this.collezioneUtente.includes(item['@id']);
      });
    }
  }

  trovaNomeItem(id: string) {
    // Cerca sia tra i propri lavori che nel catalogo globale
    const all = [...(this.mieOpere as any[]), ...(this.contenuti as any[])];
    const item = all.find(i => i['@id'] === id || i._id === id);
    if (!item) return "Item sconosciuto";
    
    // Se è un item popolato, restituisce il nome dell'artwork
    if (item['@type'] === 'CreativeWork' || item.tipo === 'Item') {
      const art = item.about;
      return typeof art === 'object' ? art.name : "Descrizione Opera";
    }
    return item.titolo || item.name || "Senza titolo";
  }

  aggiungiTappa(tipo: 'item' | 'logistica', value: string = '') {
    this.nuovaOpera.tappe.push({ tipo, value });
  }

  rimuoviTappa(index: number) {
    this.nuovaOpera.tappe.splice(index, 1);
  }

  async salvaOpera() {
    let payload: any;

    if (this.nuovaOpera.type === 'Item') {
      if (!this.nuovaOpera.selectedArtworkUri) return alert("Seleziona un'opera d'arte.");
      
      // Filtriamo solo le descrizioni che sono state effettivamente scritte
      const descrizioniValide = Object.entries(this.nuovaOpera.descrizioni)
        .filter(([_, data]) => data.testo.trim() !== '')
        .map(([tono, data]) => ({
          tono: tono.charAt(0).toUpperCase() + tono.slice(1), // Capitalizza
          lunghezza: data.durata,
          testo: data.testo
        }));

      if (descrizioniValide.length === 0) return alert("Inserisci almeno una descrizione.");

      payload = {
        tipo: "Item",
        id_oper_universale: this.nuovaOpera.selectedArtworkUri,
        autore: this.currentUser!,
        prezzo: this.nuovaOpera.price,
        descrizioni: descrizioniValide
      };

    } else { // Visita (Tour)
      if (!this.nuovaOpera.titolo) return alert("Inserisci un titolo per la visita.");
      
      payload = {
        tipo: "Visita",
        id: `tour-${Date.now()}`,
        titolo: this.nuovaOpera.titolo,
        autore: this.currentUser!,
        // I visitatori non possono mettere prezzi (prezzo 0)
        prezzo: this.currentUserType === 'autore' ? this.nuovaOpera.price : 0,
        percorso: this.nuovaOpera.tappe.map(t => ({
          tipo: t.tipo,
          id_item: t.tipo === 'item' ? t.value : undefined,
          indicazione: t.tipo === 'logistica' ? t.value : undefined
        }))
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
}

export const state = new AppState();
