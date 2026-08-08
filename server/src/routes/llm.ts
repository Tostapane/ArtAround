/**
 * Rotta di rielaborazione del testo di un'opera.
 *
 * La risposta viene generata direttamente nella lingua chiesta, non tradotta dopo:
 * una traduzione automatica di un testo gia' generato perde due volte.
 */
import { Router } from "express";
import { additionalDescription } from "../services/llm";

const router = Router();

/**
 * POST /api/llm/newInfo  { previous, userReq, language }
 * Ritorna: il testo rielaborato, gia' nella lingua chiesta.
 */
router.post("/newInfo", async (req, res) => {
  try {
    const { previous, userReq, language } = req.body;
    const newDescr = await additionalDescription(previous, userReq, language);
    res.json(newDescr);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate description" });
  }
});

export default router;
