# Insegnamento di Tecnologie Web
# CdS In Informatica   
# (A.A. 2025-26)

# Progetto ArtAround 18-33  
 
# READ ME DEL PROGETTO ARTAROUND

## Nome del gruppo: 
ArTristi

## Membri del gruppo 

* Nome e cognome: `Leonardo Manieri`, matricola: `0001163555`, mail: `leonardo.manieri@studio.unibo.it`
* Nome e cognome: `Andrea Maria Di Dio`, matricola: `0001177172`, mail: `andreamaria.didio@studio.unibo.it`
* LLM (nome e versione e licenza): 
  [Claude, Opus 5, Licenza proprietaria] 
  [Gemini, 3.1-flash-lite, Licenza Proprietaria]


* fabio.vitali@unibo.it
* andrea.schimmenti2@unibo.it
* gianmarco.spinaci2@unibo.it
* remo.grillo@unibo.it

## Tipo progetto
18-33

## Data di disponibilità delle applicazioni
13 Settembre 2026, Online (uno dei componenti e' attualmente in scambio)

## Locazione del progetto:

* URI del marketplace: https://site252627.tw.cs.unibo.it/
* URI del navigator: https://site252627.tw.cs.unibo.it/navigator/
* Altri URI rilevanti:
    * API REST: https://site252627.tw.cs.unibo.it/api (stato del servizio: `/api/health`)
    * Sorgenti in sola lettura: https://site252627.tw.cs.unibo.it/sources/
    * Foglio dei QR di un museo, da stampare e mettere vicino alle opere: https://site252627.tw.cs.unibo.it/api/museums/<qid>/qrcodes
    * Directory nelle macchine di dipartimento: /home/web/site252627/html/
    * Container docker: node-22 (applicazione) e mongo (database, host interno mongo_site252627)

## Organizzazione dei sorgenti
Il progetto è un monorepo: una directory per ciascuna delle due applicazioni client, una per
l'applicazione server-side e una quarta, `shared/`, con i tipi, le costanti, gli stili e le
traduzioni che tutte e tre importano.
html/
  ├── index.js
  ├── deploy-build.js
  ├── docker-compose.yml
  ├── package.json
  ├── server/                   applicazione server-side (Node.js / Express / TypeScript)
  │   ├── public/
  │   │   ├── allestimento/
  │   │   └── images/
  │   └── src/
  │       ├── data/
  │       ├── models/
  │       ├── routes/
  │       ├── scripts/
  │       ├── services/
  │       └── types/
  ├── navigator/                applicazione navigator (Vue 3 + Vite + Tailwind)
  │   ├── public/
  │   └── src/
  │       ├── assets/
  │       ├── components/
  │       │   ├── selection/
  │       │   └── visita/
  │       └── composables/
  ├── marketplace/              applicazione marketplace + area autore (Alpine.js)
  │   ├── public/
  │   │   └── vendor/
  │   └── src/
  │       └── frontend/
  ├── shared/                   tipi, costanti, stili e traduzioni comuni alle tre applicazioni
  │   └── i18n/
  └── sources/                  la copia in sola lettura di tutto quanto sopra

## Tecnologie utilizzate

#### Server-side
* Linguaggio: TypeScript (Node.js 22)
* I sorgenti si eseguono direttamente con `ts-node`
* Framework: Express 4
* Database: MongoDB 7, con Mongoose 8
* Pacchetti NPM: `express`, `mongoose`, `cors`, `compression`, `dotenv`,
  `multer`, `qrcode` (foglio dei QR delle opere),
  `@google/genai`, `@google-cloud/speech`,
  `@google-cloud/text-to-speech`, `@google-cloud/translate`,
  `ts-node`, `typescript`

#### Applicazione marketplace
* Linguaggio: TypeScript (moduli ES), HTML5, CSS3
* Framework: Alpine.js 3.15, con i plugin `collapse` e `focus`
* Traduzioni: i18next 26
* CSS: Tailwind CSS 4, compilato con `@tailwindcss/cli`
* Sviluppo: `typescript`, `ts-node`, `@types/node`

#### Applicazione navigator
* Linguaggio: TypeScript e Vue 3.5 (Composition API)
* Framework: Vite 7 con `@vitejs/plugin-vue`, compilato sotto la base `/navigator/`
* Pacchetti NPM: `vue`, `tailwindcss` 4 con `@tailwindcss/vite`, `i18next`, `jsqr` 
* API del browser: `getUserMedia`, `DeviceOrientationEvent`, Web Audio API, `HTMLAudioElement` 
* La pianta del museo non usa nessuna libreria di mappe: è un SVG annotato dal curatore
* Sviluppo: `vue-tsc` (type-check), `oxlint` ed `eslint`, `npm-run-all2`, `vite-plugin-vue-devtools`


## Contributo individuale
Le principali decisioni architetturali e quelle che hanno un legame tra piu' parti dell'applicazione,
sono state discusse da entrambi i membri prima dell'implementazione.
Le scelte stilistiche e dei principi da seguire per l'interfaccia grafica sono state decise di comune accordo.

#### Leonardo Manieri, 0001163555:
* Applicazione navigator: stato reattivo globale, accessibilita', navigazione fra le schermate
* Lettura ad alta voce del contenuto dell'item
* Biglietteria: scelta del museo, della visita e della lingua
* Motore di esecuzione della visita: avanzamento fra le tappe, tappe opzionali, indicatore progressione,
  note logistiche mostrate al passaggio, chiusura della visita
* Pianta interattiva del museo: disegno dell'SVG, posizione corrente, evidenziazione dell'opera 
* costruzione del grafo associato alla mappa per indicazioni avanzate per raggiungere uscita,
  toilette, bar e shop
* API REST di opere e musei: catalogo, anteprime e visite
* Foglio stampabile dei QR delle opere
* Localizzazione: lettura dei QR con la fotocamera, sensori e bussola per stimare davanti a
  quale opera si e', disambiguazione, modulo di teletrasporto
* Interazione vocale: riproduzione della sintesi, cattura e conversione dell'audio per il riconoscimento, 
  comandi a vocabolario controllato e pulsanti equivalenti
* Servizi vocali lato server
* Comandi in linguaggio naturale mappati sul vocabolario controllato tramite LLM
* Architettura della traduzione: cataloghi condivisi, lingua dell'interfaccia, traduzione
  dei contenuti lato server con cache
* Generazione dei contenuti tramite LLM con piu' toni e piu' difficolta' e item per opere non ancora descritte
* Modello dei dati: schemi Mongoose e struttura di tipi condiviso fra le tre applicazioni
* Genericità: configurazione dei musei letta da file e richiesta dati a wikidata
* Popolamento del database: Wikidata, scaricamento delle immagini, seed ripetibile
* Autorizzazione e prezzi lato server: chi può leggere un testo a pagamento e quanto costa
* Tema chiaro/scuro e componenti condivisi fra le due applicazioni

#### Andrea Maria Di Dio 0001177172:
* Applicazione marketplace: organizzazione, router, gestione della sessione e flusso delle schermate
* Account: registrazione, accesso, ruoli
* Presentazione e navigazione dei dati: vetrina, catalogo delle opere e delle visite, 
* area visitatore, autore, curatore e funzionalita' associate
* Presentazione contenuti: catalogo di centinaia di contenuti da analizzare, filtrare e
  scegliere
* Creazione e pubblicazione dei contenuti: associazione all'opera, immagine di
  riconoscimento, testi, metadati, licenza e prezzo
* Editazione della visita: aggiunta e riorganizzazione delle tappe, contenuti opzionali
* API REST di contenuti, visite e utenti: creazione, modifica, filtri, acquisto e rimozione (e impatto sul sistema)
* Passaggio di sessione dal marketplace al navigator
* Traduzione dell'interfaccia del marketplace
* Visite guidate: creazione con parola chiave e contenuti privati
* Waiting room visita guidata
* Poll per vedere gli utenti connessi in una visia guidata, sincronizzazione domande degli studenti
* Quiz di fine visita: composizione, somministrazione e voto
* Bootstrap del server: Express, file statici, servizio delle due applicazioni client
* Organizzazione automatica della visita tramite LLM a partire dai vincoli dell'utente
* Deploy nelle macchine di dipartimento
* Implementazione /sources
* Script di migrazione e di verifica
 
#### LLM:

**Claude Opus 5 — usato durante lo sviluppo**
* Brainstorming sulle scelte implementative
* Chiarimento di dubbi e proposta di soluzioni alternative
* Ricerca di errori e bug
* Correzione di difetti
* Controllo dell'aderenza alle specifiche del progetto
* Rifinitura grafica delle interfacce
* Rimozione di codice inutilizzato e refactoring
* Commenti e separatori interni ai file

**Gemini 3.1 Flash Lite — integrato nell'applicazione**
* Generazione dei testi degli item: quattro toni per cinque durate per ogni opera
* Mappatura dei comandi vocali in linguaggio naturale sul vocabolario controllato
* Organizzazione automatica della visita a partire dai vincoli dell'utente















