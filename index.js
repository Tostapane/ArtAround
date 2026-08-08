/*
 * Punto d'ingresso per i docker di dipartimento.
 *
 * Gocker avvia `nodemon-22 <sito> index.js` e pretende che lo script stia nella
 * radice di /home/web/<sito>/html/. Il server pero' e' TypeScript e in locale si
 * avvia con `ts-node src/index.ts`: questo file e' il raccordo fra le due cose e
 * non contiene nient'altro.
 *
 * `ts-node` si carica per percorso ESPLICITO perche' sta in server/node_modules:
 * la risoluzione di `require` parte dalla cartella di QUESTO file, dove non c'e'
 * nessun node_modules, e un `require("ts-node")` nudo non lo troverebbe.
 * Registrato una volta, il gancio vale per tutto il processo, quindi la riga
 * dopo puo' chiedere direttamente un `.ts`.
 *
 * In locale non serve a nessuno: `npm start` dentro server/ resta la strada di
 * sviluppo. Questo file esiste per la macchina del laboratorio.
 */
const path = require("path");

require(path.join(__dirname, "server", "node_modules", "ts-node")).register({
  project: path.join(__dirname, "server", "tsconfig.json"),
});

require("./server/src/index.ts");
