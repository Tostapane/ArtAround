/**
 * Calcolo del percorso fra due punti del museo.
 *
 * Lavora sulle SALE, non sui singoli nodi: opere e servizi servono solo da
 * estremi, e il percorso e' la sequenza di sale da attraversare. Essendo collegate
 * da porte e passaggi, la ricerca in ampiezza basta: il cammino piu' breve e'
 * quello che attraversa meno sale.
 *
 * Restituisce una struttura intermedia, non una frase: la lingua la mette l'LLM.
 * Gli ostacoli riportati sono solo quelli nelle sale davvero attraversate.
 *
 * I PIANI non sono un caso a parte. Il vano scale e' una sala su ciascun piano e
 * le due sono collegate come due sale confinanti (`svgGraph.ts`), quindi la
 * stessa ricerca in ampiezza sale e scende senza saperlo. Quel che serve a valle
 * e' solo il piano di ogni sala attraversata: chi mette le parole dice "sali" o
 * "scendi" dove il piano CAMBIA, e in un museo a un piano solo non lo dice mai —
 * nessuna soglia da attivare, nessun museo da distinguere.
 *
 * COME SI CHIAMA un piano non lo decide il codice: la parola sta sulla mappa
 * (`data-floor-label`) e da qui passa e basta. Un museo puo' avere il Mezzanino
 * e il Piano Nobile, un altro cinque piani numerati: qualunque elenco scritto
 * qui sarebbe l'italiano di un museo solo, imposto a tutti gli altri.
 */
import { GraphNode, GraphObstacle, MuseumGraph } from "./svgGraph";

/**
 * Una sala del percorso. `floor` serve a sapere se si sale o si scende;
 * `floorLabel` e' la parola con cui il piano si nomina, e viene dalla mappa.
 */
export interface RouteStep {
  room: string;
  floor: number;
  floorLabel: string;
}

export interface RouteIR {
  kind: "route" | "obstacles" | "unavailable";
  reason: string;
  from: RouteStep;
  /**
   * `label` e' come si chiama la destinazione. Per un servizio la mappa lo sa
   * (`data-label`); per un'opera no — sul disegno un nodo-opera porta il qid, e
   * il titolo sta nel database. `qid` e' vuoto per i servizi ed e' il modo in cui
   * chi ha accesso alle opere sa che qui c'e' un nome da andare a prendere.
   */
  to: { label: string; qid: string; room: string; floor: number; floorLabel: string };
  steps: RouteStep[];
  obstacles: GraphObstacle[];
}

export function computeDirections(
  graph: MuseumGraph,
  fromQid: string,
  target: string,
): RouteIR {
  // Partenza VUOTA = l'ingresso. E' dove si e' prima di essersi mossi, ed e'
  // l'unico punto che ogni pianta dichiara comunque (`data-poi="entrance"`),
  // perche' e' li' che nasce il sistema di riferimento della localizzazione.
  // Un `from` sconosciuto resta un errore: confonderlo con "non l'ho detto"
  // farebbe rispondere dall'ingresso a chi ha indicato un punto che non c'e'.
  const fromNode = fromQid
    ? graph.nodes.find((n) => n.id === fromQid)
    : graph.nodes.find((n) => n.poiType === "entrance");
  if (!fromNode) {
    return unavailable("posizione corrente sconosciuta");
  }

  const qui: RouteStep = {
    room: fromNode.room,
    floor: fromNode.floor,
    floorLabel: etichettaPiano(graph, fromNode.floor),
  };

  if (target === "obstacles") {
    const here = graph.obstacles.filter((o) => o.room === fromNode.room);
    return {
      kind: "obstacles",
      reason: "",
      from: qui,
      to: { label: "", qid: "", room: "", floor: qui.floor, floorLabel: qui.floorLabel },
      steps: [],
      obstacles: here,
    };
  }

  if (!fromNode.room) {
    return unavailable("posizione corrente fuori da ogni sala");
  }

  const adj = buildAdjacency(graph);
  const { dist, prev } = bfs(adj, fromNode.room);

  let targetNode: GraphNode | null = null;
  const poiCandidates = graph.nodes.filter((n) => n.poiType === target);
  if (poiCandidates.length > 0) {
    let best = Infinity;
    for (const c of poiCandidates) {
      const d = dist.get(c.room);
      if (d !== undefined && d < best) {
        best = d;
        targetNode = c;
      }
    }
  } else {
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

  const path = reconstructPath(prev, fromNode.room, targetNode.room);
  const piani = new Map<string, number>();
  for (const r of graph.regions) piani.set(r.name, r.floor);

  const steps: RouteStep[] = [];
  for (const room of path.slice(1)) {
    let floor = piani.get(room);
    if (floor === undefined) floor = fromNode.floor;
    steps.push({ room, floor, floorLabel: etichettaPiano(graph, floor) });
  }

  const traversedRooms = new Set(path);
  const obstacles = graph.obstacles.filter((o) => traversedRooms.has(o.room));

  return {
    kind: "route",
    reason: "",
    from: qui,
    to: {
      label: targetNode.label,
      qid: targetNode.qid,
      room: targetNode.room,
      floor: targetNode.floor,
      floorLabel: etichettaPiano(graph, targetNode.floor),
    },
    steps,
    obstacles,
  };
}

function etichettaPiano(graph: MuseumGraph, floor: number): string {
  for (const f of graph.floors) {
    if (f.floor === floor) return f.label;
  }
  return `piano ${floor}`;
}

function unavailable(reason: string): RouteIR {
  return {
    kind: "unavailable",
    reason,
    from: { room: "", floor: 0, floorLabel: "" },
    to: { label: "", qid: "", room: "", floor: 0, floorLabel: "" },
    steps: [],
    obstacles: [],
  };
}

function buildAdjacency(graph: MuseumGraph): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const r of graph.regions) adj.set(r.name, r.neighbors);
  return adj;
}

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
