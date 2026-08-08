/**
 * Da mappa SVG a grafo delle sale.
 *
 * La mappa e' l'unica fonte di verita' spaziale: il curatore annota con
 * attributi data-* il disegno che fa comunque, e qui lo si traduce in sale,
 * nodi, collegamenti e ostacoli.
 *
 * Il contratto che il curatore annota:
 *  - sala          data-room="Nome" su una forma. Le aree si valutano in ordine
 *                  di documento e vince la prima che contiene il punto, quindi
 *                  una sala dentro un'altra va scritta prima di quella che la
 *                  circonda.
 *  - nodo-opera    data-qid="Qxxx" [+ data-label]
 *  - nodo-POI      data-poi="entrance|exit|emergency_exit|toilet|bar|shop|
 *                  elevator|stairs". `entrance` non e' facoltativo: e' il punto
 *                  da cui il pathfinding parte quando nessuno ha detto dove si
 *                  trova (`services/wayfinding.ts`), e una mappa senza non sa
 *                  rispondere a chi non si e' ancora mosso.
 *  - ostacolo      data-obstacle="steps|door|chairs|object" + data-desc
 *  - collegamento  <line data-edge>: ogni estremo si risolve alla sala che lo
 *                  contiene, non al nodo piu' vicino
 *  - percorso      data-flow="3" sulla sala: l'ordine in cui il museo consiglia
 *                  di attraversarla. Non si calcola, perche' non e' una
 *                  proprieta' geometrica. Le sale che tacciono vanno in fondo.
 *  - piano         <g data-floor="1" data-floor-label="Primo piano">
 *
 * La sala di un nodo e' quella la cui area lo contiene, non quella piu' vicina,
 * cosi' i muri contano. I collegamenti sono solo quelli disegnati: ogni spazio
 * percorribile, corridoi compresi, deve essere una sala o non puo' comparire in
 * un percorso.
 *
 * Il grafo non si divide per piano. Le scale sono un vano su ciascun piano, i
 * due vani sono uniti da un data-edge come due sale confinanti, e un percorso
 * attraversa i piani come attraversa le sale: non esiste un caso "cambio piano".
 * Il nome del piano lo scrive il curatore, perche' un museo ha il Mezzanino e un
 * altro cinque piani numerati.
 *
 * Tre trappole:
 *  - le coordinate si leggono alla lettera (cx/cy, x/y/width/height): un
 *    transform su un elemento con data-* non viene applicato, e il nodo finisce
 *    nella sala sbagliata senza che nessuno se ne accorga;
 *  - i nomi delle sale sono unici su tutta la mappa, piani compresi, perche' le
 *    adiacenze si tengono per nome: due omonime diventerebbero una sola;
 *  - i commenti si tolgono prima di scandire, o un <g> nominato in un commento
 *    sposta il conto dei gruppi e con lui il piano di tutto il resto.
 *
 * `flowOrder` rende i qid nell'ordine in cui il curatore vuole che si percorra il
 * museo: `data-flow` sulle sale, e dentro una sala l'ordine in cui sono
 * disegnate, perche' li' non c'e' niente da percorrere — ci si e' gia'. Le sale
 * che tacciono vanno in fondo nell'ordine del disegno, quindi una mappa che non
 * dichiara nessun flusso lascia le opere come stavano. `sortByFlow` applica
 * quell'ordine a un elenco qualunque di cose che portano un qid, e chi sulla
 * mappa non c'e' resta in fondo: e' un'opera del catalogo che nessuno ha ancora
 * collocato, non un errore.
 *
 * `elementId` non e' `id`: il primo e' la forma da colorare e numerare nel
 * navigator, il secondo e' il qid. Un elenco di piani VUOTO e' la condizione
 * normale di un museo a un piano solo, e da li' discende che di piani non se ne
 * parli mai.
 */
import fs from "fs";
import path from "path";

export interface GraphNode {
  id: string; // per un'opera e' il qid: e' con quello che il pathfinding indica una destinazione
  kind: "artwork" | "poi";
  qid: string;
  poiType: string;
  label: string;
  x: number;
  y: number;
  room: string; // la sala la cui AREA lo contiene, risolta dopo la scansione
  floor: number; // il piano: quello della sua sala, o del gruppo che lo contiene
  elementId: string; // l'attributo `id` dell'elemento SVG, cioe' `Artwork.locationId`
}

