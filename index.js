/*
 * Punto d'ingresso per i docker di dipartimento.
 *
 * Gocker avvia `node-22 <sito> index.js` e pretende che lo script stia nella
 * radice di /home/web/<sito>/html/. Il server compilato sta sotto `server/dist`:
 * questo file e' il raccordo fra le due cose e non contiene l'applicazione.
 *
 * Qui sta anche la configurazione dell'installazione di dipartimento: gocker non
 * deve dipendere da un file .env separato per trovare Mongo, il navigator e la
 * porta pubblicata. In locale queste variabili arrivano invece da Compose.
 *
 * ARTAROUND_ROOT rende indipendenti dalla posizione del compilato i percorsi dei
 * file che restano nell'albero del progetto: immagini, mappe, client e sorgenti.
 * In sviluppo `npm run dev` esegue invece i TypeScript direttamente con ts-node.
 */
const mongoCredentials = {
  user: "site252627",
  pwd: "eiGhuo4e",
  site: "mongo_site252627",
};

process.env.ARTAROUND_ROOT = __dirname;
process.env.PORT ||= "8000";
process.env.MONGO_URI ||=
  `mongodb://${mongoCredentials.user}:${mongoCredentials.pwd}` +
  `@${mongoCredentials.site}:27017/${mongoCredentials.user}?authSource=admin`;
process.env.NAVIGATOR_ORIGIN ||= "https://site252627.tw.cs.unibo.it/navigator";

console.log("Configurazione caricata da index.js");

require("./server/dist/server/src/index.js");
