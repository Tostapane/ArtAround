/**
 * Converte l'SVG annotato nel grafo del museo: sale, porte, piani, opere, servizi e
 * ostacoli. Il parser descrive il disegno senza inventare collegamenti, lasciando
 * gli errori al collaudo.
 */
import fs from "fs";
import path from "path";
import { SERVER_ROOT } from "../env";

export interface GraphNode {
  id: string;
  kind: "artwork" | "poi";
  qid: string;
  poiType: string;
  label: string;
  x: number;
  y: number;
  room: string;
  floor: number;
  elementId: string;
}

export interface GraphRegion {
  name: string;
  neighbors: string[];
  floor: number;
  flow: number;
}

export interface GraphObstacle {
  id: string;
  type: string;
  description: string;
  room: string;
}

export interface GraphFloor {
  floor: number;
  label: string;
}

export interface MuseumGraph {
  nodes: GraphNode[];
  regions: GraphRegion[];
  obstacles: GraphObstacle[];
  floors: GraphFloor[];
}

type RegionShape = { floor: number; flow: number } & (
  | { kind: "circle"; name: string; cx: number; cy: number; r: number }
  | { kind: "rect"; name: string; x: number; y: number; w: number; h: number }
  | { kind: "polygon"; name: string; pts: { x: number; y: number }[] }
);

const PUBLIC_DIR = path.join(SERVER_ROOT, "public");

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
