/// <reference path="./types/dotenv.d.ts" />
/**
 * Carica le variabili d'ambiente da server/.env.
 *
 * Il riferimento in cima non e' un commento: ts-node, a differenza di tsc, non
 * carica i .d.ts ambientali elencati in tsconfig `include`, e senza quella riga
 * il server non parte da quando `strict` e' acceso (dotenv 8 non porta i tipi).
 *
 * MONGO_URI sta qui perche' era ricopiato identico in quattro punti d'ingresso
 * (server, seed, seedUsers, testers): un indirizzo scritto quattro volte e' un
 * indirizzo che prima o poi ne diventa due diversi. In docker la variabile
 * d'ambiente c'e'; il ripiego serve a chi lancia gli script a mano sull'host.
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";
