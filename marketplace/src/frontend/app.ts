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
 * LO SCIAME — il fondale della porta d'ingresso.
 *
 * Una nuvola di punti che si raduna a formare, uno dopo l'altro, i disegni del
 * prodotto: le piante dei musei e i contorni di alcune opere. Ogni figura si
 * compone a ondate, resta ferma qualche secondo con un respiro appena
 * percettibile, poi i punti scivolano nella figura successiva.
 *
 * Fra una figura e l'altra NON c'e' dispersione: i punti restano sempre
 * attratti da un bersaglio. C'era, e rimbalzava; e il riavvolgimento ai bordi
 * che l'accompagnava faceva sparire i punti da un lato per farli ricomparire
 * dall'altro. Un passaggio diretto e' piu' calmo e si legge molto meglio.
 *
 * Non e' decorazione presa altrove: le sorgenti sono le STESSE mappe annotate da
 * cui il server ricava il grafo delle sale, e le stesse immagini delle opere che
 * si vendono qui dentro. Il fondale cambia da solo quando si aggiunge un museo,
 * e la figura sulla porta e' davvero la cosa che c'e' dentro.
 *
 * Come si ricava una figura: la sorgente viene disegnata piccola fuori schermo,
 * se ne misura il CONTRASTO LOCALE e si tengono i punti dove cambia di piu'.
 * Vale sia per le mappe, che sono al tratto, sia per i dipinti, che sono
 * fotografie: in entrambi i casi restano i contorni, mai una macchia scura.
 *
 * Regole di garbo:
 * - punti piccoli e quasi trasparenti: a dominare dev'essere il titolo;
 * - a "riduci animazioni" lo sciame compone la prima figura e si ferma li';
 * - il moto si sospende quando la sezione non si vede o la scheda passa in
 *   secondo piano;
 * - i punti si spengono avvicinandosi ai bordi, cosi' la nuvola sfuma nel buio
 *   invece di finire tagliata contro il margine;
 * - se le sorgenti non arrivano, i punti restano a vagare piano: la soglia non
 *   resta mai vuota.
 */
