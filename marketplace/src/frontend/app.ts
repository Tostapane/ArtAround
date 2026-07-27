/**
 * Collegamento fra Alpine e lo stato.
 *
 * Qui vivono anche i due componenti locali che non hanno bisogno dello stato
 * globale: il selettore del tema e il fondale animato della soglia.
 */

import { state } from "./state.js";

// ============================================================================
//                                  Stato
// ============================================================================

export function appData() {
  return state;
}

// ============================================================================
//                             Selettore del tema
// ============================================================================

/**
 * Era duplicato tre volte dentro l'HTML, con le due icone ricopiate ogni volta.
 * La chiave di memoria e' la stessa del navigator: passando da un'app all'altra
 * l'aspetto non cambia. L'etichetta descrive l'AZIONE, non lo stato: e' quello
 * che serve sapere a chi la sente leggere.
 */
export function themeToggle() {
  return {
    dark: document.documentElement.classList.contains("dark"),
    toggle(this: { dark: boolean }) {
      this.dark = !this.dark;
      document.documentElement.classList.toggle("dark", this.dark);
      localStorage.setItem("artaround-theme", this.dark ? "dark" : "light");
    },
    label(this: { dark: boolean }) {
      return this.dark ? "Attiva il tema chiaro" : "Attiva il tema scuro";
    },
  };
}

// ============================================================================
//                          Fondale della soglia
// ============================================================================

/**
 * AUTOMA CELLULARE CICLICO — il fondale in movimento della porta d'ingresso.
 *
 * Ogni cella ha uno stato fra 0 e N-1 e passa al successivo appena una delle
 * vicine si trova gia' un passo avanti. Partendo da rumore casuale la regola si
 * auto-organizza in onde che si rincorrono e non si fermano mai: un moto
 * continuo, senza un inizio o una fine da guardare.
 *
 * Perche' questo e non un video o un'immagine: sono poche righe, non pesa nulla,
 * non chiede la rete e non si ripete mai due volte uguale.
 *
 * Due scelte tecniche che tengono in piedi il risultato:
 *
 * 1. IL MOTO E' CONTINUO, NON A SCATTI. L'automa avanza a passi discreti, ma il
 *    disegno interpola fra il passo precedente e quello nuovo a ogni fotogramma:
 *    i punti si accendono e si spengono con gradualita' invece di saltare. Si
 *    interpola l'INTENSITA', non lo stato, cosi' il salto da N-1 a 0 non produce
 *    uno strappo.
 * 2. SI DISEGNA SUI PIXEL, NON CON I TRACCIATI. Con punti cosi' piccoli le celle
 *    sono decine di migliaia, e altrettante chiamate di tracciato per fotogramma
 *    non reggerebbero: si scrive direttamente in un buffer di pixel e lo si
 *    riversa sul canvas in un colpo solo. Il buffer lavora in pixel del
 *    dispositivo, percio' qui non si usano trasformazioni.
 *
 * Regole di garbo:
 * - i punti restano molto tenui: a dominare dev'essere il titolo;
 * - a "riduci animazioni" l'automa compie qualche decina di passi e si ferma su
 *   un fotogramma fisso, invece di lasciare uno sfondo vuoto;
 * - il moto si sospende quando la sezione non si vede o la scheda passa in
 *   secondo piano;
 * - le tinte si leggono dai token, cosi' il fondale segue il tema.
 */
