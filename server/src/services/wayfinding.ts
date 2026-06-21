import { GraphNode, GraphObstacle, MuseumGraph } from "./svgGraph";

/*
 * Pathfinding sul grafo del museo (ricavato dalla mappa SVG).
 *
 * Produce una rappresentazione intermedia (RouteIR) deterministica: sequenza di
 * sale da attraversare e ostacoli. La fraseologia in linguaggio naturale e'
 * delegata all'LLM (services/llm.ts): qui garantiamo SOLO la correttezza del percorso.
 */

export interface RouteIR {
  kind: "route" | "obstacles" | "unavailable";
  reason: string; // valorizzato quando kind === "unavailable"
  from: { room: string };
  to: { label: string; room: string };
  steps: string[]; // sale da attraversare, in ordine (esclusa quella di partenza)
  obstacles: GraphObstacle[];
}

// calcola le indicazioni dalla posizione `fromQid` (qid dell'opera corrente)
// verso `target`: un tipo di POI ("toilet"|"exit"|"bar"|"shop"|...), la stringa
// "obstacles" (ostacoli nelle vicinanze), oppure il qid di un'altra opera.
export function computeDirections(
  graph: MuseumGraph,
  fromQid: string,
  target: string,
): RouteIR {
  const fromNode = graph.nodes.find((n) => n.id === fromQid);
  if (!fromNode) {
    return unavailable("posizione corrente sconosciuta");
  }

  if (target === "obstacles") {
    const here = graph.obstacles.filter((o) => o.room === fromNode.room);
    return {
      kind: "obstacles",
      reason: "",
      from: { room: fromNode.room },
      to: { label: "", room: "" },
      steps: [],
      obstacles: here,
    };
  }

  const { dist, prev } = dijkstra(graph, fromNode.id);

  // risoluzione del nodo di destinazione
  let targetNode: GraphNode | null = null;
  const poiCandidates = graph.nodes.filter((n) => n.poiType === target);
  if (poiCandidates.length > 0) {
    // POI piu' vicino del tipo richiesto
    let best = Infinity;
    for (const c of poiCandidates) {
      const d = dist.get(c.id);
      if (d !== undefined && d < best) {
        best = d;
        targetNode = c;
      }
    }
  } else {
    // altrimenti `target` e' il qid di un'opera
    const byId = graph.nodes.find((n) => n.id === target);
    if (byId) targetNode = byId;
  }

  if (!targetNode) {
    return unavailable("destinazione non presente sulla mappa");
  }

  const reachable = dist.get(targetNode.id);
  if (reachable === undefined || reachable === Infinity) {
    return unavailable("destinazione non raggiungibile");
  }

  const path = reconstructPath(prev, fromNode.id, targetNode.id, graph);
  const steps = buildSteps(path);
  // ostacoli "sul percorso": quelli nelle sale effettivamente attraversate
  // (se il cammino evita una sala, i suoi ostacoli non si incontrano).
  const traversedRooms = new Set(path.map((n) => n.room));
  const obstacles = graph.obstacles.filter((o) => traversedRooms.has(o.room));

  return {
    kind: "route",
    reason: "",
    from: { room: fromNode.room },
    to: {
      label: targetNode.label,
      room: targetNode.room,
    },
    steps,
    obstacles,
  };
}

function unavailable(reason: string): RouteIR {
  return {
    kind: "unavailable",
    reason,
    from: { room: "" },
    to: { label: "", room: "" },
    steps: [],
    obstacles: [],
  };
}

// Dijkstra a pesi euclidei: ritorna distanze e predecessori da `sourceId`.
function dijkstra(
  graph: MuseumGraph,
  sourceId: string,
): { dist: Map<string, number>; prev: Map<string, string | null> } {
  const adj = buildAdjacency(graph);
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const n of graph.nodes) {
    dist.set(n.id, Infinity);
    prev.set(n.id, null);
  }
  dist.set(sourceId, 0);

  while (visited.size < graph.nodes.length) {
    let u: string | null = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d;
        u = id;
      }
    }
    if (u === null) break;
    visited.add(u);

    const neighbors = adj.get(u);
    if (!neighbors) continue;
    const du = dist.get(u);
    if (du === undefined) continue;
    for (const edge of neighbors) {
      if (visited.has(edge.to)) continue;
      const nd = du + edge.w;
      const old = dist.get(edge.to);
      if (old === undefined || nd < old) {
        dist.set(edge.to, nd);
        prev.set(edge.to, u);
      }
    }
  }
  return { dist, prev };
}

function buildAdjacency(
  graph: MuseumGraph,
): Map<string, { to: string; w: number }[]> {
  const pos = new Map<string, GraphNode>();
  for (const n of graph.nodes) pos.set(n.id, n);

  const adj = new Map<string, { to: string; w: number }[]>();
  for (const n of graph.nodes) adj.set(n.id, []);

  for (const e of graph.edges) {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) continue;
    const w = Math.hypot(a.x - b.x, a.y - b.y);
    adj.get(e.from)!.push({ to: e.to, w });
    adj.get(e.to)!.push({ to: e.from, w });
  }
  return adj;
}

function reconstructPath(
  prev: Map<string, string | null>,
  sourceId: string,
  targetId: string,
  graph: MuseumGraph,
): GraphNode[] {
  const byId = new Map<string, GraphNode>();
  for (const n of graph.nodes) byId.set(n.id, n);

  const ids: string[] = [];
  let cur: string | null = targetId;
  while (cur !== null) {
    ids.push(cur);
    if (cur === sourceId) break;
    const p = prev.get(cur);
    if (p === undefined) break;
    cur = p;
  }
  ids.reverse();

  const path: GraphNode[] = [];
  for (const id of ids) {
    const n = byId.get(id);
    if (n) path.push(n);
  }
  return path;
}

// le sale da attraversare, in ordine, senza ripetizioni consecutive e senza
// quella di partenza (gia' in `from.room`). I POI senza sala ricadono sull'etichetta.
function buildSteps(path: GraphNode[]): string[] {
  const rooms: string[] = [];
  for (const n of path) {
    let loc = n.room;
    if (!loc) loc = n.label;
    if (rooms.length === 0 || rooms[rooms.length - 1] !== loc) rooms.push(loc);
  }
  rooms.shift(); // la prima e' la sala di partenza
  return rooms;
}
