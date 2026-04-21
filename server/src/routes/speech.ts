import { Router } from "express";
import multer from "multer";
import { recognizeAudio } from "../services/speech";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.single("audioFile"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No audio file provided" });
    console.log("received file of size: ", file.size);
    const transcript = await recognizeAudio(req.file.buffer);
    console.log(transcript);
    res.json({ transcript });
  } catch (err) {
    res.status(500).json({ error: "Server error processing audio" });
  }
});

export default router;
