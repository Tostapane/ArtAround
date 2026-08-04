/**
 * Punto d'ingresso del server.
 *
 * Monta le rotte sotto /api, serve staticamente il marketplace (la radice) e i
 * file pubblici (mappe SVG e immagini delle opere), e si collega a MongoDB
 * riprovando finche' non risponde: in docker il database parte insieme a noi.
 *
 * La porta arriva dall'ambiente perche' sul server del dipartimento non e' detto
 * sia la 8000, e perche' cosi' si possono tenere due istanze accese insieme.
 *
 * SI ENTRA DA UN ACCOUNT: ogni rotta sotto /api pretende una sessione, tranne
 * quattro che non possono averne una. Le prime due perche' vengono prima di
 * avere un account (`/config`, `/users/{login,register}`); le altre due perche'
 * a chiederle non e' il nostro codice ma il browser — `/qr` sta dentro un `img`
 * e il foglio `/museums/:qid/qrcodes` si apre come pagina, e a nessuna delle due
 * si puo' attaccare un'intestazione. Non e' un buco: un QR e' un indirizzo, e
 * quel foglio nasce per essere stampato e appeso al muro.
 */
import { MONGO_URI } from "./env";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import cors from "cors";
import QRCode from "qrcode";

import { resolveSession, requireSession } from "./session";
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
import { ArtworkModel } from "./models/artwork";

const app = express();
const PORT = Number(process.env.PORT) || 8000;

app.use(cors());
app.use(express.json());

// Legge il biglietto se c'e', e non rifiuta niente: a rifiutare e' requireSession,
// rotta per rotta, perche' qualcuna deve restare aperta (vedi sotto).
app.use("/api", resolveSession);

app.use(express.static(path.join(__dirname, "../public")));
app.use(express.static(path.join(__dirname, "../../marketplace/public")));
app.use(
  "/dist",
  express.static(path.join(__dirname, "../../marketplace/dist")),
);
// In sviluppo il navigator ha un server suo (Vite, porta 5173); in deploy quel
// server non c'e' — il dipartimento pubblica UNA sola porta per sito — quindi il
// navigator e' un mucchio di file statici serviti da qui, sotto /navigator.
// La cartella e' il prodotto di `npm run build`, che va rifatto a ogni modifica.
app.use(
  "/navigator",
  express.static(path.join(__dirname, "../../navigator/dist")),
);

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

// Si entra da qui e basta: `museums` e `users` sono le due miste (il foglio dei
// QR e l'accesso restano aperti), e la guardia sta dentro, rotta per rotta.
app.use("/api/artworks", requireSession, artworkRoutes);
app.use("/api/visits", requireSession, visitsRoutes);
app.use("/api/speech", requireSession, speechRoutes);
app.use("/api/llm", requireSession, llmRoutes);
app.use("/api/items", requireSession, itemRoutes);
app.use("/api/museums", museumRoutes);
app.use("/api/users", userRoutes);
app.use("/api/translate", requireSession, translateRoutes);
app.use("/api/wayfinding", requireSession, wayfindingRoutes);
app.use("/api/guided-sessions", requireSession, guidedSessionRoutes);
app.get("/api/health", (req, res) => {
  res.json({
    message: "Unified Backend running",
    node_version: process.version,
  });
});

/**
 * Le opere che la soglia compone. Si rilegge a ogni richiesta e non a
 * import-time: cambiare quella scelta non deve richiedere di riavviare il server.
 * Se il file manca o e' rotto si torna una lista vuota, e il client ripiega
 * sulle prime opere del catalogo.
 */
function readThresholdArtworks(): string[] {
  try {
    const file = path.join(__dirname, "data", "soglia.json");
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(parsed.opere)) return [];
    return parsed.opere.filter((qid: unknown) => typeof qid === "string");
  } catch {
    return [];
  }
}

/**
 * Le opere della soglia, gia' risolte in `{qid, imagePath}`.
 *
 * Le risolve il server perche' la soglia e' la schermata di chi NON e' entrato,
 * e il catalogo ora vuole una sessione: di qui non passa nessun testo, solo il
 * nome del file di sei immagini che stanno gia' in chiaro sotto `/images`.
 * Nell'ordine scelto dal curatore, che il retino rende bene solo su certe opere
 * e questo non si calcola; se il file non dice niente si ripiega sulle prime del
 * catalogo, cosi' la soglia non resta mai vuota.
 */
async function thresholdFigures(): Promise<
  { qid: string; imagePath: string }[]
> {
  try {
    const wanted = readThresholdArtworks();
    const filter = wanted.length > 0 ? { qid: { $in: wanted } } : {};
    const found = await ArtworkModel.find({
      ...filter,
      imagePath: { $exists: true, $ne: "" },
    })
      .select("qid imagePath")
      .lean();

    const byQid = new Map(found.map((a: any) => [a.qid, a.imagePath]));
    if (wanted.length === 0)
      return found.slice(0, 6).map((a: any) => ({
        qid: a.qid,
        imagePath: a.imagePath,
      }));

    const ordered: { qid: string; imagePath: string }[] = [];
    for (const qid of wanted) {
      const imagePath = byQid.get(qid);
      if (imagePath) ordered.push({ qid, imagePath });
    }
    return ordered;
  } catch {
    return [];
  }
}

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

/**
 * GET /api/config
 * Configurazione d'ambiente per i client. Serve a togliere host e porte
 * scritti a mano dal codice del marketplace (prelude.md §6 C5): il navigator
 * gira su un'altra origine e solo il server sa quale.
 * In deploy si imposta NAVIGATOR_ORIGIN; in sviluppo si ricava dall'host della
 * richiesta con la porta di Vite.
 *
 * Porta anche le opere della soglia, gia' con la loro immagine: e' una scelta
 * del curatore (data/soglia.json), non di codice, e il marketplace non deve
 * conoscere nessun qid. Le porta QUESTA rotta e non il catalogo perche' la
 * soglia e' la schermata di chi non e' ancora entrato.
 */
app.get("/api/config", async (req, res) => {
  let navigatorOrigin = process.env.NAVIGATOR_ORIGIN;
  if (!navigatorOrigin) {
    const host = String(req.hostname || "localhost");
    const protocol = req.protocol || "http";
    navigatorOrigin = `${protocol}://${host}:5173`;
  }
  res.json({ navigatorOrigin, thresholdArtworks: await thresholdFigures() });
});

app.listen(PORT, () => {
  console.log(`-------------------------------------------`);
  console.log(`  ArtAround Unified Backend on port ${PORT} `);
  console.log(`-------------------------------------------`);
});
