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
 * Un sito ha un solo slot node: finche' gira questo, il server non puo'
 * essere acceso. Per gli aggiornamenti: spegnere, buildare, riaccendere.
 *
 * Si rilancia tale e quale a ogni `git pull`, ed e' il giro di tutti i giorni:
 * il primo deploy e' l'unico in cui installa davvero. Dopo, le dipendenze si
 * reinstallano solo se e' cambiato il `package-lock.json` di quella parte, e le
 * due compilazioni si rifanno sempre — durano secondi, e saltarle e' esattamente
 * come si finisce a servire un `dist/` di una settimana fa.
 */

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = __dirname;

/*
 * Se le dipendenze di una parte sono gia' quelle che chiede il suo lockfile.
 *
 * Il confronto e' sul CONTENUTO del `package-lock.json`, non sulla sua data:
 * `git pull` riscrive le date di tutti i file che tocca anche quando il
 * contenuto e' identico, quindi una prova sulle date direbbe "cambiato" a ogni
 * aggiornamento e non salterebbe mai niente. L'impronta la scriviamo noi dentro
 * `node_modules/` a installazione riuscita, cosi' sparisce insieme all'albero
 * che descrive.
 *
 * Nel dubbio si installa: un `npm install` di troppo costa minuti, uno di meno
 * costa un `tsc: not found` a meta' del passo dopo.
 */
function improntaLock(parte) {
  const lock = path.join(root, parte, 'package-lock.json');
  if (!fs.existsSync(lock)) return '';
  return crypto.createHash('sha256').update(fs.readFileSync(lock)).digest('hex');
}

function fileImpronta(parte) {
  return path.join(root, parte, 'node_modules', '.deploy-build-impronta');
}

function dipendenzeGiaPronte(parte) {
  try {
    const attesa = improntaLock(parte);
    if (!attesa) return false;
    if (!fs.existsSync(path.join(root, parte, 'node_modules'))) return false;
    const f = fileImpronta(parte);
    if (!fs.existsSync(f)) return false;
    return fs.readFileSync(f, 'utf8').trim() === attesa;
  } catch {
    return false;
  }
}

function segnaInstallazione(parte) {
  try {
    fs.writeFileSync(fileImpronta(parte), improntaLock(parte));
  } catch {
    // Non poterla scrivere significa solo reinstallare la prossima volta.
  }
}

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
console.log('=== deploy-build: inizio in ' + root);
console.log('=== node ' + process.version);

const passi = [];
for (const parte of ['server', 'marketplace', 'navigator']) {
  if (dipendenzeGiaPronte(parte)) {
    console.log('--- dipendenze ' + parte + ': lockfile immutato, salto');
    continue;
  }
  passi.push([
    'dipendenze ' + parte,
    'npm install --include=dev --no-audit --no-fund --prefix ' + parte,
    parte,
  ]);
}
// Le compilazioni si rifanno sempre: durano secondi, e saltarle e' esattamente
// il modo in cui si finisce a servire un dist/ della settimana scorsa.
passi.push(['build marketplace', 'npm run build --prefix marketplace', '']);
passi.push(['build navigator', 'npm run build --prefix navigator', '']);

for (const [nome, comando, parte] of passi) {
  console.log('\n--- ' + nome + ': ' + comando);
  try {
    execSync(comando, { cwd: root, stdio: 'inherit', env: ambiente });
    if (parte) segnaInstallazione(parte);
    console.log('--- ' + nome + ': OK');
  } catch (errore) {
    // Uscire con codice diverso da zero: un fallimento silenzioso qui
    // diventerebbe una pagina bianca su /navigator/ mezz'ora piu' tardi.
    console.error('\n!!! ' + nome + ' FALLITO (uscita ' + errore.status + ')');
    console.error('!!! i passi successivi non vengono eseguiti');
    process.exit(1);
  }
}

/*
 * `tsc` scrive i file anche quando trova errori di tipo, e `npm run build` esce
 * comunque con zero: un errore scorre via nel mezzo di un log lungo e il `dist/`
 * che ne esce e' compilato a meta'. Qui non c'e' modo di fermarlo a valle,
 * quindi lo si dice a chi legge, che e' l'unico che puo' guardare.
 */
console.log('\n=== deploy-build: tutto riuscito.');
console.log('=== Scorri il log qui sopra e cerca "error TS": tsc emette');
console.log('===    lo stesso, e un dist/ compilato a meta\' non si lamenta.');
console.log('=== Ora si puo\' spegnere questo e accendere il server.');
