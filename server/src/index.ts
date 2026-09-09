/**
 * Avvia Express, collega Mongo e monta API, file pubblici, navigator, cataloghi e
 * sorgenti. I file reali precedono il fallback delle sole rotte marketplace, cosi'
 * un asset mancante resta 404.
 */
import { MONGO_URI, PROJECT_ROOT, SERVER_ROOT } from "./env";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import cors from "cors";
import compression from "compression";

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
import {
  marketplaceViews,
  marketplaceLegacyViews,
} from "../../shared/constants";

const app = express();
const PORT = Number(process.env.PORT) || 8000;

app.use(cors());
app.use(compression());
app.use(express.json());

app.use("/api", resolveSession);

app.use(
  "/images",
  express.static(path.join(SERVER_ROOT, "public/images"), {
    maxAge: "30d",
    immutable: true,
  }),
);
app.use(express.static(path.join(SERVER_ROOT, "public")));
app.use(express.static(path.join(PROJECT_ROOT, "marketplace/public")));
app.use(
  "/dist",
  express.static(path.join(PROJECT_ROOT, "marketplace/dist")),
);
app.use(
  "/navigator",
  express.static(path.join(PROJECT_ROOT, "navigator/dist")),
);
app.use("/i18n", express.static(path.join(PROJECT_ROOT, "shared/i18n")));

const sourcesDir = path.join(PROJECT_ROOT, "sources");
app.use("/sources", (req, res, next) => {
  const abs = path.join(sourcesDir, req.path);
  if (path.relative(sourcesDir, abs).startsWith("..")) return res.sendStatus(400);
  try {
    if (!fs.statSync(abs).isDirectory()) return next();
  } catch {
    return next();
  }
  res.type("html").send(
    fs
      .readdirSync(abs)
      .sort()
      .map((n) => `<a href="${path.posix.join(req.baseUrl, req.path, n)}">${n}</a>`)
      .join("<br>"),
  );
});
app.use("/sources", express.static(sourcesDir, { dotfiles: "deny" }));

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

function readThresholdArtworks(): string[] {
  try {
    const file = path.join(SERVER_ROOT, "src/data/soglia.json");
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(parsed.opere)) return [];
    return parsed.opere.filter((qid: unknown) => typeof qid === "string");
  } catch {
    return [];
  }
}

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

app.get("/api/config", async (req, res) => {
  let navigatorOrigin = process.env.NAVIGATOR_ORIGIN;
  if (!navigatorOrigin) {
    const host = String(req.hostname || "localhost");
    const protocol = req.protocol || "http";
    navigatorOrigin = `${protocol}://${host}:5173`;
  }
  res.json({ navigatorOrigin, thresholdArtworks: await thresholdFigures() });
});

const schermateMarketplace = new Set<string>([
  ...marketplaceViews,
  ...marketplaceLegacyViews,
]);
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const testa = req.path.split("/")[1] || "";
  if (!schermateMarketplace.has(testa)) return next();
  res.sendFile(
    path.join(PROJECT_ROOT, "marketplace/public/index.html"),
  );
});

const server = app.listen(PORT, () => {
  console.log(`-------------------------------------------`);
  console.log(`  ArtAround Unified Backend on port ${PORT} `);
  console.log(`-------------------------------------------`);
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
