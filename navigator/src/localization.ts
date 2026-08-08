/**
 * Localizzazione avanzata: dove sei, e quindi davanti a cosa (slide 33).
 *
 * Qui c'e' solo la geometria. I sensori stanno in `composables/useSensors.ts`, la
 * tappa aperta resta affare di `Visita.vue`: questo modulo stima dove si e'
 * FISICAMENTE, che e' altra cosa da quel che si sta guardando.
 *
 * Il sistema di coordinate nasce all'avvio, col visitatore all'ingresso e la
 * pianta stesa intorno a lui: il nord della Terra e' il su del disegno per
 * definizione, quindi nessun museo ha bisogno di coordinate vere. Dall'SVG
 * servono due dati soli: `data-width-m` (quanti metri e' larga la pianta) e il
 * POI `entrance`. Senza il primo non si sa quanti pixel vale un passo e la
 * localizzazione automatica non parte.
 *
 * L'ancora e' il cuore: una lettura GPS da sola non dice niente, conta solo la
 * DIFFERENZA fra due letture, quindi si ricorda una coppia sola (quella lettura
 * stava in quel punto della pianta) e si misura da li'. Chi dichiara dove si
 * trova rifa' la coppia e butta la deriva; il movimento GPS invece accumula. Ne
 * segue che tre metri a est sono tre metri a est DAL PUNTO DICHIARATO, e che se
 * il GPS tace il segnalino resta sull'ultima ancora, che e' la verita': so dov'eri,
 * non ti ho visto muovere.
 *
 * La certezza e' un'equazione sola, senza rami per piattaforma: ogni opera ha due
 * scarti, distanza e disallineamento, pesati per quanto vale la misura. Sigma
 * della distanza e' l'accuratezza dichiarata dal dispositivo, sigma dell'angolo la
 * tolleranza di una bussola dentro un edificio pieno di acciaio. Senza bussola il
 * termine angolare sparisce dalla stessa equazione, le probabilita' si
 * appiattiscono e compare il pannello di scelta: l'orientamento non viene tolto,
 * e' assente, e la formula dice gia' cosa vuol dire.
 *
 * I tre modi in cui l'ancora si sposta:
 *
 * `startAtEntrance` — prima di qualunque fix si e' all'ingresso e non si sa
 * altro, quindi l'incertezza vale l'intero edificio: nessuna opera e' piu'
 * probabile per posizione, e a decidere resta la bussola o il pannello.
 *
 * `reanchor` — un atto DICHIARATO (QR, codice, scelta fra i candidati,
 * teletrasporto): da qui in avanti "qui" e' questo punto, e la deriva accumulata
 * si butta via. Chi dichiara sta davanti all'opera, quindi l'incertezza torna a
 * pochi passi, ed e' il dato migliore che il sistema possa avere. `lat` e `lon`
 * tornano NULLE, e non e' una dimenticanza: la lettura ricordata nell'ancora e'
 * la prima arrivata e non si aggiorna piu', quindi tenerla vorrebbe dire misurare
 * il prossimo fix a partire da quella, cioe' riapplicare in un colpo tutta la
 * deriva accumulata da allora e buttare via il punto appena dichiarato.
 * Azzerandole, la prima lettura utile ridiventa il riferimento proprio qui. Al
 * chiuso, dove nessun fix arriva, la differenza non si vede: e' il motivo per cui
 * non si vedeva.
 *
 * `applyFix` — il movimento misurato dal GPS, che si accumula sull'ancora.
 *
 * In `rank` due dettagli che sembrano di forma e non lo sono: il termine angolare
 * ESISTE solo se una bussola ha risposto, e dove manca sparisce dall'equazione
 * invece di essere sostituito da un valore finto; e il costo minimo si sottrae
 * prima di esponenziare, perche' senza, in un edificio grande, tutti gli esponenti
 * vanno a zero e le probabilita' diventano 0/0.
 */

import { ref, computed } from "vue";
import { map } from "./state";

// ============================================================================
//                                 Costanti
// ============================================================================

const SIGMA_ANGOLO = 30; // quanto sbaglia una bussola al chiuso, in gradi
const SIGMA_DISTANZA_MINIMA = 4; // sotto questo, la fiducia in un fix diventa finta
const ACCURACY_DICHIARATA = 2; // quanto vale la parola del visitatore, in metri

const P_SICURO = 0.55; // si apre senza chiedere solo con un vincitore alto...
const STACCO_SICURO = 2; // ...e staccato dal secondo di tanto

const P_MINIMO = 0.05; // sotto questa probabilita' non si finisce nel pannello di scelta
const MAX_CANDIDATI = 6;

const METRI_PER_GRADO_LAT = 110540; // bastano, alle distanze di un edificio
const METRI_PER_GRADO_LON = 111320;

// ============================================================================
//                            Lettura della pianta
// ============================================================================

export interface MapNode {
  qid: string;
  x: number; // in unita' del viewBox, non in metri
  y: number;
}

interface MapGeometry {
  metriPerUnita: number; // il cambio fra le unita' del disegno e il mondo
  larghezzaMetri: number; // `data-width-m` sulla radice dell'SVG
  entrance: { x: number; y: number } | null; // senza, la localizzazione non parte
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
    nodes.push({ qid: el.getAttribute("data-qid") || "", x: punto.x, y: punto.y });
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
//                             Stima e ancoraggio
// ============================================================================

export interface Stima {
  x: number;
  y: number;
  accuracy: number; // raggio di incertezza in metri, come lo dichiara il dispositivo
}

const ancora = ref<{ x: number; y: number; lat: number | null; lon: number | null } | null>(
  null,
);

export const stima = ref<Stima | null>(null);
export const bussola = ref<number | null>(null);

export function startAtEntrance() {
  const g = geometria.value;
  if (!g || !g.entrance) return;
  if (ancora.value) return;
  ancora.value = { x: g.entrance.x, y: g.entrance.y, lat: null, lon: null };
  stima.value = { x: g.entrance.x, y: g.entrance.y, accuracy: g.larghezzaMetri };
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
//                         Davanti a cosa mi trovo
// ============================================================================

export interface Candidato {
  qid: string;
  p: number; // probabilita' normalizzata: le p di tutti i candidati sommano a 1
}

export interface Verdetto {
  candidati: Candidato[]; // dal piu' probabile, gia' tagliati a `MAX_CANDIDATI`
  sicuro: boolean; // se si puo' aprire la tappa senza chiedere niente
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
