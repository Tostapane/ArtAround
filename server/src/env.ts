/**
 * Carica le variabili d'ambiente da server/.env.
 *
 * `override: true` e' la riga che conta, ed e' l'opposto di quel che dotenv fa
 * da solo: normalmente una variabile gia' presente in `process.env` non viene
 * toccata. Nel container del dipartimento `PORT` c'e' gia', e vale 8000; la riga
 * `PORT` del file veniva quindi letta e buttata via, il server restava sulla
 * porta di sviluppo e il proxy davanti rispondeva 503 a tutti, senza che nei
 * registri comparisse niente di sbagliato. Il file e' la configurazione di
 * QUESTA installazione: se lo si scrive, e' per essere ubbiditi.
 *
 * `quiet` spegne la riga che la libreria stamperebbe a ogni avvio: i registri del
 * server sono quelli che si leggono in laboratorio quando qualcosa non va, e una
 * nota pubblicitaria in mezzo non aiuta nessuno.
 *
 * Un `.env` che non c'e' non ferma niente, ed e' voluto: gli script vanno lanciati
 * anche da chi non l'ha. Il prezzo e' che l'assenza delle chiavi di Google non si
 * scopre all'avvio ma alla prima rotta che le usa.
 *
 * MONGO_URI sta qui perche' era ricopiato identico in quattro punti d'ingresso
 * (server, seed, seedUsers, testers): un indirizzo scritto quattro volte e' un
 * indirizzo che prima o poi ne diventa due diversi. In docker la variabile
 * d'ambiente c'e'; il ripiego serve a chi lancia gli script a mano sull'host, e
 * punta a `localhost` invece che al nome del servizio nella rete di docker.
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
  override: true,
  quiet: true,
});

export const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localuser:localpassword@localhost:27017/artaround?authSource=admin";
