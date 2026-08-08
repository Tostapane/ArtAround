/**
 * Rotte della voce: riconoscimento e sintesi.
 *
 * Il riconoscimento passa poi dall'LLM, che mappa la frase libera su un comando
 * del vocabolario controllato.
 *
 * Le tre risposte sono distinte apposta: un comando riconosciuto, un comando
 * vuoto quando non c'era niente da capire (200, e il client dice "non ho
 * capito"), e un **503 quando il modello non risponde**. Confonderli faceva
 * annunciare "non ho capito" durante un guasto del servizio, cioe' invitava a
 * ripetere una frase che nessuno stava ascoltando.
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
 * Ritorna: { mappedTranscript }, cioe' il comando del vocabolario su cui la
 * frase e' stata mappata, oppure la stringa vuota se non c'era niente da capire.
 * 503 quando il modello non risponde.
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