export interface GraphRegion {
  name: string; // unico su tutta la mappa, piani compresi: le adiacenze si tengono per nome
  neighbors: string[];
  floor: number; // senza `data-floor` sulla mappa e' 0
  flow: number; // l'ordine di visita che il curatore le ha dato; 0 = non dichiarato
}

export interface GraphObstacle {
  id: string;
  type: string;
  description: string;
  room: string;
}

export interface GraphFloor {
  floor: number;
  label: string; // come lo chiama il curatore; senza `data-floor-label` e' "piano N"
}

export interface MuseumGraph {
  nodes: GraphNode[];
  regions: GraphRegion[];
  obstacles: GraphObstacle[];
  floors: GraphFloor[]; // dal basso in alto; VUOTO se la mappa non ne dichiara nessuno
}

type RegionShape = { floor: number; flow: number } & (
  | { kind: "circle"; name: string; cx: number; cy: number; r: number }
  | { kind: "rect"; name: string; x: number; y: number; w: number; h: number }
  | { kind: "polygon"; name: string; pts: { x: number; y: number }[] }
);

const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");

const cache = new Map<string, MuseumGraph>();

export function getMuseumGraph(mapPath: string): MuseumGraph {
  const cached = cache.get(mapPath);
  if (cached) return cached;
  const graph = parseSvgFile(mapPath);
  cache.set(mapPath, graph);
  return graph;
}

function emptyGraph(): MuseumGraph {
  return { nodes: [], regions: [], obstacles: [], floors: [] };
}

function parseSvgFile(mapPath: string): MuseumGraph {
  const filePath = path.join(PUBLIC_DIR, mapPath);
  let svg = "";
  try {
    svg = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    console.error(`[svgGraph] impossibile leggere la mappa ${filePath}`, err);
    return emptyGraph();
  }
  return parseSvg(svg);
}

export function flowOrder(mapPath: string): string[] {
  const graph = getMuseumGraph(mapPath);
  const flusso = new Map<string, number>();
  for (const r of graph.regions) flusso.set(r.name, r.flow);

  const opere = graph.nodes.filter((n) => n.kind === "artwork");
  const posizione = new Map<string, number>();
  opere.forEach((n, i) => posizione.set(n.qid, i));

  const ordinate = [...opere].sort((a, b) => {
    const fa = flusso.get(a.room) || Number.MAX_SAFE_INTEGER;
    const fb = flusso.get(b.room) || Number.MAX_SAFE_INTEGER;
    if (fa !== fb) return fa - fb;
    return (posizione.get(a.qid) || 0) - (posizione.get(b.qid) || 0);
  });
  return ordinate.map((n) => n.qid);
}

export function sortByFlow<T extends { qid: string }>(
  items: T[],
  mapPath: string,
): T[] {
  if (!mapPath) return items;
  const ordine = new Map<string, number>();
  flowOrder(mapPath).forEach((qid, i) => ordine.set(qid, i));
  return [...items].sort((a, b) => {
    const ia = ordine.get(a.qid);
    const ib = ordine.get(b.qid);
    if (ia === undefined && ib === undefined) return 0;
    if (ia === undefined) return 1;
    if (ib === undefined) return -1;
    return ia - ib;
  });
}

