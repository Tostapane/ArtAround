/**
 * Punto d'ingresso del server.
 *
 * Monta le rotte sotto /api, serve staticamente il marketplace (la radice) e i
 * file pubblici (mappe SVG e immagini delle opere), e si collega a MongoDB
 * riprovando finche' non risponde: in docker il database parte insieme a noi.
 *
 * La porta arriva dall'ambiente perche' sul server del dipartimento non e' detto
 * sia la 8000, e perche' cosi' si possono tenere due istanze accese insieme.
 */
import "./env";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import cors from "cors";
import QRCode from "qrcode";

import artworkRoutes from "./routes/artworks";
import visitsRoutes from "./routes/visits";
import speechRoutes from "./routes/speech";
import llmRoutes from "./routes/llm";
import itemRoutes from "./routes/items";
import museumRoutes from "./routes/museums";
import userRoutes from "./routes/users";
import translateRoutes from "./routes/translate";
import wayfindingRoutes from "./routes/wayfinding";
import guidedSessionRoutes from "./routes/guidedSessions";

const app = express();
const PORT = Number(process.env.PORT) || 8000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));
app.use(express.static(path.join(__dirname, "../../marketplace/public")));
app.use(
  "/dist",
  express.static(path.join(__dirname, "../../marketplace/dist")),
);

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";

const connectWithRetry = () => {
  console.log("Attempting to connect to MongoDB...");
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("Successful MongoDB connection"))
    .catch((err) => {
      console.error("MongoDB connection error, retrying in 5 seconds...", err);
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

app.use("/api/artworks", artworkRoutes);
app.use("/api/visits", visitsRoutes);
app.use("/api/speech", speechRoutes);
app.use("/api/llm", llmRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/museums", museumRoutes);
app.use("/api/users", userRoutes);
app.use("/api/translate", translateRoutes);
app.use("/api/wayfinding", wayfindingRoutes);
app.use("/api/guided-sessions", guidedSessionRoutes);
app.get("/api/health", (req, res) => {
  res.json({
    message: "Unified Backend running",
    node_version: process.version,
  });
});

/**
 * GET /api/config
 * Configurazione d'ambiente per i client. Serve a togliere host e porte
 * scritti a mano dal codice del marketplace (prelude.md §6 C5): il navigator
 * gira su un'altra origine e solo il server sa quale.
 * In deploy si imposta NAVIGATOR_ORIGIN; in sviluppo si ricava dall'host della
 * richiesta con la porta di Vite.
 */
app.get("/api/qr", async (req, res) => {
  try {
    const text = String(req.query.text || "");
    if (!text) return res.status(400).json({ error: "Parametro 'text' richiesto" });
    const svg = await QRCode.toString(text, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
    });
    res.type("image/svg+xml").set("Cache-Control", "no-store").send(svg);
  } catch {
    res.status(500).json({ error: "Errore nella generazione del QR" });
  }
});

app.get("/api/config", (req, res) => {
  let navigatorOrigin = process.env.NAVIGATOR_ORIGIN;
  if (!navigatorOrigin) {
    const host = String(req.hostname || "localhost");
    const protocol = req.protocol || "http";
    navigatorOrigin = `${protocol}://${host}:5173`;
  }
  res.json({ navigatorOrigin });
});

app.listen(PORT, () => {
  console.log(`-------------------------------------------`);
  console.log(`  ArtAround Unified Backend on port ${PORT} `);
  console.log(`-------------------------------------------`);
});
