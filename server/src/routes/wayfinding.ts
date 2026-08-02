/**
 * Rotta delle indicazioni di orientamento.
 *
 * Due livelli di risposta. Quella predefinita e' SEMPLICE: il nome della sala,
 * preso dalla mappa, senza scomodare l'LLM. Su richiesta si passa al percorso
 * passo-passo, dove il grafo garantisce la correttezza e l'LLM si limita a dirlo
 * in parole.
 *
 * IL TITOLO DELL'OPERA LO SA IL DATABASE, non la mappa: sul disegno un nodo-opera
 * porta il qid, e senza cercarne il nome qui le indicazioni parlate finivano per
 * dire «la destinazione Q248101». Si cerca solo sulla strada dettagliata, che e'
 * l'unica che usa quel nome — la risposta semplice dice la sala, non l'opera.
 */
import { Router } from "express";
import { MuseumModel } from "../models/museum";
import { ArtworkModel } from "../models/artwork";
import { getMuseumGraph } from "../services/svgGraph";
import { computeDirections } from "../services/wayfinding";
import { directionsFromRoute } from "../services/llm";

const router = Router();

/**
 * POST /api/wayfinding
 * body: { museumQid, from, target, language, detailed }
 *  - museumQid: qid del museo (per risalire alla mappa SVG)
 *  - from:      qid dell'opera presso cui si trova l'utente
 *  - target:    tipo di POI ("toilet"|"exit"|"bar"|"shop"|...),
 *               "obstacles", oppure il qid di un'altra opera
 *  - language:  nome della lingua in cui rispondere (es. "English")
 *  - detailed:  se true (o per gli ostacoli) restituisce il percorso passo-passo
 *               verbalizzato dall'LLM; altrimenti (default) la risposta "semplice"
 *
 * Due livelli di risposta:
 *  - SEMPLICE (default): comunica solo in quale ZONA si trova la destinazione,
 *    cioe' il nome della sala (data-room) authorata nell'SVG che la contiene
 *    (es. "Ala Nord"). Nessun LLM: e' un valore statico della mappa. Il piano
 *    compare solo se e' un ALTRO piano — dirlo quando non cambia sarebbe rumore,
 *    e in un museo a un piano solo non compare mai.
 *  - DETTAGLIATA (detailed=true, oppure target="obstacles"): calcola il percorso
 *    sul grafo e lo verbalizza con l'LLM (sistema completo, non rimosso).
 */
router.post("/", async (req, res) => {
  try {
    const { museumQid, from, target, language, detailed } = req.body;
    if (!museumQid || !target) {
      return res.status(400).json({ error: "museumQid e target sono richiesti" });
    }

    const museum = await MuseumModel.findOne({ qid: museumQid });
    if (!museum) return res.status(404).json({ error: "Museo non trovato" });

    const graph = getMuseumGraph(museum.mapPath);
    const route = computeDirections(graph, from, target);

    if (!detailed && target !== "obstacles") {
      let directions = "Zona non disponibile.";
      if (route.kind === "route" && route.to.room) {
        directions = route.to.room;
        if (route.to.floor !== route.from.floor) {
          directions = `${route.to.room} (${route.to.floorLabel})`;
        }
      }
      return res.json({ directions });
    }

    if (route.to.qid) {
      const opera = await ArtworkModel.findOne({ qid: route.to.qid });
      if (opera && opera.name) route.to.label = opera.name;
    }

    const directions = await directionsFromRoute(route, language);
    res.json({ directions });
  } catch (err: any) {
    console.error("[wayfinding] errore", err);
    res.status(500).json({ error: "Errore nel calcolo delle indicazioni" });
  }
});

export default router;
