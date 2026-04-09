import { Router } from "express";
import { additionalDescription } from "../services/llm";

const router = Router();

router.post("/addInfo", async (req, res) => {
  try {
    const { previous, userReq } = req.body;
    const newDescr = additionalDescription(previous, userReq);
    res.json({ newDescr });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate description" });
  }
});

export default router;
