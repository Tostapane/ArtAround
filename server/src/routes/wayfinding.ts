/**
 * Rotta delle indicazioni di orientamento.
 *
 * Due livelli di risposta. Quella predefinita e' SEMPLICE: il nome della sala,
 * preso dalla mappa, senza scomodare l'LLM. Su richiesta si passa al percorso
 * passo-passo, dove il grafo garantisce la correttezza e l'LLM si limita a dirlo
 * in parole.
 *
 * Il titolo dell'opera lo sa il database e non la mappa: sul disegno un nodo
 * opera porta il qid, quindi senza cercarne qui il nome le indicazioni parlate
 * direbbero «la destinazione Q248101». Si cerca solo sulla strada dettagliata,
 * che e' l'unica a usare quel nome: la risposta semplice dice la sala.
 *
 * Nella risposta semplice il PIANO compare solo quando la destinazione sta su un
 * altro piano: dirlo quando non cambia sarebbe rumore, e in un museo a un piano
 * solo non compare mai.
 */
import { Router } from "express";
import { MuseumModel } from "../models/museum";
import { ArtworkModel } from "../models/artwork";
import { getMuseumGraph } from "../services/svgGraph";
import { computeDirections } from "../services/wayfinding";
import { directionsFromRoute } from "../services/llm";

const router = Router();

/**
 * POST /api/wayfinding  { museumQid, from, target, language, detailed }
 * `from` e' il qid dell'opera presso cui si e' (vuoto = l'ingresso), `target` un
 * tipo di POI ("toilet", "exit", …), "obstacles", oppure il qid di un'altra opera.
 * Ritorna: { directions } — il nome della sala di destinazione, oppure, con
 * `detailed` (e sempre per gli ostacoli), il percorso passo-passo verbalizzato.
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
