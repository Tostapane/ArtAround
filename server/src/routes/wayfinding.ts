/**
 * Espone l'orientamento ricavato dal grafo della pianta. La risposta breve usa sala
 * e piano; quella dettagliata affida all'LLM soltanto la verbalizzazione.
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
 * `from` e' un'opera o l'ingresso; `target` e' POI, ostacoli o un'opera. Ritorna sala o percorso
 * verbalizzato se `detailed`.
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
