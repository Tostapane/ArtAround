import { Router } from "express";
import multer from "multer";
import { recognizeAudio } from "../services/speech";
import { synthesizeSpeech } from "../services/tts";
import { mapRequest } from "../services/llm";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /app/speech
 * ritorna la trascrizione dell'audio fornito dal frontend
 */
router.post("/", upload.single("audioFile"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No audio file provided" });
    console.log(`received file of ${file.size} bytes`);
    const transcript = await recognizeAudio(req.file.buffer);
    console.log(transcript);
    const mappedTranscript = await mapRequest(transcript);
    res.json({ mappedTranscript });
  } catch (err) {
    res.status(500).json({ error: "Server error processing audio" });
  }
});

/**
 * POST /api/speech/tts
 * ritorna l'audio (MP3) della sintesi vocale del testo fornito
 */
router.post("/tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });
    const audio = await synthesizeSpeech(text);
    res.set("Content-Type", "audio/mpeg").send(audio);
  } catch (err) {
    console.error("[BACKEND ERROR] Errore sintesi vocale (TTS):", err);
    res.status(500).json({ error: "Server error synthesizing speech" });
  }
});

export default router;
