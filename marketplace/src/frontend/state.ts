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
  currentMuseum: string | null = null;
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
  contenuti: Contenuto[] = [];
  availableArtworks: Artwork[] = [];

  // Stato per l'editor (mappato sui nuovi tipi)
  nuovaOpera = this.resetNuovaOpera();

  tornaHome() {
    this.currentView = (this.currentUserType === 'autore') ? 'my_works' : 'dashboard';
  }

  async initAppForMuseum() {
    try {
      const params = new URLSearchParams(window.location.search);
      const museum = params.get('museum') || 'galleria-specchi';
      this.currentMuseum = museum;

      // Carica sia le opere disponibili per la creazione, sia i contenuti già esistenti
      [this.availableArtworks, this.contenuti] = await Promise.all([
        ArtAPI.fetchArtworks(museum),
        ArtAPI.fetchOpere(museum)
      ]);

      this.tornaHome();
    } catch (e) {
      console.error("Errore dettagliato inizializzazione museo:", e);
      alert("Impossibile caricare i dati per il museo. Controlla la console per i dettagli.");
    }
  }

  effettuaLogin(portalType: UserRole) {
    const u = this.utentiRegistrati.find(u =>
      u.username === this.formLogin.username && u.password === this.formLogin.password
    );

    if (u) {
      this.currentUser = u.username;
      this.currentUserType = portalType;
      this.initAppForMuseum();
      this.formLogin = { username: '', password: '' };
    } else {
      alert("Credenziali non valide!");
    }
  }

  preparaRegistrazione(tipo: UserRole) {
    this.formReg.tipo = tipo;
    this.currentView = 'register';
  }

  concludiRegistrazione() {
    const { username, password, conferma, tipo } = this.formReg;
    if (!username || !password || password !== conferma) return alert("Dati non validi o password non coincidenti");
    if (this.utentiRegistrati.some(u => u.username === username)) return alert("Username già registrato");

    this.utentiRegistrati.push({ username, password, type: tipo as UserRole });
    this.currentUser = username;
    this.currentUserType = tipo as UserRole;
    this.initAppForMuseum();
    this.formReg = { username: '', password: '', conferma: '', tipo: '' };
  }

  logout() {
    this.currentUser = null;
    this.currentUserType = null;
    this.currentView = 'welcome';
    this.collezioneUtente = [];
    this.currentMuseum = null;
    this.contenuti = [];
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
    return this.contenuti.filter(c => {
      const titolo = (c['@type'] === 'ItemList') ? (c as Visit).name : (typeof (c as Item).about === 'object' ? ((c as Item).about as Artwork).name : 'Senza Titolo');
      return titolo?.toLowerCase().includes(this.ricerca.toLowerCase());
    });
  }

  miaCollezione() { return this.contenuti.filter(c => this.haIlPossesso(c)); }
  mieiLavori() { return this.contenuti.filter(c => c.author === this.currentUser); }
  
  apriDettaglio(item: Contenuto) { 
    this.itemSelezionato = item; 
    this.modalDettaglio = true; 
  }

  private resetNuovaOpera() {
    return {
      type: 'CreativeWork' as 'CreativeWork' | 'ItemList',
      price: 0,
      selectedArtworkId: '', // ID dell'opera selezionata
      educationalLevel: 'medio' as EducationalLevel,
      timeRequired: '15s',
      text: '',
      // Tappe temporanee per l'editor delle visite
      tappe: [] as { tipo: 'item' | 'logistica', value: string }[],
      name: '', // Solo per Visit
    };
  }

  apriEditor() {
    this.currentView = 'editor';
    this.editingId = null;
    this.nuovaOpera = this.resetNuovaOpera();
    if (this.currentUserType === 'visitatore') this.nuovaOpera.type = 'ItemList';
  }
  
  // ... (metodi per tappe invariati)

  async salvaOpera() {
    const id = this.editingId || `uri:artaround:${Date.now()}`;
    let payload: Contenuto;

    if (this.nuovaOpera.type === 'CreativeWork') {
      if (!this.nuovaOpera.selectedArtworkId) {
        alert("Seleziona un'opera d'arte.");
        return;
      }
      
      const artwork = this.availableArtworks.find(a => a['@id'] === this.nuovaOpera.selectedArtworkId);
      if (!artwork) {
        alert("L'opera d'arte selezionata non è valida.");
        return;
      }

      payload = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "@id": id,
        about: artwork['@id'], // Usa l'ID dell'artwork esistente
        author: this.currentUser!,
        price: this.nuovaOpera.price,
        educationalLevel: this.nuovaOpera.educationalLevel,
        timeRequired: this.nuovaOpera.timeRequired,
        text: this.nuovaOpera.text,
        license: "https://creativecommons.org/licenses/by/4.0/"
      } as Item;

    } else { // ItemList / Visit
      payload = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "@id": id,
        name: this.nuovaOpera.name,
        author: this.currentUser!,
        price: this.nuovaOpera.price,
        itemListElement: this.nuovaOpera.tappe.filter(t => t.tipo === 'item').map(t => t.value),
        logistics: this.nuovaOpera.tappe.filter(t => t.tipo === 'logistica').map(t => t.value)
      } as Visit;
    }

    try {
      await ArtAPI.pubblica(payload);
      // Ricarica i contenuti per vedere le modifiche
      this.contenuti = await ArtAPI.fetchOpere(this.currentMuseum!);
      this.tornaHome();
    } catch (e) { 
      console.error("Errore durante il salvataggio:", e);
      alert("Errore durante il salvataggio: " + (e as Error).message); 
    }
  }
}

export const state = new AppState();
