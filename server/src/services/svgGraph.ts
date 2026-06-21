import fs from "fs";
import path from "path";

/*
 * Parser SVG -> grafo del museo.
 *
 * La mappa SVG e' l'UNICA fonte di verita' spaziale: il curatore arricchisce
 * la mappa che disegna gia' con attributi data-*, e qui la trasformiamo in un
 * grafo navigabile (nodi, archi, sale, ostacoli) usato per le indicazioni.
 *
 * Convenzione (vedi spec.md):
 *  - sala (AREA)  -> una forma (circle/rect/polygon) con data-room="Nome". La sala
 *                    di un nodo/ostacolo e' quella la cui AREA lo CONTIENE
 *                    (point-in-region): rispetta i muri = i confini dell'area, non
 *                    la semplice vicinanza. Le aree si valutano in ordine di
 *                    documento: la prima che contiene il punto vince (mettere prima
 *                    le aree piu' specifiche, es. una stanza dentro un'altra).
 *  - nodo-opera   -> data-qid="Qxxx" (una forma puo' essere insieme area e opera:
 *                    un'opera che e' essa stessa una sala)
 *  - nodo-POI     -> data-poi="exit|emergency_exit|toilet|bar|shop|elevator|stairs" [+ data-label]
 *  - ostacolo     -> data-obstacle="steps|door|chairs|object" + data-desc
 *  - arco         -> <line data-edge ...>; gli estremi vengono agganciati al nodo piu' vicino
 */

export interface GraphNode {
  id: string;
  kind: "artwork" | "poi";
  qid: string; // valorizzato per le opere, "" per i POI
  poiType: string; // valorizzato per i POI, "" per le opere
  label: string;
  x: number;
  y: number;
  room: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface GraphObstacle {
  id: string;
  type: string;
  description: string;
  room: string;
}

export interface MuseumGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  obstacles: GraphObstacle[];
}

// un'area-sala: la forma (con i suoi parametri) e il nome della sala.
type RegionShape =
  | { kind: "circle"; name: string; cx: number; cy: number; r: number }
  | { kind: "rect"; name: string; x: number; y: number; w: number; h: number }
  | { kind: "polygon"; name: string; pts: { x: number; y: number }[] };

// distanza massima (in unita' del viewBox) entro cui un estremo di arco viene
// agganciato a un nodo. Gli estremi sono authored sui centri dei nodi, quindi
// e' di fatto ~0; il margine copre piccole imprecisioni del disegno.
const SNAP_EPSILON = 25;

// La cartella public e' server/public (questo file sta in server/src/services).
const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");

const cache = new Map<string, MuseumGraph>();

// restituisce il grafo del museo a partire dal suo mapPath (es. "/maps/British Museum.svg").
// Il risultato e' messo in cache per mapPath (la mappa non cambia a runtime).
export function getMuseumGraph(mapPath: string): MuseumGraph {
  const cached = cache.get(mapPath);
  if (cached) return cached;
  const graph = parseSvgFile(mapPath);
  cache.set(mapPath, graph);
  return graph;
}

function emptyGraph(): MuseumGraph {
  return { nodes: [], edges: [], obstacles: [] };
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

// esposta per i test/uso diretto su una stringa SVG.
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

  const tagRe = /<[a-zA-Z]+\b([^>]*?)\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(svg)) !== null) {
    const rawAttrs = match[1];
    const attrs = parseAttrs(rawAttrs);

    // Area-sala: una forma con data-room. Puo' coesistere con un nodo-opera
    // (un'opera che e' essa stessa una sala), quindi non e' esclusiva.
    if (attrs["data-room"]) {
      const region = makeRegion(attrs);
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
          room: "", // assegnata dopo, per area
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

    // data-edge e' un attributo-flag (senza valore): lo cerchiamo nel tag grezzo.
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

  // ogni nodo/ostacolo prende la sala la cui AREA lo contiene (rispetta i muri).
  for (const n of nodes) n.room = resolveRoom(regions, n.x, n.y);
  const obstacles: GraphObstacle[] = obstaclesRaw.map((o) => ({
    id: o.id,
    type: o.type,
    description: o.description,
    room: resolveRoom(regions, o.x, o.y),
  }));

  const edges = snapEdges(rawEdges, nodes);
  return { nodes, edges, obstacles };
}

// prima area (in ordine di documento) che contiene il punto; "" se nessuna.
function resolveRoom(regions: RegionShape[], x: number, y: number): string {
  for (const region of regions) {
    if (regionContains(region, x, y)) return region.name;
  }
  return "";
}

// IL test di contenimento: il punto (x,y) e' dentro l'area?
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

// costruisce la forma-area dagli attributi (tipo inferito dalla geometria).
function makeRegion(attrs: Record<string, string>): RegionShape | null {
  const name = attrs["data-room"];
  if (attrs["points"] !== undefined) {
    const pts = parsePoints(attrs["points"]);
    if (pts.length < 3) return null;
    return { kind: "polygon", name, pts };
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

// ray casting standard: parita' delle intersezioni con una semiretta orizzontale.
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

// trasforma gli archi grezzi (coordinate) in archi tra id di nodi, agganciando
// ogni estremo al nodo piu' vicino entro SNAP_EPSILON. Scarta self-loop e duplicati.
function snapEdges(
  rawEdges: { x1: number; y1: number; x2: number; y2: number }[],
  nodes: GraphNode[],
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const e of rawEdges) {
    const a = nearestNode(nodes, e.x1, e.y1);
    const b = nearestNode(nodes, e.x2, e.y2);
    if (!a || !b) continue;
    if (a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from: a, to: b });
  }
  return edges;
}

function nearestNode(nodes: GraphNode[], x: number, y: number): string | null {
  let bestId: string | null = null;
  let bestDist = SNAP_EPSILON;
  for (const n of nodes) {
    const dx = n.x - x;
    const dy = n.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= bestDist) {
      bestDist = d;
      bestId = n.id;
    }
  }
  return bestId;
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
