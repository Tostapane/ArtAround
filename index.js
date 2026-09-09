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
process.env.ARTAROUND_ROOT = __dirname;

if (__dirname === "/webapp") {
  const mongoCredentials = {
    user: "site252627",
    pwd: "eiGhuo4e",
    site: "mongo_site252627",
  };

  const deployment = {
    port: 8000,
    navigatorOrigin: "https://site252627.tw.cs.unibo.it/navigator",
  };

  process.env.PORT = String(deployment.port);
  process.env.MONGO_URI =
    `mongodb://${mongoCredentials.user}:${mongoCredentials.password}` +
    `@${mongoCredentials.host}:27017/${mongoCredentials.database}?authSource=admin`;
  process.env.NAVIGATOR_ORIGIN = deployment.navigatorOrigin;
}

require("./server/dist/server/src/index.js");
