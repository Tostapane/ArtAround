import { Router } from "express";
import multer from "multer";
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
router.post("/", upload.single("audioFile"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No audio file provided" });
    console.log("received file of size: ", file.size);
    // deve intervenire il service
  } catch (err) {
    res.status(500).json({ error: "Server error processing audio" });
  }
});

export default router;
