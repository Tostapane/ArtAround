/// <reference path="./types/dotenv.d.ts" />
// Il riferimento esplicito serve a ts-node: a differenza di `tsc`, non carica i
// .d.ts ambientali elencati in tsconfig `include`, quindi senza questa riga il
// server non parte più da quando `strict` è acceso (dotenv 8 non porta i tipi).
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
