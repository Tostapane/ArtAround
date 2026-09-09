/**
 * Carica le variabili d'ambiente da server/.env e stabilisce le radici dei file
 * usati a runtime.
 *
 * Le variabili gia' presenti nel processo vincono sul file. In produzione le
 * imposta il launcher nella radice, mentre Compose fa lo stesso in locale; il
 * file resta utile a chi esegue direttamente i TypeScript con ts-node.
 *
 * `quiet` spegne la riga che la libreria stamperebbe a ogni avvio: i registri del
 * server sono quelli che si leggono in laboratorio quando qualcosa non va, e una
 * nota pubblicitaria in mezzo non aiuta nessuno.
 *
 * Il launcher di produzione passa la radice del progetto perche' il Javascript
 * compilato si trova piu' in profondita' dei sorgenti. In sviluppo il ripiego si
 * ricava dalla posizione di questo file. Un `.env` che non c'e' non ferma niente,
 * ed e' voluto: gli script vanno lanciati anche da chi non l'ha. Il prezzo e' che
 * l'assenza delle chiavi di Google non si scopre all'avvio ma alla prima rotta che
 * le usa.
 *
 * MONGO_URI sta qui perche' era ricopiato identico in quattro punti d'ingresso
 * (server, seed, seedUsers, testers): un indirizzo scritto quattro volte e' un
 * indirizzo che prima o poi ne diventa due diversi. In docker la variabile
 * d'ambiente c'e'; il ripiego serve a chi lancia gli script a mano sull'host, e
 * punta a `localhost` invece che al nome del servizio nella rete di docker.
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
