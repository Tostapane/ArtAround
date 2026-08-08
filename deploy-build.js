/*
 * deploy-build.js — `npm run setup` + `npm run build`, ma dentro un container.
 *
 * Sulla macchina di laboratorio node non esiste: sta solo dentro le immagini che
 * gocker accende. Questo file esiste per farci passare i due comandi di
 * installazione e compilazione, che altrimenti non avrebbero un interprete.
 *
 *   (gocker): start node-22 site252627 deploy-build.js
 *   (gocker): logs site252627
 *
 * La cartella e' la stessa che vede il server, quindi node_modules/ e i due
 * dist/ restano sul disco quando il processo finisce.
 *
 * ⚠️ Un sito ha un solo slot node: finche' gira questo, il server non puo'
 * essere acceso. Per gli aggiornamenti: spegnere, buildare, riaccendere.
 */

const { execSync } = require('child_process');
const path = require('path');

const root = __dirname;

/*
 * Dentro il container HOME non e' scrivibile: npm prova a creare la sua cache
 * in /.npm e prende EACCES, fallendo con codice 243 dopo aver scaricato tutto.
 * Cache e home vanno quindi spostate sotto /webapp, che e' la cartella montata
 * e l'unica su cui abbiamo diritto di scrittura.
 */
const ambiente = {
  ...process.env,
  HOME: root,
  npm_config_cache: path.join(root, '.npm-cache'),
};

// I comandi sono quelli di package.json, spezzati uno per riga: se qualcosa
// fallisce vogliamo sapere *quale* passo, non che «setup» e' andato male.
// --no-audit --no-fund: due giri di rete in meno per passo, su una macchina
// dove l'installazione e' gia' la parte lenta.
const passi = [
  ['dipendenze server',      'npm install --include=dev --no-audit --no-fund --prefix server'],
  ['dipendenze marketplace', 'npm install --include=dev --no-audit --no-fund --prefix marketplace'],
  ['dipendenze navigator',   'npm install --include=dev --no-audit --no-fund --prefix navigator'],
  ['build marketplace',      'npm run build --prefix marketplace'],
  ['build navigator',        'npm run build --prefix navigator'],
];

console.log('=== deploy-build: inizio in ' + root);
console.log('=== node ' + process.version);

for (const [nome, comando] of passi) {
  console.log('\n--- ' + nome + ': ' + comando);
  try {
    execSync(comando, { cwd: root, stdio: 'inherit', env: ambiente });
    console.log('--- ' + nome + ': OK');
  } catch (errore) {
    // Uscire con codice diverso da zero: un fallimento silenzioso qui
    // diventerebbe una pagina bianca su /navigator/ mezz'ora piu' tardi.
    console.error('\n!!! ' + nome + ' FALLITO (uscita ' + errore.status + ')');
    console.error('!!! i passi successivi non vengono eseguiti');
    process.exit(1);
  }
}

console.log('\n=== deploy-build: tutto riuscito.');
console.log('=== Ora si puo\' spegnere questo e accendere il server.');
