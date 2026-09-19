/**
 * Collega Alpine allo stato del marketplace e registra i componenti locali. I
 * binding restano sottili perche' Alpine li valuta come stringhe a runtime.
 */
import { state } from "./state.js";
import { percorsoMiniatura, THEME_KEY } from "../../../shared/constants.js";

// ============================================================================

export function appData() {
  return state;
}

// ============================================================================

export function themeToggle() {
  return {
    dark: document.documentElement.classList.contains("dark"),
    toggle(this: { dark: boolean }) {
      this.dark = !this.dark;
      document.documentElement.classList.toggle("dark", this.dark);
      localStorage.setItem(THEME_KEY, this.dark ? "dark" : "light");
    },
    label(this: { dark: boolean }) {
      return this.dark ? "Attiva il tema chiaro" : "Attiva il tema scuro";
    },
  };
}

// ============================================================================

type Shape = { points: Float32Array; aspect: number };

export function swarm() {
  return {
    canvas: null as HTMLCanvasElement | null,
    ctx: null as CanvasRenderingContext2D | null,
    buffer: null as ImageData | null,

    px: new Float32Array(0),
    py: new Float32Array(0),
    vx: new Float32Array(0),
    vy: new Float32Array(0),
    tx: new Float32Array(0),
    ty: new Float32Array(0),

    sx: new Float32Array(0),
    sy: new Float32Array(0),

    bow: new Float32Array(0),

    delay: new Float32Array(0),
    count: 0,

    dot: 1.6,

    shapes: [] as Shape[],
    shapeIndex: -1,

    phase: "hold" as "morph" | "hold",
    phaseAt: 0,
    frame: 0,
    resizeTimer: 0,
    still: false,
    ink: { r: 255, g: 255, b: 255 },

    MORPH: 1800,
    HOLD: 900,

    BOW: 0.16,

    DOT: 1.6,
    DOT_MIN: 0.75,
    ALPHA: 1,

    EDGE: 0.06,

    MARGIN: 0.84,

    SAMPLE_W: 240,

    TONES: 9000,

    start(this: any, canvas: HTMLCanvasElement) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      if (!this.ctx) return;

      const styles = getComputedStyle(document.documentElement);
      const token = (name: string, fallback: string) =>
        styles.getPropertyValue(name).trim() || fallback;

      this.ink = this.toRgb(token("--lastra", "#ffffff"));

      this.still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const observer = new ResizeObserver(() => {
        if (!canvas.clientWidth || !canvas.clientHeight) {
          this.stop();
          return;
        }

        if (this.count === 0) {
          this.build();
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

    async loadShapes(this: any) {
      try {

        const config = await fetch("/api/config")
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({}) as any);
        const figures = (
          Array.isArray(config.thresholdArtworks) ? config.thresholdArtworks : []
        ).filter((a: any) => a && a.imagePath);

        for (const artwork of figures) {

          const shape = await this.shapeFromImage(
            percorsoMiniatura(artwork.imagePath),
          );
          if (!shape) continue;
          this.shapes.push(shape);

          if (this.shapeIndex < 0) this.compose();
        }
      } catch {}
    },

    shapeFromImage(this: any, src: string): Promise<Shape | null> {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            resolve(this.halftone(img));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = src;
      });
    },

    sample(this: any, img: HTMLImageElement) {
      const w = this.SAMPLE_W;
      const ratio = img.height && img.width ? img.height / img.width : 0.75;
      const h = Math.max(8, Math.round(w * ratio));

      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return null;

      octx.fillStyle = "#808080";
      octx.fillRect(0, 0, w, h);
      octx.drawImage(img, 0, 0, w, h);

      const data = octx.getImageData(0, 0, w, h).data;
      const lum = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        lum[i] =
          (data[o] * 0.2126 + data[o + 1] * 0.7152 + data[o + 2] * 0.0722) / 255;
      }
      return { w, h, lum };
    },

    halftone(this: any, img: HTMLImageElement): Shape | null {
      const grid = this.sample(img);
      if (!grid) return null;
      const { w, h, lum } = grid;

      let lo = 1;
      let hi = 0;
      for (let i = 0; i < lum.length; i++) {
        if (lum[i] < lo) lo = lum[i];
        if (lum[i] > hi) hi = lum[i];
      }
      const span = Math.max(0.001, hi - lo);

      const ink = new Float32Array(lum.length);
      let sum = 0;
      for (let i = 0; i < lum.length; i++) {
        const v = Math.pow((lum[i] - lo) / span, 1.5);
        ink[i] = v;
        sum += v;
      }

      const voluti =
        this.count > 0 ? Math.min(this.TONES, this.count) : this.TONES;
      const scale = voluti / Math.max(1, sum);
      for (let i = 0; i < ink.length; i++) ink[i] = Math.min(1, ink[i] * scale);

      const keep: number[] = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const value = ink[i];
          const on = value > 0.5 ? 1 : 0;
          if (on) {
            keep.push(x / w, y / h);
          }
          const error = value - on;
          if (x + 1 < w) ink[i + 1] += (error * 7) / 16;
          if (y + 1 < h) {
            if (x > 0) ink[i + w - 1] += (error * 3) / 16;
            ink[i + w] += (error * 5) / 16;
            if (x + 1 < w) ink[i + w + 1] += (error * 1) / 16;
          }
        }
      }
      if (keep.length < 240) return null;
      return { points: Float32Array.from(keep), aspect: h / w };
    },

    // ------------------------------------------------------------------

    build(this: any) {
      const canvas = this.canvas as HTMLCanvasElement;

      canvas.width = Math.floor(canvas.clientWidth || window.innerWidth);
      canvas.height = Math.floor(canvas.clientHeight || window.innerHeight);
      this.buffer = this.ctx.createImageData(canvas.width, canvas.height);

      const wanted = Math.round((canvas.width * canvas.height) / 110);
      this.count = Math.max(6000, Math.min(13000, wanted));

      const { cx, cy, roomW, roomH } = this.bounds();
      const cella = (Math.min(roomW, roomH) * this.MARGIN) / this.SAMPLE_W;
      this.dot = Math.max(this.DOT_MIN, Math.min(this.DOT, cella * 0.62));

      this.px = new Float32Array(this.count);
      this.py = new Float32Array(this.count);
      this.vx = new Float32Array(this.count);
      this.vy = new Float32Array(this.count);
      this.tx = new Float32Array(this.count);
      this.ty = new Float32Array(this.count);
      this.sx = new Float32Array(this.count);
      this.sy = new Float32Array(this.count);
      this.bow = new Float32Array(this.count);
      this.delay = new Float32Array(this.count);

      for (let i = 0; i < this.count; i++) {
        this.px[i] = cx + (Math.random() - 0.5) * roomW;
        this.py[i] = cy + (Math.random() - 0.5) * roomH;
        this.vx[i] = (Math.random() - 0.5) * 0.4;
        this.vy[i] = (Math.random() - 0.5) * 0.4;
        this.delay[i] = Math.random() * 0.35;
      }
      this.sx.set(this.px);
      this.sy.set(this.py);

      this.shapeIndex = -1;
      this.phase = "hold";
      this.phaseAt = performance.now();
      this.run();

      this.compose();
    },

    compose(this: any) {
      if (this.shapes.length === 0 || this.count === 0) return;

      this.sx.set(this.px);
      this.sy.set(this.py);
      const count = this.count as number;
      const delay = this.delay as Float32Array;
      const bow = this.bow as Float32Array;
      for (let i = 0; i < count; i++) {

        delay[i] = Math.random() * 0.35;
        bow[i] = (Math.random() - 0.5) * 2 * this.BOW;
      }
      this.nextShape();
      this.phase = "morph";
      this.phaseAt = performance.now();
    },

    run(this: any) {
      this.stop();
      if (this.still) {

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
          this.px.set(this.tx);
          this.py.set(this.ty);
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

    bounds(this: any) {
      const canvas = this.canvas as HTMLCanvasElement;
      const wide = canvas.width >= 1024;

      const libero = wide ? 0 : 96;
      const cx = canvas.width * (wide ? 0.7 : 0.5);
      const cy = libero + (canvas.height - libero) * (wide ? 0.5 : 0.37);
      return {
        cx,
        cy,
        roomW: 2 * Math.min(cx, canvas.width - cx),
        roomH: 2 * Math.min(cy - libero, canvas.height - cy),
      };
    },

    nextShape(this: any) {
      if (this.shapes.length === 0) return;
      this.shapeIndex = (this.shapeIndex + 1) % this.shapes.length;
      const shape = this.shapes[this.shapeIndex];
      const points = shape.points;
      const total = points.length / 2;
      const canvas = this.canvas as HTMLCanvasElement;

      const { cx, cy, roomW, roomH } = this.bounds();
      const drawW =
        Math.min(roomW, roomH / shape.aspect) * this.MARGIN;
      const drawH = drawW * shape.aspect;
      const left = cx - drawW / 2;
      const top = cy - drawH / 2;

      const px = this.px as Float32Array;
      const py = this.py as Float32Array;

      const pointAngle = new Float32Array(total);
      const order = new Uint32Array(total);
      for (let i = 0; i < total; i++) {
        order[i] = i;
        pointAngle[i] = Math.atan2(
          top + points[i * 2 + 1] * drawH - cy,
          left + points[i * 2] * drawW - cx,
        );
      }
      order.sort((a, b) => pointAngle[a] - pointAngle[b]);

      const count = this.count as number;
      const mineAngle = new Float32Array(count);
      const mine = new Uint32Array(count);
      for (let i = 0; i < count; i++) {
        mine[i] = i;
        mineAngle[i] = Math.atan2(py[i] - cy, px[i] - cx);
      }
      mine.sort((a, b) => mineAngle[a] - mineAngle[b]);

      const crowd = count / Math.max(1, total);
      const spread = crowd > 1.4 ? Math.min(1.8, crowd * 0.5) : 0;

      const tx = this.tx as Float32Array;
      const ty = this.ty as Float32Array;
      for (let k = 0; k < count; k++) {
        const particle = mine[k];
        const point = order[Math.floor((k * total) / count)] * 2;
        const jitter = spread > 0 ? (Math.random() - 0.5) * spread * 2 : 0;
        tx[particle] = left + points[point] * drawW + jitter;
        ty[particle] = top + points[point + 1] * drawH + jitter;
      }
    },

    tick(this: any, now: number, dt: number) {
      let elapsed = now - this.phaseAt;

      if (this.phase === "hold" && elapsed > this.HOLD) {
        this.compose();
        elapsed = 0;
      } else if (this.phase === "morph" && elapsed > this.MORPH) {
        this.phase = "hold";
        this.phaseAt = now;
        elapsed = 0;
      }
      const span = this.phase === "morph" ? this.MORPH : this.HOLD;
      this.advance(dt, this.phase, now / 1000, Math.min(1, elapsed / span));
    },

    advance(this: any, dt: number, phase: string, time = 0, progress = 1) {
      const canvas = this.canvas as HTMLCanvasElement;
      const idle = this.shapeIndex < 0;
      const damping = 0.88;

      const count = this.count as number;
      const px = this.px as Float32Array;
      const py = this.py as Float32Array;
      const vx = this.vx as Float32Array;
      const vy = this.vy as Float32Array;
      const tx = this.tx as Float32Array;
      const ty = this.ty as Float32Array;
      const sx = this.sx as Float32Array;
      const sy = this.sy as Float32Array;
      const bow = this.bow as Float32Array;
      const delay = this.delay as Float32Array;
      const midX = canvas.width / 2;
      const midY = canvas.height / 2;
      const morphing = phase === "morph";

      for (let i = 0; i < count; i++) {
        if (idle) {
          const flowX = px[i] * 0.006;
          const flowY = py[i] * 0.008;
          vx[i] += Math.sin(flowY + time * 0.25) * 5 * dt;
          vy[i] += Math.cos(flowX - time * 0.2) * 5 * dt;

          vx[i] += (midX - px[i]) * 0.05 * dt;
          vy[i] += (midY - py[i]) * 0.05 * dt;
          vx[i] *= damping;
          vy[i] *= damping;
          px[i] += vx[i];
          py[i] += vy[i];
        } else if (!morphing) {

          px[i] = tx[i];
          py[i] = ty[i];
        } else {

          let own = (progress - delay[i]) / (1 - delay[i]);
          if (own < 0) own = 0;
          else if (own > 1) own = 1;
          const eased = own * own * own * (own * (own * 6 - 15) + 10);

          const dx = tx[i] - sx[i];
          const dy = ty[i] - sy[i];

          const swell = Math.sin(Math.PI * eased) * bow[i];
          px[i] = sx[i] + dx * eased - dy * swell;
          py[i] = sy[i] + dy * eased + dx * swell;

          vx[i] = 0;
          vy[i] = 0;
        }
      }
    },

    // ------------------------------------------------------------------

    draw(this: any) {
      const canvas = this.canvas as HTMLCanvasElement;
      const buffer = this.buffer as ImageData;
      if (!buffer) return;
      const data = buffer.data;
      data.fill(0);

      const w = canvas.width;
      const h = canvas.height;
      const radius = this.dot as number;

      const margin = Math.min(w, h) * this.EDGE;

      const count = this.count as number;
      const px = this.px as Float32Array;
      const py = this.py as Float32Array;
      const maxAlpha = this.ALPHA as number;

      const ink = this.ink as { r: number; g: number; b: number };
      const tr = ink.r;
      const tg = ink.g;
      const tb = ink.b;

      for (let i = 0; i < count; i++) {
        const cx = px[i];
        const cy = py[i];
        const border = Math.min(cx, cy, w - cx, h - cy);
        if (border <= 0) continue;
        const fade = Math.min(1, border / margin);
        const alpha = maxAlpha * fade * fade;
        if (alpha < 0.012) continue;
        const x0 = Math.max(0, Math.floor(cx - radius));
        const x1 = Math.min(w - 1, Math.ceil(cx + radius));
        const y0 = Math.max(0, Math.floor(cy - radius));
        const y1 = Math.min(h - 1, Math.ceil(cy + radius));

        for (let py = y0; py <= y1; py++) {
          const dy = py + 0.5 - cy;
          const row = py * w;
          for (let px = x0; px <= x1; px++) {
            const dx = px + 0.5 - cx;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const coverage = Math.min(1, Math.max(0, radius - distance + 0.5));
            if (coverage <= 0) continue;
            const o = (row + px) * 4;
            const a = Math.round(alpha * coverage * 255);
            if (a <= data[o + 3]) continue;
            data[o] = tr;
            data[o + 1] = tg;
            data[o + 2] = tb;
            data[o + 3] = a;
          }
        }
      }
      this.ctx.putImageData(buffer, 0, 0);
    },
  };
}

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
