# `deploy.md` — i docker di dipartimento

Sito `site252627`, cartella `/home/web/site252627/html/`, indirizzo
`https://site252627.tw.cs.unibo.it/`.

## Che cosa cambia rispetto allo sviluppo

In locale il browser parla con **tre** cose: Vite (`:5173`), Express (`:8000`) e Mongo
(`:27017`). In laboratorio gocker pubblica **una porta sola per sito**, quindi:

| | sviluppo | deploy |
| --- | --- | --- |
| navigator | server suo, Vite su `:5173` | file compilati serviti da Express sotto `/navigator` |
| marketplace | Express `:8000` | Express, stessa origine |
| API | `http://host:8000/api` | `/api`, stessa origine |
| Mongo | `localhost:27017` | `mongo_site252627:27017`, **solo da dentro il cluster** |
| porta di Express | 8000 | **3000**, che e' quella che gocker pubblica: `PORT` in `server/.env` |
| https | no | si', e **non lo impostiamo noi**: lo termina il proxy del dipartimento davanti al container, che parla in chiaro col nostro processo |

Conseguenza da sapere: marketplace e navigator finiscono sulla **stessa origine**, quindi
condividono `sessionStorage`. Il biglietto di passaggio continua a funzionare, ma il navigator
aperto da solo trova la sessione del marketplace invece di rimandare indietro.

⚠️ E ne segue una che si vede solo li': **un biglietto che non si riscatta non si nota piu'**.
In sviluppo il navigator, non trovando nessuna sessione, dice di entrare dal marketplace; in
laboratorio trova quella del marketplace e prosegue come se niente fosse. Un guasto del
passaggio e' quindi visibile nell'ambiente in cui si prova e invisibile in quello in cui si
dimostra: se si tocca `handoff`/`redeem`, la prova che conta va fatta anche da un browser
che quella sessione non ce l'ha (una finestra anonima, o il QR letto da un altro telefono).

## Primo deploy

**1. Il repository al posto dell'applicazione d'esempio.** `git clone` vuole una cartella
vuota e `html/` non lo e', quindi si sovrappone:

```bash
cd /home/web/site252627/html
git init
git remote add origin https://github.com/Tostapane/ArtAround.git
git fetch origin restyle
git checkout -f -b restyle origin/restyle
```

I file di Company (`public/`, `scripts/`, `tpl/`, il suo `index.html`) restano li' non
tracciati e sono inerti: Express serve `marketplace/public` e `server/public`, non la radice.
`index.js` e `package.json` invece vengono sovrascritti, ed e' voluto.

**2. Le dipendenze.**

```bash
npm run setup      # server + marketplace + navigator
npm run build      # i due dist/
```

`setup` installa **anche le devDependencies**, e lo chiede per scritto (`--include=dev`):
i due `build` girano con `tsc`, `vite` e `vue-tsc`, che stanno li'. Su una macchina con
`NODE_ENV=production` un `npm install` nudo li salterebbe, `setup` finirebbe bene e `build`
morirebbe con `tsc: not found`. E' lo stesso motivo per cui `ts-node` e `typescript` stanno
fra le `dependencies` del server, applicato all'altra meta' del lavoro.

**3. `server/.env`** — non e' nel repository, quindi va scritto a mano **una volta sola** e
sopravvive a ogni `git pull`:

```
PORT=3000
MONGO_URI=mongodb://site252627:LA_PASSWORD@mongo_site252627:27017/site252627?authSource=admin
NAVIGATOR_ORIGIN=https://site252627.tw.cs.unibo.it/navigator
GEMINI_API_KEY=…
GOOGLE_API_KEY=…
```

`PORT` **e' la riga che decide se il sito risponde**: gocker pubblica una porta sola per
sito e pretende che lo script si metta in ascolto proprio li' (il numero lo dice il suo
banner d'accesso, ed e' 3000). Senza, il server parte sulla 8000 come in sviluppo, non
sbaglia niente e non dice niente: davanti c'e' un proxy che bussa dove non c'e' nessuno.
Il codice legge `process.env.PORT` e ripiega su 8000, quindi in locale non cambia niente.

La password e' quella che ha stampato `start mongo site252627`. **Il resto della riga non
va indovinato**: l'applicazione d'esempio di Company resta sul disco dopo il clone (passo 1)
e il suo `scripts/mongo.js` contiene l'indirizzo che sulla macchina funziona davvero, nome
del database e `authSource` compresi. Leggerlo costa meno di scoprire per tentativi che
l'autenticazione fallisce.

`NAVIGATOR_ORIGIN` **senza barra finale**: la aggiunge il marketplace. Non e' facoltativa:
mancando, `/api/config` ripiega su `<host>:5173`, che in laboratorio e' una porta che non
esiste e per giunta in chiaro dentro una pagina https, cioe' contenuto misto che il browser
blocca in silenzio. Senza le due chiavi Google restano spenti il modello, il riconoscimento
vocale e la traduzione dei contenuti; tutto il resto vive.

**4. I dati** — il database nasce vuoto, e riempirlo col seed non e' un'opzione: sono ~832
chiamate al modello per museo, su una quota che si e' gia' esaurita una volta. Si porta un
dump di quello di sviluppo.

