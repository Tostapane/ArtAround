/*
 * deploy-db.js — le migrazioni del database, ma dentro un container.
 *
 * Mongo si raggiunge solo da dentro il cluster: la shell in cui si entra con
 * ssh non ci sta, quindi `npx ts-node src/scripts/testers.ts ...` da li' non
 * parte. Gocker pero' sa accendere un node nella nostra cartella, ed e' questo
 * file: la stessa cosa che index.js fa per il server, applicata agli script.
 *
 *   (gocker): start node-22 site252627 deploy-db.js
 *   (gocker): logs site252627
 *
 * Ogni comando gira in un PROCESSO SUO. `testers.ts` chiama `main()` appena lo
 * si carica e non lo espone: caricarlo due volte nello stesso processo farebbe
 * partire due migrazioni sovrapposte sulla stessa connessione. Un processo per
 * comando costa un secondo di avvio e li tiene in fila.
 *
 * L'elenco predefinito e' quello dell'aggiornamento (deploy.md): le tre che
 * scrivono, poi le due che controllano e basta. Sono idempotenti, quindi
 * rilanciarlo non fa danni. Un nome passato a mano lo sostituisce, e i nomi
 * validi sono quelli di `COMMANDS` in fondo a testers.ts.
 *
 * Occupa lo slot node del sito come deploy-build.js: il server va spento prima
 * e riacceso dopo.
 */

const { execSync } = require('child_process');
const path = require('path');

const server = path.join(__dirname, 'server');
const registro = path.join(server, 'node_modules', 'ts-node', 'register');
const script = path.join(server, 'src', 'scripts', 'testers.ts');

let comandi = process.argv.slice(2);
if (comandi.length === 0) {
  comandi = ['musei', 'private', 'autore', 'mappe', 'griglia'];
}

// HOME dentro il container non e' scrivibile, e ts-node ci cerca la sua cache.
const ambiente = {
  ...process.env,
  HOME: __dirname,
  TS_NODE_PROJECT: path.join(server, 'tsconfig.json'),
};

console.log('=== deploy-db: ' + comandi.join(', '));
console.log('=== node ' + process.version);

for (const comando of comandi) {
  console.log('\n--- testers ' + comando);
  try {
    execSync("node --require '" + registro + "' '" + script + "' " + comando, {
      cwd: server,
      stdio: 'inherit',
      env: ambiente,
    });
  } catch (errore) {
    console.error('\n!!! ' + comando + ' FALLITO (uscita ' + errore.status + ')');
    console.error('!!! i comandi successivi non vengono eseguiti');
    process.exit(1);
  }
}

console.log('\n=== deploy-db: fatto. Ora si puo\' riaccendere il server.');
