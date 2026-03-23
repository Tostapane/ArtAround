import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 8000;

const MONGO_URI =
  "mongodb://localuser:localpassword@mongodb:27017/artaround?authSource=admin";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("SUccessful MongoDB"))
  .catch((err) => console.error("MongoDB error", err));

app.get("/", (req, res) => {
  res.json({ message: "Backend running", node_version: process.version });
});
app.listen(PORT, () => {
  console.log(`server is listening on ${PORT}`);
});
