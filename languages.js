/*
 * Launcher gocker per lo script compilato dei cataloghi. Senza argomenti espliciti
 * traduce le chiavi mancanti di tutte le lingue configurate.
 */

process.env.ARTAROUND_ROOT = __dirname;

if (process.argv.length === 2) process.argv.push("traduci");

require("./server/dist/server/src/scripts/languages.js");
