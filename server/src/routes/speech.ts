import { Router } from "express";
import multer from "multer";
import { recognizeAudio } from "../services/speech";
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

export default router;
