/// <reference path="./types/dotenv.d.ts" />
/**
 * Carica le variabili d'ambiente da server/.env.
 *
 * Il riferimento in cima non e' un commento: ts-node, a differenza di tsc, non
 * carica i .d.ts ambientali elencati in tsconfig `include`, e senza quella riga
 * il server non parte da quando `strict` e' acceso (dotenv 8 non porta i tipi).
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
