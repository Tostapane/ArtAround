import { UserRole, Contenuto, Descrizione, Tappa, ItemType, Opera, Visita } from '../shared/types.js';
import { ArtAPI } from './api.js';

/**
 * Gestore dello Stato Globale (Single Source of Truth)
 */
export class AppState {
  // --- STATO REATTIVO ---
  currentView: string = 'welcome';
  currentUser: string | null = null;
  currentUserType: UserRole | null = null;
  currentMuseum: string | null = null;
  ricerca: string = '';
  wallet: number = 50.00;
  collezioneUtente: string[] = [];
  modalDettaglio: boolean = false;
  itemSelezionato: Contenuto | null = null;
  editingId: string | null = null;

  // Form di input
  formLogin = { username: '', password: '' };
  formReg = { username: '', password: '', conferma: '', tipo: '' as UserRole | '' };

  // Dati Mockup
  museums = ['Pinacoteca Nazionale', 'MAMbo - Bologna', 'Museo Civico Archeologico'];
  utentiRegistrati = [
    { username: 'autore1', password: '12345678', type: 'autore' as UserRole },
    { username: 'visitatore1', password: '12345678', type: 'visitatore' as UserRole }
  ];
  contenuti: Contenuto[] = [];

  nuovaOpera = this.resetNuovaOpera();

  // --- NAVIGAZIONE ---
  tornaHome() {
    this.currentView = (this.currentUserType === 'autore') ? 'my_works' : 'dashboard';
  }

  async selectMuseum(m: string) {
    this.currentMuseum = m;
    try {
      this.contenuti = await ArtAPI.fetchOpere(m);
      this.tornaHome();
    } catch (e) {
      console.error("Errore caricamento opere", e);
    }
  }

  // porta l'utente alla schermata di selezione del museo
  museumSelection() {
    this.currentMuseum = null;
    this.contenuti = [];
    this.currentView = 'museum_selection';
  }


