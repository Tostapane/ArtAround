/**
 * Geometria della localizzazione, separata dalle API dei sensori. Un'ancora lega una
 * lettura fisica alla pianta; distanza, accuratezza e bussola classificano le opere,
 * mentre una nuova dichiarazione azzera la deriva.
 */
import { ref, computed } from "vue";
import { map } from "./state";

// ============================================================================

const SIGMA_ANGOLO = 30;
const SIGMA_DISTANZA_MINIMA = 4;
const ACCURACY_DICHIARATA = 2;

const P_SICURO = 0.55;
const STACCO_SICURO = 2;

const P_MINIMO = 0.05;
const MAX_CANDIDATI = 6;

const METRI_PER_GRADO_LAT = 110540;
const METRI_PER_GRADO_LON = 111320;

// ============================================================================

export interface MapNode {
  qid: string;
  x: number;
  y: number;
}

interface MapGeometry {
  metriPerUnita: number;
  larghezzaMetri: number;
  entrance: { x: number; y: number } | null;
  nodes: MapNode[];
}

function centro(el: Element): { x: number; y: number } | null {
  const cx = el.getAttribute("cx");
  const cy = el.getAttribute("cy");
  if (cx !== null && cy !== null) {
    return { x: parseFloat(cx), y: parseFloat(cy) };
  }
  const x = el.getAttribute("x");
  const y = el.getAttribute("y");
  if (x !== null && y !== null) {
    let w = 0;
    let h = 0;
    const width = el.getAttribute("width");
    const height = el.getAttribute("height");
    if (width !== null) w = parseFloat(width);
    if (height !== null) h = parseFloat(height);
    return { x: parseFloat(x) + w / 2, y: parseFloat(y) + h / 2 };
  }
  return null;
}

function leggiGeometria(svgText: string): MapGeometry | null {
  if (!svgText) return null;
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName === "parsererror") return null;

  const viewBox = root.getAttribute("viewBox");
  const larghezzaMetri = parseFloat(root.getAttribute("data-width-m") || "");
  if (!viewBox || isNaN(larghezzaMetri) || larghezzaMetri <= 0) return null;
  const parti = viewBox.trim().split(/[\s,]+/);
  const larghezzaUnita = parseFloat(parti[2] || "");
  if (isNaN(larghezzaUnita) || larghezzaUnita <= 0) return null;

  const nodes: MapNode[] = [];
  root.querySelectorAll("[data-qid]").forEach((el) => {
    const punto = centro(el);
    if (!punto) return;
    nodes.push({
      qid: el.getAttribute("data-qid") || "",
      x: punto.x,
      y: punto.y,
    });
  });

  let entrance: { x: number; y: number } | null = null;
  const porta = root.querySelector('[data-poi="entrance"]');
  if (porta) entrance = centro(porta);

  return {
    metriPerUnita: larghezzaMetri / larghezzaUnita,
    larghezzaMetri,
    entrance,
    nodes,
  };
}

const geometria = computed(() => leggiGeometria(map.value));

export const localizzabile = computed(
  () => geometria.value !== null && geometria.value.entrance !== null,
);

// ============================================================================

export interface Stima {
  x: number;
  y: number;
  accuracy: number;
}

const ancora = ref<{
  x: number;
  y: number;
  lat: number | null;
  lon: number | null;
} | null>(null);

export const stima = ref<Stima | null>(null);
export const bussola = ref<number | null>(null);

export function startAtEntrance() {
  const g = geometria.value;
  if (!g || !g.entrance) return;
  if (ancora.value) return;
  ancora.value = { x: g.entrance.x, y: g.entrance.y, lat: null, lon: null };
  stima.value = {
    x: g.entrance.x,
    y: g.entrance.y,
    accuracy: g.larghezzaMetri,
  };
}

export function reanchor(x: number, y: number) {
  ancora.value = { x, y, lat: null, lon: null };
  stima.value = { x, y, accuracy: ACCURACY_DICHIARATA };
}

export function nodeOf(qid: string): MapNode | null {
  const g = geometria.value;
  if (!g) return null;
  for (const n of g.nodes) {
    if (n.qid === qid) return n;
  }
  return null;
}

export function applyFix(coords: {
  latitude: number;
  longitude: number;
  accuracy: number;
}) {
  const g = geometria.value;
  if (!g) return;
  startAtEntrance();
  const a = ancora.value;
  if (!a) return;

  if (a.lat === null || a.lon === null) {
    a.lat = coords.latitude;
    a.lon = coords.longitude;
    stima.value = { x: a.x, y: a.y, accuracy: coords.accuracy };
    return;
  }

  const est =
    (coords.longitude - a.lon) *
    METRI_PER_GRADO_LON *
    Math.cos((a.lat * Math.PI) / 180);
  const nord = (coords.latitude - a.lat) * METRI_PER_GRADO_LAT;

  stima.value = {
    x: a.x + est / g.metriPerUnita,
    y: a.y - nord / g.metriPerUnita, // la y dell'SVG cresce verso il basso
    accuracy: coords.accuracy,
  };
}

// ============================================================================

export interface Candidato {
  qid: string;
  p: number;
}

export interface Verdetto {
  candidati: Candidato[];
  sicuro: boolean;
}

function scartoAngolare(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

export function rank(): Verdetto | null {
  const g = geometria.value;
  const dove = stima.value;
  if (!g || !dove || g.nodes.length === 0) return null;

  const sigmaD = Math.max(dove.accuracy, SIGMA_DISTANZA_MINIMA);
  const costi: { qid: string; costo: number }[] = [];

  for (const n of g.nodes) {
    const dx = n.x - dove.x;
    const dy = n.y - dove.y;
    const metri = Math.sqrt(dx * dx + dy * dy) * g.metriPerUnita;
    let costo = (metri / sigmaD) * (metri / sigmaD);

    if (bussola.value !== null && metri > 0.5) {
      const direzione = (Math.atan2(dx, -dy) * 180) / Math.PI;
      const scarto = scartoAngolare(direzione, bussola.value);
      costo += (scarto / SIGMA_ANGOLO) * (scarto / SIGMA_ANGOLO);
    }
    costi.push({ qid: n.qid, costo });
  }

  let minimo = Infinity;
  for (const c of costi) {
    if (c.costo < minimo) minimo = c.costo;
  }
  let somma = 0;
  const pesi: { qid: string; peso: number }[] = [];
  for (const c of costi) {
    const peso = Math.exp(-0.5 * (c.costo - minimo));
    pesi.push({ qid: c.qid, peso });
    somma += peso;
  }

  const candidati: Candidato[] = pesi
    .map((c) => ({ qid: c.qid, p: c.peso / somma }))
    .sort((a, b) => b.p - a.p);

  const primo = candidati[0];
  const secondo = candidati[1];
  let sicuro = false;
  if (primo && primo.p >= P_SICURO) {
    if (!secondo) sicuro = true;
    else sicuro = primo.p >= STACCO_SICURO * secondo.p;
  }

  return {
    candidati: candidati.filter((c) => c.p >= P_MINIMO).slice(0, MAX_CANDIDATI),
    sicuro,
  };
}