export function swarm() {
  return {
    canvas: null as HTMLCanvasElement | null,
    ctx: null as CanvasRenderingContext2D | null,
    buffer: null as ImageData | null,

    /** Posizione, velocita' e bersaglio di ogni punto. */
    px: new Float32Array(0),
    py: new Float32Array(0),
    vx: new Float32Array(0),
    vy: new Float32Array(0),
    tx: new Float32Array(0),
    ty: new Float32Array(0),
    tint: new Uint8Array(0),
    /** Ritardo di partenza di ogni punto, in frazione della fase. */
    delay: new Float32Array(0),
    count: 0,

    /** Figure pronte: punti normalizzati fra 0 e 1, piu' le proporzioni della
     *  sorgente — senza, un dipinto verticale verrebbe schiacciato in un 4:3. */
    shapes: [] as { points: Float32Array; aspect: number }[],
    shapeIndex: -1,

    phase: "hold" as "morph" | "hold",
    phaseAt: 0,
    frame: 0,
    resizeTimer: 0,
    still: false,
    palette: [] as { r: number; g: number; b: number }[],

    /** Durate delle due fasi, in millisecondi. */
    MORPH: 3200,
    HOLD: 3600,
    /** Raggio e opacita' massimi di un punto. */
    DOT: 2.1,
    ALPHA: 0.38,
    /** Ampiezza della sfumatura ai bordi, in frazione del lato minore. */
    EDGE: 0.1,
    /** Risoluzione con cui si campiona una sorgente. */
    SAMPLE_W: 220,

    start(this: any, canvas: HTMLCanvasElement) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      if (!this.ctx) return;

      const styles = getComputedStyle(document.documentElement);
      const token = (name: string, fallback: string) =>
        styles.getPropertyValue(name).trim() || fallback;
      const ink = token("--on-structure", "#ffffff");
      // Sei parti d'inchiostro contro una di ciascuna tinta: lo sciame resta
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

      this.loadShapes();
    },

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

    // ------------------------------------------------------------------
    //  Sorgenti
    // ------------------------------------------------------------------

    /**
     * Raccoglie le figure: prima le piante dei musei, poi qualche opera. Le
     * aggiunge man mano che arrivano, cosi' la prima figura si forma senza
     * aspettare che siano pronte tutte.
     */
    async loadShapes(this: any) {
      try {
        const museums = await fetch("/api/museums").then((r) =>
          r.ok ? r.json() : [],
        );
        for (const museum of Array.isArray(museums) ? museums : []) {
          if (!museum.mapPath) continue;
          const points = await this.pointsFromSvg(museum.mapPath);
          if (points) this.shapes.push(points);
        }
      } catch {
        // nessuna pianta: si prosegue con le opere
      }
      try {
        const artworks = await fetch("/api/artworks").then((r) =>
          r.ok ? r.json() : [],
        );
        const withImage = (Array.isArray(artworks) ? artworks : []).filter(
          (a: any) => a.imagePath,
        );
        for (let i = withImage.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [withImage[i], withImage[j]] = [withImage[j], withImage[i]];
        }
        for (const artwork of withImage.slice(0, 3)) {
          const points = await this.pointsFromImage(artwork.imagePath);
          if (points) this.shapes.push(points);
        }
      } catch {
        // nessuna opera: bastano le piante
      }
    },

    /**
     * Le mappe hanno il solo viewBox e nessuna misura sulla radice: disegnate
     * cosi' come sono finirebbero larghe zero. Si iniettano le dimensioni prese
     * dal viewBox e poi si passa dalla via normale.
     */
    async pointsFromSvg(this: any, path: string): Promise<Float32Array | null> {
      try {
        const text = await fetch(encodeURI(path)).then((r) =>
          r.ok ? r.text() : "",
        );
        if (!text) return null;
        const box = text.match(/viewBox="([\d.\s-]+)"/);
        let sized = text;
        if (box && !/<svg[^>]*\swidth=/.test(text)) {
          const [, , w, h] = box[1].trim().split(/\s+/);
          sized = text.replace("<svg", `<svg width="${w}" height="${h}"`);
        }
        const url = URL.createObjectURL(
          new Blob([sized], { type: "image/svg+xml" }),
        );
        const points = await this.pointsFromImage(url);
        URL.revokeObjectURL(url);
        return points;
      } catch {
        return null;
      }
    },

    /** Disegna la sorgente in piccolo e ne estrae i contorni. */
    pointsFromImage(this: any, src: string): Promise<Float32Array | null> {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            resolve(this.contour(img));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = src;
      });
    },

    /**
     * Contorni: si misura quanto la luminosita' cambia fra un campione e i suoi
     * vicini, e si tengono i punti dove cambia di piu'. Su una pianta restituisce
     * i muri, su un dipinto il profilo delle figure — mai una macchia piena.
     */
    contour(this: any, img: HTMLImageElement) {
      const w = this.SAMPLE_W;
      const ratio = img.height && img.width ? img.height / img.width : 0.75;
      const h = Math.max(8, Math.round(w * ratio));

      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return null;
      // Fondo neutro: senza, una sorgente trasparente lascia il nero e ogni
      // bordo diventa un contorno finto.
      octx.fillStyle = "#808080";
      octx.fillRect(0, 0, w, h);
      octx.drawImage(img, 0, 0, w, h);

      const data = octx.getImageData(0, 0, w, h).data;
      const lum = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        lum[i] = (data[o] * 0.2126 + data[o + 1] * 0.7152 + data[o + 2] * 0.0722) / 255;
      }

      // Un punto per CELLA: si divide il campione in caselle e in ognuna si
      // tiene il contorno piu' netto. Scegliendo a caso, su una fotografia
      // resterebbe la grana sparsa ovunque; scegliendo per intensita' senza
      // caselle resterebbero solo i tratti piu' spessi. Cosi' invece i punti
      // seguono la struttura e restano distribuiti su tutta la figura.
      const BIN = 2;
      const binW = Math.ceil(w / BIN);
      const best = new Map<number, { x: number; y: number; strength: number }>();
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          const gx = Math.abs(lum[i - 1] - lum[i + 1]);
          const gy = Math.abs(lum[i - w] - lum[i + w]);
          const strength = gx + gy;
          if (strength < 0.12) continue;
          const key = Math.floor(y / BIN) * binW + Math.floor(x / BIN);
          const current = best.get(key);
          if (!current || current.strength < strength) {
            best.set(key, { x: x / w, y: y / h, strength });
          }
        }
      }
      const keep = [...best.values()];
      if (keep.length < 120) return null;

      const points = new Float32Array(keep.length * 2);
      for (let i = 0; i < keep.length; i++) {
        points[i * 2] = keep[i].x;
        points[i * 2 + 1] = keep[i].y;
      }
      return { points, aspect: h / w };
    },

    // ------------------------------------------------------------------
    //  Ciclo di vita
    // ------------------------------------------------------------------

    build(this: any) {
      const canvas = this.canvas as HTMLCanvasElement;
      // Un pixel per pixel CSS: sono punti sfumati e quasi trasparenti, dove la
      // densita' dello schermo non si vedrebbe ma costerebbe il doppio.
      canvas.width = Math.floor(canvas.clientWidth || window.innerWidth);
      canvas.height = Math.floor(canvas.clientHeight || window.innerHeight);
      this.buffer = this.ctx.createImageData(canvas.width, canvas.height);

      // Poco piu' di una particella per punto della figura: impilandone sei
      // sullo stesso bersaglio il disegno si impasta invece di definirsi.
      const wanted = Math.round((canvas.width * canvas.height) / 900);
      this.count = Math.max(800, Math.min(2600, wanted));

      this.px = new Float32Array(this.count);
      this.py = new Float32Array(this.count);
      this.vx = new Float32Array(this.count);
      this.vy = new Float32Array(this.count);
      this.tx = new Float32Array(this.count);
      this.ty = new Float32Array(this.count);
      this.tint = new Uint8Array(this.count);
      this.delay = new Float32Array(this.count);
      for (let i = 0; i < this.count; i++) {
        this.px[i] = Math.random() * canvas.width;
        this.py[i] = Math.random() * canvas.height;
        this.vx[i] = (Math.random() - 0.5) * 0.4;
        this.vy[i] = (Math.random() - 0.5) * 0.4;
        this.tint[i] = Math.floor(Math.random() * this.palette.length);
        this.delay[i] = Math.random() * 0.35;
      }

      this.shapeIndex = -1;
      this.phase = "hold";
      this.phaseAt = performance.now();
      this.run();
    },

    run(this: any) {
      this.stop();
      if (this.still) {
        // Una figura sola, ferma: chi ha chiesto meno movimento non riceve
        // uno sfondo vuoto, riceve un disegno.
        // Si aspetta la prima figura, ma non all'infinito: se le sorgenti non
        // arrivano si disegna comunque la nuvola sparsa invece di riprovare
        // per sempre.
        let attempts = 0;
        const settle = () => {
          if (this.shapes.length === 0) {
            if (attempts++ > 25) {
              this.draw();
              return;
            }
            window.setTimeout(settle, 200);
            return;
          }
          this.nextShape();
          for (let step = 0; step < 240; step++) this.advance(1 / 60, "morph");
          this.draw();
        };
        settle();
        return;
      }
      let last = performance.now();
      const loop = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this.tick(now, dt);
        this.draw();
        this.frame = requestAnimationFrame(loop);
      };
      this.frame = requestAnimationFrame(loop);
    },

    stop(this: any) {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
    },

    /** Sceglie la figura successiva e ne distribuisce i punti fra le particelle. */
    nextShape(this: any) {
      if (this.shapes.length === 0) return;
      this.shapeIndex = (this.shapeIndex + 1) % this.shapes.length;
      const shape = this.shapes[this.shapeIndex];
      const points = shape.points;
      const total = points.length / 2;
      const canvas = this.canvas as HTMLCanvasElement;

      // La figura entra nel riquadro senza deformarsi, con un margine.
      const margin = 0.62;
      const drawW =
        Math.min(canvas.width, canvas.height / shape.aspect) * margin;
      const drawH = drawW * shape.aspect;
      const left = (canvas.width - drawW) / 2;
      const top = (canvas.height - drawH) / 2;

      // I punti si ordinano per angolo attorno al centro, e cosi' anche le
      // particelle: ognuna riceve un bersaglio dalla propria parte. Assegnando
      // a caso, meta' sciame attraverserebbe il riquadro per andare dall'altro
      // lato, e la figura si comporrebbe in un groviglio.
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      const order: number[] = [];
      for (let i = 0; i < total; i++) order.push(i);
      order.sort((a, b) => {
        const aa = Math.atan2(top + points[a * 2 + 1] * drawH - cy, left + points[a * 2] * drawW - cx);
        const bb = Math.atan2(top + points[b * 2 + 1] * drawH - cy, left + points[b * 2] * drawW - cx);
        return aa - bb;
      });

      const mine: number[] = [];
      for (let i = 0; i < this.count; i++) mine.push(i);
      mine.sort(
        (a, b) =>
          Math.atan2(this.py[a] - cy, this.px[a] - cx) -
          Math.atan2(this.py[b] - cy, this.px[b] - cx),
      );

      for (let k = 0; k < this.count; k++) {
        const particle = mine[k];
        const point = order[Math.floor((k * total) / this.count)] * 2;
        // Le particelle in eccesso si scostano di poco, invece di impilarsi
        // esattamente sullo stesso punto.
        const jitter = this.count > total ? (Math.random() - 0.5) * 3 : 0;
        this.tx[particle] = left + points[point] * drawW + jitter;
        this.ty[particle] = top + points[point + 1] * drawH + jitter;
      }
    },

    tick(this: any, now: number, dt: number) {
      const elapsed = now - this.phaseAt;
      if (this.phase === "hold" && elapsed > this.HOLD) {
        if (this.shapes.length > 0) {
          this.nextShape();
          this.phase = "morph";
          this.phaseAt = now;
        }
      } else if (this.phase === "morph" && elapsed > this.MORPH) {
        this.phase = "hold";
        this.phaseAt = now;
      }
      const span = this.phase === "morph" ? this.MORPH : this.HOLD;
      this.advance(dt, this.phase, now / 1000, Math.min(1, elapsed / span));
    },

    /**
     * Un passo del moto.
     *
     * I punti sono SEMPRE attratti dal proprio bersaglio: si passa da una figura
     * all'altra scivolando, senza disperdersi prima. La dispersione c'era, ed e'
     * stata tolta: rimbalzava, e il riavvolgimento ai bordi faceva sparire e
     * ricomparire i punti dall'altro lato.
     *
     * Durante il passaggio ogni punto parte con un piccolo ritardo suo, cosi' la
     * figura si compone a ondate invece che tutta in una volta. A figura ferma
     * resta un respiro appena percettibile, che evita l'aria di un fermo
     * immagine senza introdurre movimento vero.
     *
     * Finche' non c'e' una figura i punti vagano piano verso il centro: e' anche
     * quel che si vede se le sorgenti non arrivano.
     */
    advance(this: any, dt: number, phase: string, time = 0, progress = 1) {
      const canvas = this.canvas as HTMLCanvasElement;
      const idle = this.shapeIndex < 0;
      const pull = phase === "morph" ? 5.2 : 2.4;
      const damping = 0.88;

      for (let i = 0; i < this.count; i++) {
        if (idle) {
          const sx = this.px[i] * 0.006;
          const sy = this.py[i] * 0.008;
          this.vx[i] += Math.sin(sy + time * 0.25) * 5 * dt;
          this.vy[i] += Math.cos(sx - time * 0.2) * 5 * dt;
          // Nessun rimbalzo: chi si allontana viene richiamato dolcemente.
          this.vx[i] += (canvas.width / 2 - this.px[i]) * 0.05 * dt;
          this.vy[i] += (canvas.height / 2 - this.py[i]) * 0.05 * dt;
        } else {
          // Il ritardo scala la forza all'inizio del passaggio, non la spegne:
          // nessuno resta indietro quando la fase finisce.
          const own = Math.max(0, (progress - this.delay[i]) / (1 - this.delay[i]));
          const eased = phase === "morph" ? own * own * (3 - 2 * own) : 1;
          this.vx[i] += (this.tx[i] - this.px[i]) * pull * eased * dt;
          this.vy[i] += (this.ty[i] - this.py[i]) * pull * eased * dt;
          if (phase === "hold") {
            const breath = time * 0.7 + i * 0.35;
            this.vx[i] += Math.cos(breath) * 1.6 * dt;
            this.vy[i] += Math.sin(breath) * 1.6 * dt;
          }
        }
        this.vx[i] *= damping;
        this.vy[i] *= damping;
        this.px[i] += this.vx[i];
        this.py[i] += this.vy[i];
      }
    },

    // ------------------------------------------------------------------
    //  Disegno
    // ------------------------------------------------------------------

    draw(this: any) {
      const canvas = this.canvas as HTMLCanvasElement;
      const buffer = this.buffer as ImageData;
      if (!buffer) return;
      const data = buffer.data;
      data.fill(0);

      const w = canvas.width;
      const h = canvas.height;
      const radius = this.DOT;
      // Fascia entro cui i punti si spengono avvicinandosi al bordo: la nuvola
      // sfuma nel buio invece di finire tagliata di netto contro il margine.
      const margin = Math.min(w, h) * this.EDGE;

      for (let i = 0; i < this.count; i++) {
        const cx = this.px[i];
        const cy = this.py[i];
        const border = Math.min(cx, cy, w - cx, h - cy);
        if (border <= 0) continue;
        const fade = Math.min(1, border / margin);
        const alpha = this.ALPHA * fade * fade;
        if (alpha < 0.012) continue;
        const x0 = Math.max(0, Math.floor(cx - radius));
        const x1 = Math.min(w - 1, Math.ceil(cx + radius));
        const y0 = Math.max(0, Math.floor(cy - radius));
        const y1 = Math.min(h - 1, Math.ceil(cy + radius));
        const tint = this.palette[this.tint[i]];

        for (let py = y0; py <= y1; py++) {
          const dy = py + 0.5 - cy;
          for (let px = x0; px <= x1; px++) {
            const dx = px + 0.5 - cx;
            const distance = Math.sqrt(dx * dx + dy * dy);
            // Il bordo sfuma nell'ultimo mezzo pixel: senza, punti cosi'
            // piccoli risultano seghettati.
            const coverage = Math.min(1, Math.max(0, radius - distance + 0.5));
            if (coverage <= 0) continue;
            const o = (py * w + px) * 4;
            const a = Math.round(alpha * coverage * 255);
            if (a <= data[o + 3]) continue;
            data[o] = tint.r;
            data[o + 1] = tint.g;
            data[o + 2] = tint.b;
            data[o + 3] = a;
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
w.swarm = swarm;

document.addEventListener("alpine:init", () => {
  w.Alpine.data("appData", appData);
  w.Alpine.data("themeToggle", themeToggle);
  w.Alpine.data("swarm", swarm);
});