export function parseSvg(svg: string): MuseumGraph {
  const nodes: GraphNode[] = [];
  const obstaclesRaw: {
    id: string;
    type: string;
    description: string;
    x: number;
    y: number;
  }[] = [];
  const rawEdges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const regions: RegionShape[] = [];

  let poiCount = 0;
  let obstacleCount = 0;

  let gDepth = 0;
  let floor = 0;
  let floorDepth = -1;
  const floorLabels = new Map<number, string>();

  const disegno = svg.replace(/<!--[\s\S]*?-->/g, "");
  const tagRe = /<(\/?)([a-zA-Z]+)\b([^>]*?)(\/?)>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(disegno)) !== null) {
    const chiusura = match[1] === "/";
    const nome = match[2];
    const rawAttrs = match[3];
    const autochiuso = match[4] === "/";

    if (nome === "g") {
      if (chiusura) {
        gDepth--;
        if (floorDepth >= 0 && gDepth <= floorDepth) {
          floor = 0;
          floorDepth = -1;
        }
        continue;
      }
      if (!autochiuso) {
        const suoi = parseAttrs(rawAttrs);
        const suo = suoi["data-floor"];
        if (suo !== undefined && floorDepth < 0) {
          floor = parseInt(suo, 10) || 0;
          floorDepth = gDepth;
          let label = suoi["data-floor-label"];
          if (!label) label = `piano ${floor}`;
          floorLabels.set(floor, label);
        }
        gDepth++;
      }
      continue;
    }
    if (chiusura) continue;

    const attrs = parseAttrs(rawAttrs);

    if (attrs["data-room"]) {
      const region = makeRegion(attrs, floor);
      if (region) regions.push(region);
    }

    if (attrs["data-qid"]) {
      const center = elementCenter(attrs);
      if (center) {
        let label = attrs["data-qid"];
        if (attrs["data-label"]) label = attrs["data-label"];
        nodes.push({
          id: attrs["data-qid"],
          kind: "artwork",
          qid: attrs["data-qid"],
          poiType: "",
          label,
          x: center.x,
          y: center.y,
          room: "",
          floor,
          elementId: attrs["id"] || "",
        });
      }
    } else if (attrs["data-poi"]) {
      const center = elementCenter(attrs);
      if (center) {
        poiCount++;
        let label = attrs["data-poi"];
        if (attrs["data-label"]) label = attrs["data-label"];
        nodes.push({
          id: `poi-${attrs["data-poi"]}-${poiCount}`,
          kind: "poi",
          qid: "",
          poiType: attrs["data-poi"],
          label,
          x: center.x,
          y: center.y,
          room: "",
          floor,
          elementId: attrs["id"] || "",
        });
      }
    } else if (attrs["data-obstacle"]) {
      const center = elementCenter(attrs);
      if (center) {
        obstacleCount++;
        let description = attrs["data-obstacle"];
        if (attrs["data-desc"]) description = attrs["data-desc"];
        obstaclesRaw.push({
          id: `obstacle-${obstacleCount}`,
          type: attrs["data-obstacle"],
          description,
          x: center.x,
          y: center.y,
        });
      }
    }

    if (rawAttrs.includes("data-edge")) {
      if (
        attrs["x1"] !== undefined &&
        attrs["y1"] !== undefined &&
        attrs["x2"] !== undefined &&
        attrs["y2"] !== undefined
      ) {
        rawEdges.push({
          x1: parseFloat(attrs["x1"]),
          y1: parseFloat(attrs["y1"]),
          x2: parseFloat(attrs["x2"]),
          y2: parseFloat(attrs["y2"]),
        });
      }
    }
  }

  for (const n of nodes) {
    const sala = regionAt(regions, n.x, n.y);
    if (sala) {
      n.room = sala.name;
      n.floor = sala.floor;
    }
  }
  const obstacles: GraphObstacle[] = obstaclesRaw.map((o) => ({
    id: o.id,
    type: o.type,
    description: o.description,
    room: resolveRoom(regions, o.x, o.y),
  }));

  const floors: GraphFloor[] = [];
  for (const [numero, label] of floorLabels) {
    floors.push({ floor: numero, label });
  }
  floors.sort((a, b) => a.floor - b.floor);

  const graphRegions = buildRegions(regions, rawEdges);
  return { nodes, regions: graphRegions, obstacles, floors };
}

function regionAt(
  regions: RegionShape[],
  x: number,
  y: number,
): RegionShape | null {
  for (const region of regions) {
    if (regionContains(region, x, y)) return region;
  }
  return null;
}

function resolveRoom(regions: RegionShape[], x: number, y: number): string {
  const region = regionAt(regions, x, y);
  if (region) return region.name;
  return "";
}

function regionContains(region: RegionShape, x: number, y: number): boolean {
  if (region.kind === "circle") {
    const dx = x - region.cx;
    const dy = y - region.cy;
    return dx * dx + dy * dy <= region.r * region.r;
  }
  if (region.kind === "rect") {
    return (
      x >= region.x &&
      x <= region.x + region.w &&
      y >= region.y &&
      y <= region.y + region.h
    );
  }
  return pointInPolygon(x, y, region.pts);
}

