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
| porta di Express | 8000 | **8000**, la stessa: e' il container che esporta `PORT=8000`, ed e' quella che il proxy pubblica. Non va scritta da nessuna parte |
| https | no | si', e **non lo impostiamo noi**: lo termina il proxy del dipartimento davanti al container, che parla in chiaro col nostro processo |

Conseguenza da sapere: marketplace e navigator finiscono sulla **stessa origine**, quindi
condividono `sessionStorage`. Il biglietto di passaggio continua a funzionare, ma il navigator
aperto da solo trova la sessione del marketplace invece di rimandare indietro.

⚠️ **Gli indirizzi del marketplace sono percorsi veri** (`/vetrina`, `/opera/Q12418`), non piu'
frammenti dopo un `#`. Cambia una cosa che in sviluppo non si vedeva: quegli indirizzi ora
**arrivano al server**, che deve rispondere col guscio. Lo fa lui, in fondo a `server/src/index.ts`,
e riconosce solo i nomi elencati in `shared/constants.ts`. Due ricadute per il laboratorio:

- il proxy del dipartimento pubblica il sito su una **radice** (`https://site252627.tw.cs.unibo.it/`),
  che e' quello che questi indirizzi assumono. Se un giorno finisse sotto un sottopercorso,
  tutti i riferimenti assoluti (`/dist`, `/images`, `/api`) andrebbero rivisti insieme;
