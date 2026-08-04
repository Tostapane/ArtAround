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
| https | no | si', e **non lo impostiamo noi**: lo termina il proxy del dipartimento davanti al container. Express resta in chiaro sulla 8000 |

Conseguenza da sapere: marketplace e navigator finiscono sulla **stessa origine**, quindi
condividono `sessionStorage`. Il biglietto di passaggio continua a funzionare, ma il navigator
aperto da solo trova la sessione del marketplace invece di rimandare indietro.

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

**3. `server/.env`** — non e' nel repository, quindi va scritto a mano **una volta sola** e
sopravvive a ogni `git pull`:

```
MONGO_URI=mongodb://site252627:LA_PASSWORD@mongo_site252627:27017/site252627?authSource=admin
NAVIGATOR_ORIGIN=https://site252627.tw.cs.unibo.it/navigator
GEMINI_API_KEY=…
GOOGLE_API_KEY=…
```

La password e' quella che ha stampato `start mongo site252627`. `NAVIGATOR_ORIGIN` **senza
barra finale**: la aggiunge il marketplace. Senza le due chiavi Google restano spenti il
modello, il riconoscimento vocale e la traduzione dei contenuti; tutto il resto vive.

**4. I dati** — il database nasce vuoto: vedi `server/src/scripts/` (dump qui, restore li').

**5. Accendere.**

```bash
ssh gocker.cs.unibo.it
(gocker): start mongo site252627          # una volta sola
(gocker): start nodemon-22 site252627 index.js
```

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
| `/api/health` | `{"message":"Unified Backend running"}` |
| `/` | la soglia del marketplace, con lo sciame che compone le opere |
| `/api/config` | `navigatorOrigin` col tuo indirizzo https, sei `thresholdArtworks` |
| entra e apri una visita | finisce su `/navigator/?museum=…&visit=…` |
| console del browser | nessuna richiesta a `:5173` o `:8000`, nessun avviso di contenuto misto |
| `/maps/…svg` e `/images/artworks/…jpg` | 200 |
| «Parla» | funziona: https e' un contesto sicuro |

Log: `logs site252627` da gocker, oppure `/home/web/site252627/log/`.

## Le cose che si rompono, e perche'

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
