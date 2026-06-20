import { Router } from "express";
import { translateTexts } from "../services/translate";

const router = Router();

/**
 * POST /api/translate
 * Body: { texts: string[], target: string }
 * Ritorna { translations: string[] } con i testi tradotti nella lingua target.
 */
router.post("/", async (req, res) => {
  try {
    const { texts, target } = req.body;
    if (!Array.isArray(texts) || typeof target !== "string") {
      return res.status(400).json({ error: "Invalid payload" });
    }
    const translations = await translateTexts(texts, target);
    res.json({ translations });
  } catch (err) {
    console.error("[BACKEND ERROR] Errore traduzione:", err);
    res.status(500).json({ error: "Server error translating text" });
  }
});

export default router;
