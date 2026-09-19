/*
 * Installa e compila le tre applicazioni nel container di dipartimento, mostrando
 * solo le fasi del deploy; l'output tecnico viene conservato per spiegare gli
 * errori. Infine ricrea sources/ e lascia libero lo slot Node per il server.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;

const ambiente = {
  ...process.env,
  HOME: root,
  npm_config_cache: path.join(root, '.npm-cache'),
  npm_config_update_notifier: 'false',
};

const passi = [
  ['Controllo dipendenze', [
    'npm install --include=dev --no-audit --no-fund --prefix server',
    'npm install --include=dev --no-audit --no-fund --prefix marketplace',
    'npm install --include=dev --no-audit --no-fund --prefix navigator',
  ]],
  ['Compilazione server', ['npm run build --prefix server']],
  ['Compilazione navigator', ['npm run build --prefix navigator']],
  ['Compilazione marketplace', ['npm run build --prefix marketplace']],
];

console.log('Build ArtAround');
console.log('Node ' + process.version);

for (const [nome, comandi] of passi) {
  console.log('\n' + nome);
  for (const comando of comandi) {
    try {
      execSync(comando, {
        cwd: root,
        env: ambiente,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 20 * 1024 * 1024,
      });
    } catch (errore) {
      console.error('\nBuild interrotta durante: ' + nome);
      console.error('Comando: ' + comando + '\n');
      if (errore.stdout) process.stdout.write(String(errore.stdout));
      if (errore.stderr) process.stderr.write(String(errore.stderr));
      process.exit(1);
    }
  }
}

const sorgenti = path.join(root, 'sources');
const fuori = ['node_modules', '.git', '.npm-cache', 'dist', 'dist-ssr',
  'sources', '.claude', '.vscode', '.idea', 'cypress'];
function tieni(p) {
  const n = path.basename(p);
  if (fuori.includes(n)) return false;
  if (n === '.env' || n.startsWith('.env.') || n.endsWith('.local')) return false;
  if (n.endsWith('.tsbuildinfo') || n.endsWith('.swp') || n === '.DS_Store') return false;
  if (n.endsWith('.md')) return false;
  return path.relative(root, p) !== path.join('server', 'public', 'images');
}

console.log('\nPreparazione sorgenti');
try {
  fs.rmSync(sorgenti, { recursive: true, force: true });
  fs.mkdirSync(sorgenti);
  for (const v of fs.readdirSync(root)) {
    if (!tieni(path.join(root, v))) continue;
    fs.cpSync(path.join(root, v), path.join(sorgenti, v), { recursive: true, filter: tieni });
  }
  try { execSync("chmod -R u=rwX,go=rX '" + sorgenti + "'"); } catch {}
} catch (e) {
  console.error('Preparazione sorgenti non riuscita: ' + e.message);
  console.error('Il deploy puo\' proseguire.');
}

console.log('\nBuild completata.');
console.log('Spegnere il builder e avviare il server.');
