/*
 * Launcher gocker per il seed compilato dei musei. Ancora asset e configurazione
 * alla root del progetto e, senza argomenti espliciti, prepara tutti i musei.
 */

process.env.ARTAROUND_ROOT = __dirname;

if (process.argv.length === 2) process.argv.push("tutti");

require("./server/dist/server/src/scripts/seed.js");
