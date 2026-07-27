import { state } from "./state.js";

/**
 * Collante fra Alpine e lo stato dell'applicazione.
 * Qui vivono anche i due componenti locali che non hanno bisogno dello stato
 * globale: il selettore del tema e il fondale della soglia.
 */

export function appData() {
  // Alpine rende reattiva l'istanza avvolgendola in un Proxy.
  return state;
}

/**
 * Selettore del tema. Era duplicato tre volte dentro l'HTML (fluttuante,
 * barra mobile, barra desktop) con le due icone ricopiate ogni volta: ora e'
 * un componente solo, e lo script non sta piu' nel <head>.
 * La chiave localStorage e' la stessa del navigator: le due app condividono
 * la preferenza, cosi' passare dall'una all'altra non cambia l'aspetto.
 */
export function themeToggle() {
  return {
    dark: document.documentElement.classList.contains("dark"),
    toggle(this: { dark: boolean }) {
      this.dark = !this.dark;
      document.documentElement.classList.toggle("dark", this.dark);
      localStorage.setItem("artaround-theme", this.dark ? "dark" : "light");
    },
    // L'etichetta descrive l'AZIONE, non lo stato: e' quello che serve sapere
    // a chi la sente leggere da uno screen reader.
    etichetta(this: { dark: boolean }) {
      return this.dark ? "Attiva il tema chiaro" : "Attiva il tema scuro";
    },
  };
}

/**
 * LA PIANTA — il fondale della soglia.
 *
 * Non e' un'illustrazione: e' la mappa SVG di un museo reale, la stessa che il
 * curatore annota e da cui il server ricava il grafo delle sale per le
 * indicazioni. Quindi il fondale e' generico per costruzione — si aggiunge un
 * museo e la porta d'ingresso cambia da sola — ed e' onesto: la figura sulla
 * porta e' la cosa che c'e' dentro.
 *
 * Se il server non risponde, `svg` resta vuoto e la soglia resta perfettamente
 * leggibile: il fondale e' un ornamento, non un requisito.
 */
export function pianta() {
  return {
    svg: "",
    async carica(this: { svg: string }) {
      try {
        const musei = await fetch("/api/museums").then((r) =>
          r.ok ? r.json() : [],
        );
        if (!Array.isArray(musei) || musei.length === 0) return;
        // Un museo a caso fra quelli disponibili: la soglia cambia di visita
        // in visita, come cambia il museo che si ha in mente.
        const scelto = musei[Math.floor(Math.random() * musei.length)];
        if (!scelto || !scelto.mapPath) return;
        const testo = await fetch(encodeURI(scelto.mapPath)).then((r) =>
          r.ok ? r.text() : "",
        );
        // Via l'eventuale prologo XML: va iniettato come frammento, non come documento.
        this.svg = testo.replace(/<\?xml[^>]*\?>/, "");
      } catch {
        // fondale assente: la pagina resta intera
      }
    },
  };
}

// Esposizione globale per Alpine
const w = window as any;
w.appData = appData;
w.themeToggle = themeToggle;
w.pianta = pianta;

document.addEventListener("alpine:init", () => {
  w.Alpine.data("appData", appData);
  w.Alpine.data("themeToggle", themeToggle);
  w.Alpine.data("pianta", pianta);
});
