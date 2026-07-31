/**
 * LOCALIZZAZIONE AVANZATA — dove sei, e quindi davanti a cosa (slide 33).
 *
 * Qui non si guarda nessuna scheda e non si tocca nessun sensore: c'e' solo la
 * geometria. I sensori stanno in composables/useSensors.ts, la scheda aperta
 * resta affare di Visita.vue. Questo modulo tiene una stima di DOVE SI E'
 * fisicamente, che e' una cosa diversa da quel che si sta guardando: aprire una
 * scheda per curiosita' non sposta nessuno.
 *
 * IL SISTEMA DI COORDINATE NASCE ALL'AVVIO. Il visitatore parte dall'ingresso
 * della pianta e la mappa e' un dipinto steso intorno a lui, che sia a Bologna o
 * a Reykjavik: nessuna coordinata vera va inventata per i musei, e il nord della
 * Terra e' il su della pianta PER DEFINIZIONE — la posa e' arbitraria, quindi si
 * sceglie invece di misurarla. Dal disegno servono due soli dati, entrambi
 * scritti nell'SVG: `data-width-m` (quanti metri e' larga davvero) e il POI
 * `entrance` (dove nasce il sistema). Senza il primo non si sa quanti pixel vale
 * un passo, e la localizzazione automatica non parte.
 *
 * L'ANCORA. Una lettura GPS da sola non vuol dire niente qui, perche' la pianta
 * e' appoggiata dove capita: conta solo la DIFFERENZA fra due letture. Percio'
 * si ricorda una coppia sola — "la lettura di quel momento stava in quel punto
 * della pianta" — e si misura tutto da li'. Chi dichiara dove si trova (QR,
 * codice, scelta fra i candidati, domani il teletrasporto) rifa' la coppia e
 * butta via la deriva accumulata; il movimento GPS invece accumula e basta.
 * Da cui la conseguenza che conta: teletrasportato accanto al tavolo, tre metri
 * a est sono tre metri a est DAL PUNTO DI TELETRASPORTO. E se il GPS tace al
 * chiuso il segnalino resta sull'ultima ancora, che e' la verita': so dov'eri,
 * non ti ho visto muovere.
 *
 * LA CERTEZZA E' UN'EQUAZIONE SOLA, senza rami per piattaforma. Ogni opera ha
 * due scarti — quanto e' lontana e quanto e' fuori asse — pesati per quanto vale
 * ciascuna misura: sigma della distanza e' l'accuratezza che DICHIARA IL DEVICE
 * (un fix da 5 m ordina con decisione, uno da 300 m appiattisce tutto, ed e'
 * corretto cosi'), sigma dell'angolo e' la tolleranza di una bussola dentro un
 * edificio pieno di acciaio e vetrine. Senza bussola il termine angolare sparisce
 * dalla stessa equazione, le probabilita' si appiattiscono e compare il pannello
 * di scelta: l'orientamento non viene TOLTO dove manca il magnetometro, e'
 * ASSENTE, e la formula dice gia' cosa significa. Il nome del sistema operativo
 * non compare da nessuna parte: contano solo i numeri che i sensori hanno dato.
 */

import { ref, computed } from "vue";
import { map } from "./state";

// ============================================================================
//                                 Costanti
// ============================================================================

/** Quanto sbaglia una bussola al chiuso, in gradi. */
const SIGMA_ANGOLO = 30;
/** Nessun fix e' piu' preciso di cosi': sotto, la fiducia diventa finta. */
const SIGMA_DISTANZA_MINIMA = 4;
/** Quanto vale la parola del visitatore, in metri: sta davanti all'opera. */
const ACCURACY_DICHIARATA = 2;

/** Si apre senza chiedere solo con un vincitore netto: alto e staccato. */
const P_SICURO = 0.55;
const STACCO_SICURO = 2;

/** Cosa finisce nel pannello di scelta. */
const P_MINIMO = 0.05;
const MAX_CANDIDATI = 6;

/** Metri per grado: bastano, alle distanze di un edificio. */
const METRI_PER_GRADO_LAT = 110540;
const METRI_PER_GRADO_LON = 111320;

// ============================================================================
//                            Lettura della pianta
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

