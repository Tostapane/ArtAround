/**
 * Rotte per riconoscimento e sintesi. Distingue un comando vuoto da un guasto del
 * modello, affinche' il client non chieda di ripetere durante un 503.
 */
import { Router } from "express";
import multer from "multer";
import { recognizeAudio } from "../services/stt";
import { synthesizeSpeech } from "../services/tts";
import { mapRequest } from "../services/llm";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/speech (multipart, campo `audioFile`)
 * Ritorna: { mappedTranscript }, vuoto se non riconosce un comando; 503 se il modello non risponde.
 */
router.post("/", upload.single("audioFile"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No audio file provided" });
    const sttLang = (req.body?.lang as string) || "it-IT";
    const transcript = await recognizeAudio(file.buffer, sttLang);
    if (!transcript) return res.json({ mappedTranscript: "" });
    const mappedTranscript = await mapRequest(transcript);
    if (mappedTranscript === null) {
      return res.status(503).json({
        error: "Il servizio che interpreta i comandi vocali non risponde",
      });
    }
    res.json({ mappedTranscript });
  } catch (err) {
    res.status(500).json({ error: "Server error processing audio" });
  }
});

/**
 * POST /api/speech/tts  { text, lang }
 * Ritorna: l'audio MP3 della frase.
 */
router.post("/tts", async (req, res) => {
  try {
    const { text, lang } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });
    const audio = await synthesizeSpeech(text, lang || "it-IT");
    res.set("Content-Type", "audio/mpeg").send(audio);
  } catch (err) {
    console.error("[BACKEND ERROR] Errore sintesi vocale (TTS):", err);
    res.status(500).json({ error: "Server error synthesizing speech" });
  }
});

export default router;
