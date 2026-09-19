/**
 * Rielabora il testo di un'opera direttamente nella lingua richiesta, evitando una
 * seconda perdita dovuta alla traduzione automatica.
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