- il controllo che conta non e' piu' aprire `/` e cliccare: e' **ricaricare** su una schermata
  interna. Cliccando funziona anche se il server non sapesse niente di quegli indirizzi.

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
MONGO_URI=mongodb://site252627:LA_PASSWORD@mongo_site252627:27017/site252627?authSource=admin
NAVIGATOR_ORIGIN=https://site252627.tw.cs.unibo.it/navigator
GEMINI_API_KEY=…
GOOGLE_API_KEY=…
```

**`PORT` non va messa**, ed e' l'errore che questo file ha insegnato per tre settimane.
Il container esporta gia' `PORT=8000`: e' cosi' che dice allo script dove mettersi in
ascolto, ed e' la porta che il proxy pubblica. Scrivere `PORT=3000` nel file porta a un
**502**, cioe' il proxy che trova il container acceso e nessuno in ascolto dove bussa.
Il codice legge `process.env.PORT` e ripiega su 8000, quindi in locale non cambia niente.

Da `cc7aae2` **quel che dice il file vince su quel che dice l'ambiente** (`server/src/env.ts`):
dotenv, da solo, non sovrascrive una variabile gia' presente, ed e' il motivo per cui una
riga `PORT` scritta li' sembrava non avere alcun effetto. Ora l'ha, il che vuol dire che
scriverla sbagliata fa danno: se non c'e' una ragione precisa, non si tocca.

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

Se `node` non c'e' sulla macchina nuda, il `build` passa dal container come il primo giorno:
`start node-22 site252627 deploy-build.js`. **Si rilancia tale e quale**, non solo al primo
deploy: riconosce le dipendenze gia' installate confrontando l'impronta del `package-lock.json`
e salta quelle immutate, quindi su un aggiornamento normale fa solo le due compilazioni.
Ricompilare sempre e' voluto — un `dist/` saltato e' il difetto che si debugga una settimana
dopo. ⚠️ Ricordarsi che occupa **lo slot node del sito**: spegnere il server, buildare,
riaccendere.

`nodemon` riavvia da se' quando cambia `server/src`, e **non** quando cambia un `dist/`:
`nodemon.json` gli fa guardare solo il codice. E' anche il motivo per cui il caricamento
dell'immagine di un contenuto non fa piu' ripartire il server in mezzo alla richiesta.

⚠️ **Con `node-22` (cioe' per la consegna e l'esame) il riavvio va fatto a mano**, e questo
aggiornamento lo pretende: gli indirizzi senza cancelletto hanno toccato `server/src/index.ts`
e `shared/constants.ts`, che sono codice del server. Un `git pull` seguito dal solo `build`
lascerebbe in piedi il processo vecchio, che non conosce quegli indirizzi: si naviga bene
cliccando e si prende **404 ricaricando**.

⚠️ **Anche il marketplace va ricompilato in questo giro**, non solo il navigator: il router
sta in `state.ts` e l'elenco delle schermate in `shared/`, e sono entrambi dentro
`marketplace/dist/`.

⚠️ **E questo giro chiede anche una riga sul database**, che e' la sola cosa che un `git pull`
non puo' sistemare da se'. L'allestimento dei musei (configurazione, pianta, copertina) e'
passato in `server/public/allestimento/`, ma `mapPath` era stato copiato dentro i documenti al
momento del seed: il dump in laboratorio dice ancora `/maps/…`, cioe' un indirizzo che non
esiste piu'. Vetrina e catalogo non se ne accorgono; il navigator smette di disegnare la sala
e il calcolo del percorso resta senza grafo.

```bash
cd server && npx ts-node src/scripts/testers.ts musei    # pianta e copertine dai file di configurazione
cd server && npx ts-node src/scripts/testers.ts private  # visibilita' delle visite, esplicita su tutte
cd server && npx ts-node src/scripts/testers.ts autore   # firma dei contenuti seminati: "sistema" -> "Museo"
cd server && npx ts-node src/scripts/testers.ts mappe    # le piante si camminano ancora?
cd server && npx ts-node src/scripts/testers.ts griglia  # la griglia toni x durate e' completa?
```

Sono tutte idempotenti: rilanciarle non fa danni, e le prime tre stampano `0` quando non
c'e' piu' niente da fare. ⚠️ **`autore` va eseguita prima di qualunque seed successivo**: il
seed riconosce quel che ha gia' scritto cercando l'autore, e finche' nel database c'e' il nome
vecchio non trova niente e rigenera tutto da capo, migliaia di chiamate al modello comprese.

Vale la nota del passo 4 del primo deploy: se la shell non e' dentro il cluster, Mongo non si
raggiunge e questi due comandi vanno fatti girare in un container.

`server/.env` e i `dist/` sono in `.gitignore`, quindi un `git pull` non li tocca mai. **Niente
cambia in `.env`** per questo aggiornamento: `NAVIGATOR_ORIGIN` resta quello, e `PORT` non
c'e' e non ci va.

## Controlli, in quest'ordine

| | atteso |
| --- | --- |
| l'**ora** di `log/lastout` | e' di adesso. Se e' vecchia, quel che c'e' scritto sotto e' di un processo di ore fa e non dice niente su questo avvio: e' il primo controllo, prima di leggere qualunque riga |
| i log all'avvio | `on port 8000` |
| `/api/health` | `{"message":"Unified Backend running"}` |
| `/` | la soglia del marketplace, con lo sciame che compone le opere |
| `/api/config` | `navigatorOrigin` col tuo indirizzo https, sei `thresholdArtworks` |
| **`/vetrina` scritto a mano nella barra** | **la pagina si apre** (chiede il museo, che non si ricorda mai: e' voluto). Un **404** qui vuol dire server vecchio, ed e' il primo controllo da fare dopo questo aggiornamento |
| **ricarica su una schermata interna** | resta dov'era invece di dare 404 |
| **tasto "indietro" dopo tre schermate** | torna indietro una per volta, senza rimbalzare avanti |
| **una voce del binario** | cambia schermata **senza** che la pagina lampeggi: se lampeggia, `dist/` e' vecchio e i click non vengono intercettati |
| `/manca-davvero.css` | ancora **404**: il guscio risponde solo ai nomi delle schermate, non a tutto |
| entra e apri una visita | finisce su `/navigator/?museum=…&visit=…` |
| console del browser | nessuna richiesta a `:5173` o `:8000`, nessun avviso di contenuto misto |
| `/allestimento/…svg` e `/images/artworks/…jpg` | 200 |
| «Parla» | funziona: https e' un contesto sicuro |

Log: `logs site252627` da gocker, oppure `/home/web/site252627/log/`.

## Le cose che si rompono, e perche'

- **`503` contro `502`**, ed e' la distinzione che fa risparmiare ore. **503**: non c'e'
  nessun container acceso — il proxy non trova niente dietro di se'. **502**: il container
  c'e' e nessuno ascolta dove il proxy bussa, cioe' una porta sbagliata (`PORT` in `.env`,
  che non ci va: la esporta il container).
- **`start` non fa niente e non lo dice.** Se un container del sito c'e' gia', `start` torna
  al prompt senza un messaggio e senza avviare nulla: si continua a leggere il log del
  processo di prima, che dice cose giuste su un avvio vecchio. **Guardare l'ORA di
  `log/lastout` prima del testo** e' l'unico modo di accorgersene. Al contrario, dopo uno
  `stop` (che stampa "Site removed") capita che il `start` seguente non prenda: la coppia che
  rimette in piedi il sito e' `start mongo <sito>` e poi `start node-22 <sito> index.js`.
- **`logs` e `list` non dicono lo stato.** `logs` si attacca solo a un container vivo e
  risponde `No such service` quando e' morto — che e' un'informazione, ma arriva uguale
  quando `start` non ha fatto niente; `list` elenca i siti che possiedi, non quel che gira.
  Lo stato vero sono l'ora di `log/lastout` e `log/lasterr`, che sopravvivono al container.
- **Il server non parte e nei log c'e' `Cannot find module 'X'`** → `node_modules` sulla
  macchina e' anteriore all'ultima dipendenza aggiunta. `ts-node` compila all'avvio, quindi
  una dipendenza mancante non e' un difetto a runtime: e' un server che non parte affatto.
  Si risolve solo rilanciando `deploy-build.js`, ed e' il motivo per cui va rilanciato a ogni
  aggiornamento e non solo quando cambia il frontend.
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
- **404 ricaricando `/vetrina`, ma cliccando si naviga benissimo** → il server e' quello vecchio.
  Cliccando non se ne accorge nessuno perche' il percorso non esce dal browser; ricaricando
  invece lo si chiede al server, che non sa cosa sia. Con `nodemon` bastava il `git pull`, con
  `node-22` va riacceso a mano.
- **Ogni voce del binario fa lampeggiare la pagina, e il catalogo si ricarica ogni volta** →
  `marketplace/dist/` e' vecchio: senza `interceptClicks()` i collegamenti sono navigazioni
  vere e l'applicazione riparte da zero a ogni click. Rifare il build del marketplace.
- **La pianta non compare nel navigator, e il percorso non si calcola** → i documenti dei musei
  puntano ancora a `/maps/…`. Succede dopo aver aggiornato senza aver lanciato
  `testers.ts musei`, o dopo aver ripristinato un dump vecchio. Si vede subito: la carta del
  museo si apre, la visita parte, e la sala resta vuota.
- **Il tasto "indietro" non esce piu' da una schermata** → e' il caso che `redirectTo()` esiste
  per evitare (una correzione di rotta che si impila invece di sostituire). Se ricompare,
  qualcuno ha rimesso `goTo()` in una delle tre guardie: `state.md` §4.1-bis.
