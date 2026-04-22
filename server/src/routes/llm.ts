import { Router } from "express";
import { additionalDescription } from "../services/llm";

const router = Router();

/**
 * POST /app/llm/newInfo
 * Richiede una nuova descrizione sulla base di quella attualmente fornita e della richiesta dell'utente
 */
router.post("/newInfo", async (req, res) => {
  try {
    const { previous, userReq } = req.body;
    const newDescr = await additionalDescription(previous, userReq);
    res.json(newDescr);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate description" });
  }
});

export default router;
