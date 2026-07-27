/**
 * Rotte della voce: riconoscimento e sintesi.
 *
 * Il riconoscimento passa poi dall'LLM, che mappa la frase libera su un comando
 * del vocabolario controllato. Se non si e' capito nulla si risponde comunque, con
 * un comando vuoto: il client dira' "non ho capito" invece di restare in attesa.
 */
import { Router } from "express";
import multer from "multer";
import { recognizeAudio } from "../services/stt";
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
    const sttLang = (req.body?.lang as string) || "it-IT";
    const transcript = await recognizeAudio(file.buffer, sttLang);
    if (!transcript) return res.json({ mappedTranscript: "" });
    const mappedTranscript = await mapRequest(transcript);
    res.json({ mappedTranscript });
  } catch (err) {
    res.status(500).json({ error: "Server error processing audio" });
  }
});

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
