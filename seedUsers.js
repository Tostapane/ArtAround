/*
 * Launcher gocker per il seed compilato degli account dimostrativi. ARTAROUND_ROOT
 * permette al codice in dist di caricare server/.env dalla posizione corretta.
 */

process.env.ARTAROUND_ROOT = __dirname;

require("./server/dist/server/src/scripts/seedUsers.js");
