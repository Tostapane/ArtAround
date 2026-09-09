/**
 * Carica server/.env e risolve le radici di runtime. Le variabili del processo
 * prevalgono perche' in deploy arrivano dal launcher compilato; il percorso dedotto
 * resta il ripiego degli script ts-node.
 */
import dotenv from "dotenv";
import path from "path";

export const PROJECT_ROOT =
  process.env.ARTAROUND_ROOT || path.resolve(__dirname, "../..");
export const SERVER_ROOT = path.join(PROJECT_ROOT, "server");

dotenv.config({
  path: path.join(SERVER_ROOT, ".env"),
  quiet: true,
});

export const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";