export function automaton() {
  return {
    ctx: null as CanvasRenderingContext2D | null,
    canvas: null as HTMLCanvasElement | null,
    buffer: null as ImageData | null,
    cells: new Uint8Array(0),
    prev: new Uint8Array(0),
    next: new Uint8Array(0),
    cols: 0,
    rows: 0,
    cell: 10,
    frame: 0,
    stepAt: 0,
    resizeTimer: 0,
    still: false,
    /** Tinte in forma di componenti RGB, pronte per il buffer. */
    palette: [] as { r: number; g: number; b: number }[],

    STATES: 14,
    /** Passo della griglia in pixel CSS: punti minuti e fitti, una polvere. */
    CELL: 10,
    /** Durata di un passo dell'automa, in millisecondi. */
    PERIOD: 150,
    /** Stato al centro della fascia illuminata, e sua ampiezza. */
    PEAK: 7,
    BAND: 2.5,
    /** Raggio massimo di un punto, in frazione del passo di griglia. */
    DOT: 0.24,
    /** Opacita' massima. */
    ALPHA: 0.3,

    start(this: any, canvas: HTMLCanvasElement) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      if (!this.ctx) return;

      const styles = getComputedStyle(document.documentElement);
      const token = (name: string, fallback: string) =>
        styles.getPropertyValue(name).trim() || fallback;
      const ink = token("--on-structure", "#ffffff");
      // Sei parti d'inchiostro contro una di ciascuna tinta: il fondale resta
      // monocromo a prima vista, e il colore lo nota solo chi guarda.
      this.palette = [
        ink,
        ink,
        ink,
        ink,
        ink,
        ink,
        token("--accent", "#3c6e71"),
        token("--slate", "#40606f"),
        token("--sage", "#456347"),
        token("--brass", "#7a5722"),
      ].map((c: string) => this.toRgb(c));

      this.still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // La soglia puo' essere nascosta all'avvio (si entra da un'altra rotta):
      // in quel caso il canvas non ha ancora dimensioni. L'osservatore aspetta
      // che ne abbia, ricostruisce la griglia a ogni cambio di misura e ferma
      // il moto mentre la sezione non si vede.
      const observer = new ResizeObserver(() => {
        if (!canvas.clientWidth || !canvas.clientHeight) {
          this.stop();
          return;
        }
        clearTimeout(this.resizeTimer);
        this.resizeTimer = window.setTimeout(() => this.build(), 150);
      });
      observer.observe(canvas);

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.stop();
        else if (canvas.clientWidth) this.run();
      });
    },

    /** "#rrggbb" -> componenti. Il buffer vuole numeri, non stringhe. */
    toRgb(this: any, hex: string) {
      const clean = hex.replace("#", "").trim();
      const full =
        clean.length === 3
          ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
          : clean;
      const n = parseInt(full, 16);
      if (isNaN(n)) return { r: 255, g: 255, b: 255 };
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    },

    run(this: any) {
      this.stop();
      if (this.still) return;
      this.stepAt = performance.now();
      const loop = (now: number) => {
        if (now - this.stepAt >= this.PERIOD) {
          this.step();
          this.stepAt = now;
        }
        this.draw(Math.min(1, (now - this.stepAt) / this.PERIOD));
        this.frame = requestAnimationFrame(loop);
      };
      this.frame = requestAnimationFrame(loop);
    },

    stop(this: any) {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
    },

    build(this: any) {
      const canvas = this.canvas as HTMLCanvasElement;
      // Il fondale si disegna a un pixel per pixel CSS, non alla densita' dello
      // schermo: sono punti sfumati e quasi trasparenti, dove il raddoppio non
      // si vedrebbe ma costerebbe piu' del doppio del tempo per fotogramma.
      const ratio = 1;
      canvas.width = Math.floor((canvas.clientWidth || window.innerWidth) * ratio);
      canvas.height = Math.floor((canvas.clientHeight || window.innerHeight) * ratio);

      this.cell = Math.max(4, Math.round(this.CELL * ratio));
      this.cols = Math.ceil(canvas.width / this.cell) + 1;
      this.rows = Math.ceil(canvas.height / this.cell) + 1;

      const total = this.cols * this.rows;
      this.cells = new Uint8Array(total);
      this.prev = new Uint8Array(total);
      this.next = new Uint8Array(total);
      for (let i = 0; i < total; i++) {
        this.cells[i] = Math.floor(Math.random() * this.STATES);
      }
      this.prev.set(this.cells);
      this.buffer = this.ctx.createImageData(canvas.width, canvas.height);

      if (this.still) {
        for (let i = 0; i < 60; i++) this.step();
        this.draw(1);
        return;
      }
      this.run();
    },

    /** Un passo della regola ciclica, su una griglia che si richiude sui bordi. */
    step(this: any) {
      const { cols, rows, cells, next, prev, STATES } = this;
      prev.set(cells);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const wanted = (cells[i] + 1) % STATES;
          let advance = false;
          for (let dy = -1; dy <= 1 && !advance; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = (x + dx + cols) % cols;
              const ny = (y + dy + rows) % rows;
              if (cells[ny * cols + nx] === wanted) {
                advance = true;
                break;
              }
            }
          }
          next[i] = advance ? wanted : cells[i];
        }
      }
      cells.set(next);
    },

    /** Quanto e' acceso uno stato: solo una fascia stretta attorno a PEAK. */
    glow(this: any, state: number): number {
      const distance = Math.abs(state - this.PEAK);
      const cyclic = Math.min(distance, this.STATES - distance);
      return Math.max(0, 1 - cyclic / this.BAND);
    },

    /**
     * Tinta di una cella, decisa dalla sua POSIZIONE e non dal suo stato: cosi'
     * resta ferma mentre l'onda ci passa sopra, invece di cambiare a ogni passo.
     * Serve un rimescolamento vero: con una formula lineare le tinte si
     * dispongono a righe regolari e alcune escono molto piu' spesso delle altre.
     */
    tintOf(this: any, x: number, y: number): number {
      let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      h = h ^ (h >>> 16);
      return (h >>> 0) % this.palette.length;
    },

    /** `t` e' l'avanzamento fra il passo precedente e quello corrente (0..1). */
    draw(this: any, t: number) {
      const canvas = this.canvas as HTMLCanvasElement;
      const buffer = this.buffer as ImageData;
      if (!buffer) return;
      const data = buffer.data;
      data.fill(0);

      const width = canvas.width;
      const height = canvas.height;
      const { cols, rows, cells, prev, cell } = this;
      // Interpolazione morbida: niente scatti all'inizio e alla fine del passo.
      const eased = t * t * (3 - 2 * t);
      const maxRadius = cell * this.DOT;

      for (let y = 0; y < rows; y++) {
        const cy = y * cell + cell / 2;
        if (cy < -cell || cy > height + cell) continue;
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const before = this.glow(prev[i]);
          const after = this.glow(cells[i]);
          const intensity = before + (after - before) * eased;
          if (intensity < 0.06) continue;

          const cx = x * cell + cell / 2;
          const radius = maxRadius * intensity;
          const alpha = intensity * this.ALPHA;
          const tint = this.palette[this.tintOf(x, y)];

          const x0 = Math.max(0, Math.floor(cx - radius));
          const x1 = Math.min(width - 1, Math.ceil(cx + radius));
          const y0 = Math.max(0, Math.floor(cy - radius));
          const y1 = Math.min(height - 1, Math.ceil(cy + radius));

          for (let py = y0; py <= y1; py++) {
            const dy = py + 0.5 - cy;
            for (let px = x0; px <= x1; px++) {
              const dx = px + 0.5 - cx;
              const distance = Math.sqrt(dx * dx + dy * dy);
              // Il bordo sfuma nell'ultimo mezzo pixel: senza, punti cosi'
              // piccoli risultano seghettati.
              const coverage = Math.min(1, Math.max(0, radius - distance + 0.5));
              if (coverage <= 0) continue;
              const o = (py * width + px) * 4;
              const a = Math.round(alpha * coverage * 255);
              if (a <= data[o + 3]) continue;
              data[o] = tint.r;
              data[o + 1] = tint.g;
              data[o + 2] = tint.b;
              data[o + 3] = a;
            }
          }
        }
      }
      this.ctx.putImageData(buffer, 0, 0);
    },
  };
}

// ============================================================================
//                          Esposizione ad Alpine
// ============================================================================

const w = window as any;
w.appData = appData;
w.themeToggle = themeToggle;
w.automaton = automaton;

document.addEventListener("alpine:init", () => {
  w.Alpine.data("appData", appData);
  w.Alpine.data("themeToggle", themeToggle);
  w.Alpine.data("automaton", automaton);
});
