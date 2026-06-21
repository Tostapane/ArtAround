import { GraphNode, GraphObstacle, MuseumGraph } from "./svgGraph";

/*
 * Pathfinding sul grafo del museo (ricavato dalla mappa SVG).
 *
 * Il grafo navigabile e' fatto di SALE: i nodi (opere, POI) vivono dentro una
 * sala e servono solo da estremi (partenza/destinazione); il percorso e' la
 * sequenza di sale da attraversare. Le sale sono collegate da archi o porte,
 * quindi una BFS basta: il percorso piu' breve e' quello che attraversa meno sale.
 *
 * Produce una rappresentazione intermedia (RouteIR) deterministica: la
 * fraseologia in linguaggio naturale e' delegata all'LLM (services/llm.ts):
 * qui garantiamo SOLO la correttezza del percorso.
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

  if (!fromNode.room) {
    return unavailable("posizione corrente fuori da ogni sala");
  }

  const adj = buildAdjacency(graph);
  const { dist, prev } = bfs(adj, fromNode.room);

  // risoluzione della destinazione (e quindi della sua sala)
  let targetNode: GraphNode | null = null;
  const poiCandidates = graph.nodes.filter((n) => n.poiType === target);
  if (poiCandidates.length > 0) {
    // POI piu' vicino del tipo richiesto (in numero di sale da attraversare)
    let best = Infinity;
    for (const c of poiCandidates) {
      const d = dist.get(c.room);
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

  const reachable = dist.get(targetNode.room);
  if (reachable === undefined) {
    return unavailable("destinazione non raggiungibile");
  }

  // percorso = sale da attraversare; la prima e' quella di partenza.
  const path = reconstructPath(prev, fromNode.room, targetNode.room);
  const steps = path.slice(1);
  // ostacoli "sul percorso": quelli nelle sale effettivamente attraversate
  // (se il cammino evita una sala, i suoi ostacoli non si incontrano).
  const traversedRooms = new Set(path);
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

// costruisce un RouteIR di tipo "unavailable" con il motivo indicato.
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

// lista di adiacenza delle sale: nome -> nomi delle sale collegate.
function buildAdjacency(graph: MuseumGraph): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const r of graph.regions) adj.set(r.name, r.neighbors);
  return adj;
}

// BFS sulle sale: distanza (in numero di sale) e predecessore da `source`.
function bfs(
  adj: Map<string, string[]>,
  source: string,
): { dist: Map<string, number>; prev: Map<string, string | null> } {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  dist.set(source, 0);
  prev.set(source, null);

  const queue: string[] = [source];
  let head = 0;
  while (head < queue.length) {
    const u = queue[head];
    head++;
    const du = dist.get(u);
    if (du === undefined) continue;
    const neighbors = adj.get(u);
    if (!neighbors) continue;
    for (const v of neighbors) {
      if (dist.has(v)) continue;
      dist.set(v, du + 1);
      prev.set(v, u);
      queue.push(v);
    }
  }
  return { dist, prev };
}

// ricostruisce il percorso (lista di sale) da `source` a `target` risalendo prev.
function reconstructPath(
  prev: Map<string, string | null>,
  source: string,
  target: string,
): string[] {
  const rooms: string[] = [];
  let cur: string | null = target;
  while (cur !== null) {
    rooms.push(cur);
    if (cur === source) break;
    const p = prev.get(cur);
    if (p === undefined) break;
    cur = p;
  }
  rooms.reverse();
  return rooms;
}
