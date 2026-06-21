import { Router } from "express";
import { MuseumModel } from "../models/museum";
import { getMuseumGraph } from "../services/svgGraph";
import { computeDirections } from "../services/wayfinding";
import { directionsFromRoute } from "../services/llm";

const router = Router();

/**
 * POST /api/wayfinding
 * body: { museumQid, from, target, language }
 *  - museumQid: qid del museo (per risalire alla mappa SVG)
 *  - from:      qid dell'opera presso cui si trova l'utente
 *  - target:    tipo di POI ("toilet"|"exit"|"bar"|"shop"|...),
 *               "obstacles", oppure il qid di un'altra opera
 *  - language:  nome della lingua in cui rispondere (es. "English")
 * Calcola il percorso sul grafo (derivato dalla mappa) e lo verbalizza con l'LLM.
 */
router.post("/", async (req, res) => {
  try {
    const { museumQid, from, target, language } = req.body;
    if (!museumQid || !target) {
      return res.status(400).json({ error: "museumQid e target sono richiesti" });
    }

    const museum = await MuseumModel.findOne({ qid: museumQid });
    if (!museum) return res.status(404).json({ error: "Museo non trovato" });

    const graph = getMuseumGraph(museum.mapPath);
    const route = computeDirections(graph, from, target);
    const directions = await directionsFromRoute(route, language);
    res.json({ directions });
  } catch (err: any) {
    console.error("[wayfinding] errore", err);
    res.status(500).json({ error: "Errore nel calcolo delle indicazioni" });
  }
});

export default router;
