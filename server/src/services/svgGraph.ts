/**
 * Da mappa SVG a grafo delle sale.
 *
 * La mappa e' l'unica fonte di verita' spaziale: il curatore arricchisce con
 * attributi data-* il disegno che fa comunque, e qui lo si traduce in sale, nodi,
 * collegamenti e ostacoli.
 *
 * La sala di un nodo e' quella la cui AREA lo contiene, non quella piu' vicina:
 * cosi' i muri contano. I collegamenti sono solo quelli disegnati, nessuna
 * adiacenza viene indovinata — quindi ogni spazio percorribile, corridoi
 * compresi, dev'essere una sala, altrimenti non puo' comparire in un percorso.
 *
 * La convenzione che il curatore annota sul disegno:
 *  - sala (AREA)  -> una forma (circle/rect/polygon) con data-room="Nome". Le aree
 *                    si valutano in ordine di documento: la prima che contiene il
 *                    punto vince, quindi una sala dentro un'altra va scritta prima
 *                    di quella che la circonda.
 *  - nodo-opera   -> data-qid="Qxxx" [+ data-label] (una forma puo' essere insieme
 *                    area e opera: un'opera che e' essa stessa una sala)
 *  - nodo-POI     -> data-poi="exit|emergency_exit|toilet|bar|shop|elevator|stairs" [+ data-label]
 *  - ostacolo     -> data-obstacle="steps|door|chairs|object" + data-desc
 *  - collegamento -> <line data-edge ...> tra due sale: ogni estremo viene
 *                    risolto alla sala che lo CONTIENE (non al nodo piu' vicino).
 *
 * Le coordinate si leggono ALLA LETTERA (cx/cy oppure x/y/width/height): un
 * transform su un elemento con data-* non viene applicato, e il nodo finisce
 * nella sala sbagliata senza che nessuno se ne accorga.
 */
import fs from "fs";
import path from "path";

export interface GraphNode {
  id: string;
  kind: "artwork" | "poi";
  qid: string;
  poiType: string;
  label: string;
  x: number;
  y: number;
  room: string;
  /**
   * L'attributo `id` dell'elemento SVG, che il navigator usa per ritrovare la
   * forma da colorare e numerare (`Artwork.locationId`). Non e' `id` qui sopra:
   * quello, per un'opera, e' il qid, perche' e' con quello che il pathfinding
   * indica una destinazione.
   */
  elementId: string;
}

export interface GraphRegion {
  name: string;
  neighbors: string[]; 
}

export interface GraphObstacle {
  id: string;
  type: string;
  description: string;
  room: string;
}

export interface MuseumGraph {
  nodes: GraphNode[];
  regions: GraphRegion[];
  obstacles: GraphObstacle[];
}

type RegionShape =
  | { kind: "circle"; name: string; cx: number; cy: number; r: number }
  | { kind: "rect"; name: string; x: number; y: number; w: number; h: number }
  | { kind: "polygon"; name: string; pts: { x: number; y: number }[] };

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
  return { nodes: [], regions: [], obstacles: [] };
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
          room: "",
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

  for (const n of nodes) n.room = resolveRoom(regions, n.x, n.y);
  const obstacles: GraphObstacle[] = obstaclesRaw.map((o) => ({
    id: o.id,
    type: o.type,
    description: o.description,
    room: resolveRoom(regions, o.x, o.y),
  }));

  const graphRegions = buildRegions(regions, rawEdges);
  return { nodes, regions: graphRegions, obstacles };
}

function resolveRoom(regions: RegionShape[], x: number, y: number): string {
  for (const region of regions) {
    if (regionContains(region, x, y)) return region.name;
  }
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

  const result: GraphRegion[] = [];
  for (const [name, set] of neighbors) {
    result.push({ name, neighbors: Array.from(set) });
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