  // --- AUTH ---
  effettuaLogin(portalType: UserRole) {
    // Cerchiamo l'utente solo per credenziali, ignorando il ruolo di registrazione
    const u = this.utentiRegistrati.find(u =>
      u.username === this.formLogin.username &&
      u.password === this.formLogin.password
    );

    if (u) {
      this.currentUser = u.username;
      // Assegniamo il ruolo in base al PORTALE scelto, non a quello di registrazione
      this.currentUserType = portalType;
      this.currentView = 'museum_selection';
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
    const user = this.formReg.username.trim();
    const p1 = this.formReg.password.trim();
    const p2 = this.formReg.conferma.trim();

    if (user === "" || p1 === "" || p2 === "") return alert("Tutti i campi sono obbligatori");
    if (p1 !== p2) return alert("Le password non coincidono");

    // CORREZIONE: usiamo .find() per il controllo esistenza
    const esiste = this.utentiRegistrati.find(u => u.username === user);

    if (esiste) {
      return alert("Username già registrato. Effettua il login!");
    }

    // Salvataggio nuovo utente
    this.utentiRegistrati.push({
      username: user,
      password: p1,
      type: this.formReg.tipo as UserRole
    });

    this.currentUser = user;
    this.currentUserType = this.formReg.tipo as UserRole;
    this.currentView = 'museum_selection';

    // Reset form
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

  // --- LOGICA RESTANTE (Invariata) ---
  haIlPossesso(item: Contenuto) {
    if (!item) return false;
    return (item.autore === this.currentUser) || this.collezioneUtente.includes(item.id.toString());
  }

  compraOra(item: Contenuto) {
    if (this.haIlPossesso(item)) return;
    if (this.wallet >= item.prezzo) {
      this.wallet -= item.prezzo;
      this.collezioneUtente.push(item.id.toString());
      alert("Sbloccato con successo!");
    } else {
      alert("Budget insufficiente!");
    }
  }

  contenutiFiltrati() {
    return this.contenuti.filter(c => c.titolo.toLowerCase().includes(this.ricerca.toLowerCase()));
  }

  miaCollezione() { return this.contenuti.filter(c => this.haIlPossesso(c)); }
  mieiLavori() { return this.contenuti.filter(c => c.autore === this.currentUser); }
  apriDettaglio(item: Contenuto) { this.itemSelezionato = item; this.modalDettaglio = true; }

  private resetNuovaOpera() {
    return {
      titolo: '', prezzo: 0, tipo: 'Item' as ItemType, immagine: '',
      descrizioni: [] as Descrizione[], percorso: [] as Tappa[], id_oper_universale: ''
    };
  }

  apriEditor() {
    this.currentView = 'editor';
    this.editingId = null;
    this.nuovaOpera = this.resetNuovaOpera();
    if (this.currentUserType === 'visitatore') this.nuovaOpera.tipo = 'Visita';
  }

  aggiungiDescrizione() { this.nuovaOpera.descrizioni.push({ tono: 'medio', lunghezza: '15s', testo: '' }); }
  rimuoviDescrizione(i: number) { this.nuovaOpera.descrizioni.splice(i, 1); }
  aggiungiTappa(tipo: 'item' | 'logistica', id_item = '') {
    this.nuovaOpera.percorso.push(tipo === 'item' ? { tipo: 'item', id_item: id_item.toString() } : { tipo: 'logistica', indicazione: '' });
  }
  rimuoviTappa(i: number) { this.nuovaOpera.percorso.splice(i, 1); }

  trovaNomeItem(id: string) {
    const item = this.contenuti.find(c => c.id.toString() === id.toString());
    return item ? item.titolo : '...';
  }

  listaOpereSelezionabili() { return this.contenuti.filter(c => c.tipo === 'Item' && this.haIlPossesso(c)); }

  modificaOpera(item: Contenuto) {
    this.currentView = 'editor';
    this.editingId = item.id;
    this.nuovaOpera = {
      titolo: item.titolo, prezzo: item.prezzo, tipo: item.tipo,
      immagine: (item.tipo === 'Item') ? (item.immagine || '') : '',
      id_oper_universale: (item.tipo === 'Item') ? (item.id_oper_universale || '') : '',
      descrizioni: (item.tipo === 'Item') ? [...item.descrizioni] : [],
      percorso: (item.tipo === 'Visita') ? [...item.percorso] : []
    };
  }

  eliminaOpera(item: Contenuto) {
    if (confirm(`Eliminare ${item.titolo}?`)) {
      this.contenuti = this.contenuti.filter(c => c.id !== item.id);
    }
  }

  async salvaOpera() {
    const base = {
      id: this.editingId || Date.now().toString(),
      titolo: this.nuovaOpera.titolo,
      autore: this.currentUser!,
      museo: this.currentMuseum!,
      prezzo: this.nuovaOpera.prezzo
    };
    const finale: Contenuto = (this.nuovaOpera.tipo === 'Item')
      ? { ...base, tipo: 'Item', immagine: this.nuovaOpera.immagine, id_oper_universale: this.nuovaOpera.id_oper_universale, descrizioni: [...this.nuovaOpera.descrizioni] } as Opera
      : { ...base, tipo: 'Visita', percorso: [...this.nuovaOpera.percorso] } as Visita;
    try {
      await ArtAPI.pubblica(finale);
      if (this.editingId) {
        const idx = this.contenuti.findIndex(c => c.id === this.editingId);
        this.contenuti[idx] = finale;
      } else {
        this.contenuti.push(finale);
      }
      this.tornaHome();
    } catch (e) { alert("Errore salvataggio server!"); }
  }

  async cercaImmagineWikidata() {
    const qid = this.nuovaOpera.id_oper_universale?.trim();
    if (!qid?.startsWith('Q')) return alert("ID non valido");
    try {
      const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      const filename = data.entities[qid].claims.P18[0].mainsnak.datavalue.value;
      this.nuovaOpera.immagine = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename.replace(/ /g, '_'))}?width=800`;
      alert("Immagine trovata!");
    } catch (e) { alert("Errore Wikidata"); }
  }
}

export const state = new AppState();
