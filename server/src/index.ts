import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 8000;

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@mongodb:27017/artaround?authSource=admin";

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

app.get("/", (req, res) => {
  res.json({ message: "Backend running", node_version: process.version });
});
app.listen(PORT, () => {
  console.log(`server is listening on ${PORT}`);
});
