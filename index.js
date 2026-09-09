/*
 * Punto d'ingresso per i docker di dipartimento.
 *
 * Gocker avvia `node-22 <sito> index.js` e pretende che lo script stia nella
 * radice di /home/web/<sito>/html/. Il server compilato sta sotto `server/dist`:
 * questo file e' il raccordo fra le due cose e non contiene l'applicazione.
 *
 * ARTAROUND_ROOT rende indipendenti dalla posizione del compilato i percorsi dei
 * file che restano nell'albero del progetto: immagini, mappe, client e sorgenti.
 * In sviluppo `npm run dev` esegue invece i TypeScript direttamente con ts-node.
 */
process.env.ARTAROUND_ROOT = __dirname;
require("./server/dist/server/src/index.js");
