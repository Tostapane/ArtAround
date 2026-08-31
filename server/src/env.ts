/// <reference path="./types/dotenv.d.ts" />
/**
 * Carica le variabili d'ambiente da server/.env.
 *
 * Il riferimento in cima non e' un commento: ts-node, a differenza di tsc, non
 * carica i .d.ts ambientali elencati in tsconfig `include`, e senza quella riga
 * il server non parte da quando `strict` e' acceso (dotenv 8 non porta i tipi).
 *
 * Quel che il file dice VINCE su quel che l'ambiente dice gia'. dotenv, da solo,
 * fa il contrario: una variabile gia' presente in `process.env` non la tocca. Nel
 * container del dipartimento `PORT` c'e' gia', e vale 8000; la riga `PORT` del
 * file veniva quindi letta e buttata via, il server restava sulla porta di
 * sviluppo e il proxy davanti rispondeva 503 a tutti. Il file e' la
 * configurazione di QUESTA installazione: se lo si scrive, e' per essere ubbiditi.
 *
 * MONGO_URI sta qui perche' era ricopiato identico in quattro punti d'ingresso
 * (server, seed, seedUsers, testers): un indirizzo scritto quattro volte e' un
 * indirizzo che prima o poi ne diventa due diversi. In docker la variabile
 * d'ambiente c'e'; il ripiego serve a chi lancia gli script a mano sull'host.
 */

import dotenv from "dotenv";
import path from "path";

const caricato = dotenv.config({ path: path.resolve(__dirname, "../.env") });
if (caricato.parsed) {
  for (const chiave of Object.keys(caricato.parsed)) {
    process.env[chiave] = caricato.parsed[chiave];
  }
}

export const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";
