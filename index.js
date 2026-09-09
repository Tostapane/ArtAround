/*
 * Raccordo per gocker: imposta i valori predefiniti del dipartimento e avvia il
 * server compilato. ARTAROUND_ROOT ancora gli asset all'albero del progetto;
 * eventuali variabili gia' fornite dall'ambiente hanno precedenza.
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
