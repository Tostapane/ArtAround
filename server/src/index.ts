import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import cors from "cors";

// Routes
import artworkRoutes from "./routes/artworks";
import opereRoutes from "./routes/opere";
import llmRoutes from "./routes/llm";
import itemRoutes from "./routes/items";
dotenv.config();

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));
// Servire i file statici del marketplace
// Root: serve la cartella public del marketplace
app.use(express.static(path.join(__dirname, "../../marketplace/public")));
// /dist: serve la cartella dist del marketplace (dove si trovano gli script compilati)
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

// API Routes
app.use("/api/artworks", artworkRoutes);
app.use("/api/opere", opereRoutes);
app.use("/api/llm", llmRoutes);
app.use("/api/items", itemRoutes);
app.get("/api/health", (req, res) => {
  res.json({
    message: "Unified Backend running",
    node_version: process.version,
  });
});

app.listen(PORT, () => {
  console.log(`-------------------------------------------`);
  console.log(`  ArtAround Unified Backend on port ${PORT} `);
  console.log(`-------------------------------------------`);
});
