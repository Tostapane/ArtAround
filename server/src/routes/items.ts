import { Router } from "express";
import { ItemModel } from "../models/item";

const router = Router();

router.post("/batch", async (req, res) => {
  try {
    console.log(`[BACKEND] Chiamata POST /api/items/batch`);
    const idsArray = req.body.ids;
    const items = await ItemModel.find({ _id: { $in: idsArray } });
    res.json(items);
  } catch (error: any) {
    console.error(error);
    res
      .status(500)
      .json({ error: error.message || "Errore nel caricamento delle opere" });
  }
});

export default router;