function makeRegion(
  attrs: Record<string, string>,
  floor: number,
): RegionShape | null {
  const name = attrs["data-room"];
  let flow = parseInt(attrs["data-flow"] || "", 10);
  if (isNaN(flow)) flow = 0;
  if (attrs["points"] !== undefined) {
    const pts = parsePoints(attrs["points"]);
    if (pts.length < 3) return null;
    return { kind: "polygon", name, pts, floor, flow };
  }
  if (
    attrs["r"] !== undefined &&
    attrs["cx"] !== undefined &&
    attrs["cy"] !== undefined
  ) {
    return {
      kind: "circle",
      name,
      cx: parseFloat(attrs["cx"]),
      cy: parseFloat(attrs["cy"]),
      r: parseFloat(attrs["r"]),
      floor,
      flow,
    };
  }
  if (
    attrs["x"] !== undefined &&
    attrs["y"] !== undefined &&
    attrs["width"] !== undefined &&
    attrs["height"] !== undefined
  ) {
    return {
      kind: "rect",
      name,
      x: parseFloat(attrs["x"]),
      y: parseFloat(attrs["y"]),
      w: parseFloat(attrs["width"]),
      h: parseFloat(attrs["height"]),
      floor,
      flow,
    };
  }
  return null;
}

function parsePoints(s: string): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const tokens = s.trim().split(/\s+/);
  for (const t of tokens) {
    const parts = t.split(",");
    if (parts.length < 2) continue;
    pts.push({ x: parseFloat(parts[0]), y: parseFloat(parts[1]) });
  }
  return pts;
}

function pointInPolygon(
  x: number,
  y: number,
  pts: { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function buildRegions(
  regions: RegionShape[],
  rawEdges: { x1: number; y1: number; x2: number; y2: number }[],
): GraphRegion[] {
  const neighbors = new Map<string, Set<string>>();
  for (const r of regions) {
    if (!neighbors.has(r.name)) neighbors.set(r.name, new Set<string>());
  }

  for (const e of rawEdges) {
    const a = resolveRoom(regions, e.x1, e.y1);
    const b = resolveRoom(regions, e.x2, e.y2);
    link(neighbors, a, b);
  }

  const piani = new Map<string, number>();
  const flussi = new Map<string, number>();
  for (const r of regions) {
    if (r.flow > 0 && !flussi.has(r.name)) flussi.set(r.name, r.flow);
    const gia = piani.get(r.name);
    if (gia === undefined) {
      piani.set(r.name, r.floor);
    } else if (gia !== r.floor) {
      console.warn(
        `[svgGraph] la sala "${r.name}" compare sul piano ${gia} e sul piano ` +
          `${r.floor}: le due diventano una sola, cioe' un passaggio fra i ` +
          `piani che nessuno ha disegnato. Dai un nome diverso a una delle due.`,
      );
    }
  }

  const result: GraphRegion[] = [];
  for (const [name, set] of neighbors) {
    result.push({
      name,
      neighbors: Array.from(set),
      floor: piani.get(name) || 0,
      flow: flussi.get(name) || 0,
    });
  }
  return result;
}

function link(neighbors: Map<string, Set<string>>, a: string, b: string): void {
  if (!a || !b) return;
  if (a === b) return;
  const sa = neighbors.get(a);
  const sb = neighbors.get(b);
  if (!sa || !sb) return;
  sa.add(b);
  sb.add(a);
}

function elementCenter(
  attrs: Record<string, string>,
): { x: number; y: number } | null {
  if (attrs["cx"] !== undefined && attrs["cy"] !== undefined) {
    return { x: parseFloat(attrs["cx"]), y: parseFloat(attrs["cy"]) };
  }
  if (attrs["x"] !== undefined && attrs["y"] !== undefined) {
    let w = 0;
    let h = 0;
    if (attrs["width"] !== undefined) w = parseFloat(attrs["width"]);
    if (attrs["height"] !== undefined) h = parseFloat(attrs["height"]);
    return {
      x: parseFloat(attrs["x"]) + w / 2,
      y: parseFloat(attrs["y"]) + h / 2,
    };
  }
  return null;
}

function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}
