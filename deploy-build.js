/*
 * Installa e compila le tre applicazioni nel container di dipartimento, dove
 * sposta anche la cache npm in una cartella scrivibile. Infine ricrea sources/;
 * il server va avviato separatamente perche' usa lo stesso slot Node.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;

const ambiente = {
  ...process.env,
  HOME: root,
  npm_config_cache: path.join(root, '.npm-cache'),
};

const passi = [
  ['dipendenze server',      'npm install --include=dev --no-audit --no-fund --prefix server'],
  ['dipendenze marketplace', 'npm install --include=dev --no-audit --no-fund --prefix marketplace'],
  ['dipendenze navigator',   'npm install --include=dev --no-audit --no-fund --prefix navigator'],
  ['build server',           'npm run build --prefix server'],
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
    console.error('\n!!! ' + nome + ' FALLITO (uscita ' + errore.status + ')');
    console.error('!!! i passi successivi non vengono eseguiti');
    process.exit(1);
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

console.log('\n--- istantanea sorgenti: sources/');
try {
  fs.rmSync(sorgenti, { recursive: true, force: true });
  fs.mkdirSync(sorgenti);
  for (const v of fs.readdirSync(root)) {
    if (!tieni(path.join(root, v))) continue;
    fs.cpSync(path.join(root, v), path.join(sorgenti, v), { recursive: true, filter: tieni });
  }
  try { execSync("chmod -R u=rwX,go=rX '" + sorgenti + "'"); } catch {}
  console.log('--- istantanea sorgenti: OK');
} catch (e) {
  console.error('!!! istantanea sorgenti fallita: ' + e.message + ' (il deploy prosegue)');
}

console.log('\n=== deploy-build: tutto riuscito.');
console.log('=== Ora si puo\' spegnere questo e accendere il server.');