⚠️ **Il punto da risolvere prima di provarci: Mongo si raggiunge solo da dentro il cluster.**
Lo dice il banner di gocker, e vale per `mongorestore` esattamente come per
`npx ts-node src/scripts/seed.ts`: se la shell in cui si e' entrati non e' nel cluster, tutti
gli script che parlano col database non partono, e sono il seed, `testers.ts` e `traduci`.
Si controlla in un colpo:

```bash
node -e "require('net').connect(27017,'mongo_site252627').on('connect',()=>console.log('raggiungibile')).on('error',e=>console.log('NO:',e.code))"
```

Se risponde `NO`, la strada e' far girare lo script **dentro** un container, che e' quel che
gocker sa fare: un file alla radice di `html/` e `start node-22 site252627 <file>.js`. La
cartella e' la stessa che vede il server, quindi il file lo si scrive da qui e si committa
come qualunque altro.

⚠️ **Verificare presto se il container esce su internet.** Gemini, le tre API Google
(riconoscimento, sintesi, traduzione) e Wikidata stanno fuori. Se il cluster non lascia
uscire, cadono le quattro voci di `state.md` §3.2 e restano in piedi mappa, QR,
teletrasporto, visite guidate, quiz e tutto il marketplace: si puo' dimostrare lo stesso,
ma bisogna saperlo prima e non davanti alla commissione.

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://generativelanguage.googleapis.com
```

**5. Accendere.**

```bash
ssh gocker.cs.unibo.it
(gocker): start mongo site252627          # una volta sola
(gocker): start nodemon-22 site252627 index.js
```

**Per la consegna e per l'esame si accende `node-22`, non `nodemon-22`.** `nodemon` riparte
da solo a ogni modifica sotto `server/src` o `shared`, e le sale delle visite guidate stanno
in memoria per scelta dichiarata: un `git pull` mentre una classe e' collegata la scioglie.
`nodemon` serve mentre si lavora; il giorno della dimostrazione si vuole un processo che
riparte solo quando lo si dice.

## Aggiornare (il giro di tutti i giorni)

Da qui si committa e si spinge; sulla macchina:

```bash
cd /home/web/site252627/html
git pull
npm run build        # solo se sono cambiati navigator o marketplace
```

`nodemon` riavvia da se' quando cambia `server/src`, e **non** quando cambia un `dist/`:
`nodemon.json` gli fa guardare solo il codice. E' anche il motivo per cui il caricamento
dell'immagine di un contenuto non fa piu' ripartire il server in mezzo alla richiesta.

`server/.env` e i `dist/` sono in `.gitignore`, quindi un `git pull` non li tocca mai.

## Controlli, in quest'ordine

| | atteso |
| --- | --- |
| i log all'avvio | `on port 3000`. Se dice 8000, manca `PORT` e il resto della tabella non ha senso di essere provato |
| `/api/health` | `{"message":"Unified Backend running"}` |
| `/` | la soglia del marketplace, con lo sciame che compone le opere |
| `/api/config` | `navigatorOrigin` col tuo indirizzo https, sei `thresholdArtworks` |
| entra e apri una visita | finisce su `/navigator/?museum=…&visit=…` |
| console del browser | nessuna richiesta a `:5173` o `:8000`, nessun avviso di contenuto misto |
| `/maps/…svg` e `/images/artworks/…jpg` | 200 |
| «Parla» | funziona: https e' un contesto sicuro |

Log: `logs site252627` da gocker, oppure `/home/web/site252627/log/`.

## Le cose che si rompono, e perche'

- **Il sito non risponde affatto, e i log non dicono niente di sbagliato** → manca `PORT=3000`
  in `server/.env`. Il processo e' vivo e in ascolto, ma su una porta che nessuno pubblica.
  Nei log si legge `ArtAround Unified Backend on port 8000`: e' quello il segnale.
- **`tsc: not found` / `vite: not found` durante `npm run build`** → le devDependencies non
  sono state installate. `npm run setup` le chiede esplicitamente; se qualcuno ha installato
  a mano con `--omit=dev` o con `NODE_ENV=production`, rifare `npm run setup`.
- **`require` fallisce all'avvio** → e' rimasto il `package.json` di Company, che si dichiara
  ESM. Il nostro va sovrascritto.
- **`Cannot find module 'ts-node'`** → `npm install --prefix server` con `NODE_ENV=production`
  salterebbe le devDependencies; per questo `ts-node` e `typescript` stanno fra le
  `dependencies`.
- **Pagina bianca su `/navigator/`** → `npm run build` non e' stato rifatto dopo un `git pull`,
  oppure e' stato fatto senza `base: '/navigator/'` (che `vite.config.ts` mette da se' solo in
  `build`, non in `dev`).
- **Il navigator non trova le API** → e' `apiBase` in `navigator/dist/config.json`: in deploy
  deve restare **vuoto**, cosi' vale la stessa origine. Scriverci un `http://host:8000` su una
  pagina https e' contenuto misto, e il browser lo blocca in silenzio.