/** La localizzazione automatica esiste solo se la pianta porta i suoi due dati. */
export const localizzabile = computed(
  () => geometria.value !== null && geometria.value.entrance !== null,
);

// ============================================================================
//                             Stima e ancoraggio
// ============================================================================

export interface Stima {
  x: number;
  y: number;
  /** Raggio di incertezza in metri, come lo dichiara il device. */
  accuracy: number;
}

/**
 * L'ancora: un punto della pianta e la lettura GPS che gli corrisponde. `lat` e
 * `lon` restano nulle finche' un fix non arriva — si puo' dichiarare di essere
 * davanti a un'opera prima che il GPS abbia parlato, e allora sara' la prima
 * lettura utile a prendere il posto.
 */
const ancora = ref<{ x: number; y: number; lat: number | null; lon: number | null } | null>(
  null,
);

export const stima = ref<Stima | null>(null);
export const bussola = ref<number | null>(null);

/** Prima di qualunque fix si e' all'ingresso, e non si sa altro: l'incertezza
 *  vale l'intero edificio, cioe' nessuna opera e' piu' probabile per posizione.
 *  Se c'e' la bussola, decide da sola; se non c'e', si sceglie dal pannello. */
export function startAtEntrance() {
  const g = geometria.value;
  if (!g || !g.entrance) return;
  if (ancora.value) return;
  ancora.value = { x: g.entrance.x, y: g.entrance.y, lat: null, lon: null };
  stima.value = { x: g.entrance.x, y: g.entrance.y, accuracy: g.larghezzaMetri };
}

/**
 * Un atto dichiarato — QR, codice, scelta fra i candidati, teletrasporto — da
 * adesso "qui" e' questo punto della pianta, e la deriva accumulata dal GPS si
 * butta via. Chi dichiara sta davanti all'opera, quindi l'incertezza torna a
 * pochi passi: e' il dato migliore che il sistema possa avere, meglio di
 * qualunque fix.
 *
 * `lat` e `lon` tornano nulle, e non e' una dimenticanza: la lettura ricordata
 * nell'ancora e' la PRIMA arrivata e non viene piu' aggiornata, quindi tenerla
 * qui vorrebbe dire misurare il prossimo fix a partire da quella — cioe'
 * riapplicare, tutta in una volta, la deriva accumulata da allora, buttando via
 * il punto appena dichiarato. Azzerandole, la prima lettura utile ridiventa il
 * riferimento proprio qui. Al chiuso, dove nessun fix arriva, la differenza non
 * si vede: e' il motivo per cui non si vedeva.
 */
export function reanchor(x: number, y: number) {
  ancora.value = { x, y, lat: null, lon: null };
  stima.value = { x, y, accuracy: ACCURACY_DICHIARATA };
}

/** Il punto della pianta di un'opera, per chi deve ri-ancorare a una scansione. */
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

  // La prima lettura utile diventa la lettura dell'ancora: da qui in poi conta
  // solo di quanto ci si e' spostati rispetto a questa.
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
  p: number;
}

export interface Verdetto {
  candidati: Candidato[];
  sicuro: boolean;
}

/** Differenza fra due direzioni, sempre fra 0 e 180 gradi. */
function scartoAngolare(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * Il verdetto: le opere ordinate per probabilita', e se una vince abbastanza.
 * Ritorna null solo quando non c'e' niente su cui ragionare (pianta senza dati,
 * o nessuna posizione stimata).
 */
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

    // Il termine angolare esiste solo se una bussola ha risposto. Dove manca,
    // sparisce dall'equazione invece di essere sostituito da un valore finto.
    if (bussola.value !== null && metri > 0.5) {
      const direzione = (Math.atan2(dx, -dy) * 180) / Math.PI;
      const scarto = scartoAngolare(direzione, bussola.value);
      costo += (scarto / SIGMA_ANGOLO) * (scarto / SIGMA_ANGOLO);
    }
    costi.push({ qid: n.qid, costo });
  }

  // Si sottrae il costo minimo prima di esponenziare: senza, un edificio grande
  // manda tutti gli esponenti a zero e le probabilita' diventano 0/0.
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
