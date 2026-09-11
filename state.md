# ArtAround: stato corrente del progetto

Aggiornato al 9 settembre 2026. Questo è il riferimento unico per capire il
progetto e riprendere il lavoro. Descrive il sistema presente nel repository,
non la cronologia delle modifiche.

## 1. Come usare questo documento

Ordine delle fonti quando due informazioni non coincidono:

1. `slides.pdf` definisce i requisiti dell'esame.
2. Il codice, i `package.json` e i file di configurazione definiscono il
   comportamento corrente.
3. `deploy.md` e `Come attivare i docker di dipartimento.pdf` descrivono
   l'ambiente del dipartimento; le correzioni specifiche di ArtAround riportate
   qui prevalgono sulle note ormai storiche.
4. Questo file collega requisiti, codice e operazioni e segnala in fondo ciò che
   manca o non è stato verificato.

`README.txt` è un artefatto di consegna immutabile: non va modificato. Il suo
contenuto non prevale sul codice quando descrive una vecchia modalità di avvio.

L'albero può contenere lavoro non committato dell'utente. Non ripristinare o
cancellare differenze senza averne prima ricostruito l'origine.

## 2. Prodotto e copertura delle specifiche

ArtAround è un sistema generico per preparare, acquistare e svolgere visite
museali. Il marketplace serve la preparazione; il navigator accompagna la
persona dentro il museo. Il server unifica dati, sessioni, contenuti, mappe e
servizi esterni.

### Fascia base, 18-24

| Requisito delle slide | Stato | Implementazione principale |
| --- | --- | --- |
| Marketplace ed editor di contenuti | Coperto | `marketplace/`, API `items` e `visits` |
| Scelta ed esecuzione della visita | Coperto | `Biglietteria.vue`, `Visita.vue` |
| Mappa del museo | Coperto | SVG annotati, `svgGraph.ts`, `Stage.vue` |
| Sintesi vocale e stesso testo a schermo | Coperto | `useTTS.ts`, cache TTS globale, API `/speech/tts` |
| Comandi vocali a vocabolario controllato | Coperto | `useSTT.ts`, `Comando.vue`, `llm.mapRequest` |
| Pulsanti equivalenti ai comandi vocali | Coperto | sorgente unica `options` in `shared/constants.ts` |

### Modulo I, 18-27

| Requisito | Stato | Implementazione principale |
| --- | --- | --- |
| Visita condotta dal docente | Coperto | `guided.ts`, `GuidedGate.vue`, `guidedSessions.ts` |
| Accesso con parola chiave | Coperto | `Visit.accessKey`, rotta `/join` |
| Contenuti privati della visita | Coperto | endpoint `/guided-sessions/:id/items` |
| Presenza degli studenti | Coperto | long poll a 10 s, online e primo piano mantenuti per studente |
| Domande degli studenti al docente | Coperto | cronologia della sessione con autore, opera e orario |
| Quiz e voto | Coperto | soluzioni e correzione sul server, una consegna |
| Contenuti e audio allo stesso istante | Coperto con limite | cache prima della notifica, `playAt` comune; un client lento parte dopo dall'inizio |

### Modulo II, 18-33

| Requisito | Stato | Implementazione principale |
| --- | --- | --- |
| Localizzazione tramite QR | Coperto | `useQRScanner.ts`, codici e foglio QR del server |
| Posizione e orientamento del dispositivo | Coperto | `useSensors.ts`, `localization.ts` |
| Scelta fra candidate a bassa confidenza | Coperto | `Posizione.vue`, miniature sfocate |
| Teletrasporto | Coperto | modalità armata in `Visita.vue` e `Stage.vue` |
| Creazione di un item mancante o alternativo | Coperto | `llm.ts`, `customVisit.ts`, preview |
| Mappatura di richieste libere sui comandi | Coperto | `mapRequest` |
| Traduzione di contenuti e comandi | Coperto con limiti | Google Translation, cataloghi UI, codici STT/TTS per lingua |
| Visita generata da vincoli dell'utente | Coperto | `POST /api/visits/custom` |
| Nessuna interfaccia chat o prompt generico | Coperto | gli ingressi del modello sono moduli vincolati |

### Vincoli trasversali

- Server Node/Express e MongoDB tramite Mongoose.
- Marketplace senza framework applicativo: Alpine è usato come strato di
  binding, senza component framework o router esterno.
- Navigator con Vue 3 e Vite.
- Sistema generico tramite configurazione e SVG, senza museo fissato nella
  logica applicativa.
- Due container nel modello del dipartimento: Mongo e Node.
- Dati dimostrativi e account sono prodotti dagli script di seed; la presenza
  effettiva nel database di consegna va verificata nell'ambiente giusto.
- Il progetto offre più di tre visite con almeno dieci opere per museo quando
  la griglia di seed è completa: i percorsi di catalogo sono creati per quattro
  toni e cinque durate.
- La cartella `sources/` è ricostruita dal processo di build per la consegna.

## 3. Architettura

```text
shared/       contratti dati, vocabolari, accesso, tema, componenti e i18n
server/       Express, Mongoose, API, seed, integrazioni esterne e file pubblici
marketplace/  SPA Alpine/TypeScript, compilata con tsc e Tailwind CLI
navigator/    SPA Vue 3, compilata e suddivisa da Vite
index.js      launcher del server compilato
deploy-build.js  installazione, build e istantanea sources nel container
```

La dipendenza va in una sola direzione: le tre applicazioni leggono `shared/`;
`shared/` non dipende da loro. Cambiare un payload o un valore persistito in
`shared/types.ts` o `shared/constants.ts` richiede quindi una migrazione
coordinata, non solo una correzione di TypeScript.

### Processi e indirizzi

| Ambiente | Marketplace/API | Navigator | Mongo |
| --- | --- | --- | --- |
| sviluppo diretto | Express `:8000` | Vite `:5173` | `localhost:27017` |
| Docker Compose | Express `:8000` | file compilati sotto `/navigator/` | servizio `mongodb` |
| dipartimento | una sola origine HTTPS, Express porta 8000 | `/navigator/` | `mongo_site252627:27017` interno al cluster |

Il server serve, nell'ordine, immagini, file pubblici del server, HTML e vendor
del marketplace, `/dist`, `/navigator`, `/i18n` e `/sources`. Solo dopo monta il
fallback delle rotte note del marketplace. Un asset inesistente deve quindi
restare 404.

### Compilazione corrente

- `npm run setup`: installa anche le dipendenze di sviluppo delle tre parti.
- `npm run build`: compila server, marketplace e navigator.
- Il server produce `server/dist/` con `tsc`.
- Il marketplace produce `marketplace/dist/` con `tsc` e Tailwind.
- Il navigator produce `navigator/dist/` con `vue-tsc` e Vite; la base di build
  è `/navigator/`.
- `npm start` esegue il launcher radice `index.js`, che carica
  `server/dist/server/src/index.js`.
- Solo lo sviluppo del server usa direttamente TypeScript con
  `npm run dev --prefix server`.

## 4. Modello di dominio

### Ruoli e identità

`UserRole` ammette `autore`, `visitatore` e `curatore`. L'username è unico fra
tutti i ruoli perché `Item.author` e `Visit.author` contengono il solo nome.

- Il visitatore ha portafoglio e collezione, acquista e crea itinerari privati.
- L'autore pubblica descrizioni e visite e consulta vendite e ricavi; non ha un
  portafoglio per comprare.
- Il curatore amministra opere e contenuti del museo; non si auto-registra.
- `seedUsers.ts` prepara i quattro account richiesti dalle slide:
  `autore1`, `autore2`, `visitatore1`, `visitatore2`.
- `seed.ts speciali` aggiunge `docente1` e `studente1..3` per la dimostrazione
  guidata.

Le password sono memorizzate in chiaro: è un limite deliberato del prototipo,
non un modello da riutilizzare in produzione.

### Entità persistite

| Modello | Ruolo |
| --- | --- |
| `Artwork` | opera del museo, immagine, autore, stile e nodo sulla pianta |
| `Item` | descrizione di opera o soggetto, tono, durata, testo, prezzo e licenza |
| `Visit` | percorso ordinato di item, note, opzionali, copertina, quiz e visibilità |
| `Museum` | materializzazione del museo configurato e dei suoi percorsi pubblici |
| `User` | account, ruolo, portafoglio e collezione |
| `Session` | token opaco normale o handoff, con scadenza TTL |

I campi `@id` e gli altri nomi Schema.org sono parte del contratto serializzato.
`Item.kind` distingue i contenuti su un'opera da quelli su artista, stile,
movimento, periodo o evento. `Visit.mancanti`, `costoMancanti` e `totale` sono
calcolati per l'utente che chiede e non sono salvati in Mongo.

### Accesso, acquisti e cancellazioni

`shared/access.ts` contiene la regola comune: un item è leggibile se è gratuito,
proprio o posseduto. L'identità arriva esclusivamente dalla sessione, mai da un
nome inviato dal client.

- Comprare una visita acquista in un'unica transazione tutti gli item mancanti.
- Ogni autore riceve il ricavo dei propri contenuti; credito insufficiente non
  produce acquisti parziali.
- Un contenuto gratuito non richiede acquisto.
- Le visite guidate, marcate da `accessKey`, non sono esposte nel catalogo
  normale.
- Le visite del visitatore sono private e hanno un tetto di cinque per museo,
  applicato solo alla creazione.
- Solo il ruolo autore può pubblicare o modificare item. Una visita esistente può
  essere modificata soltanto dall'utente che l'ha composta.
- Eliminare un item o un'opera può accorciare le visite, riallineando opzionali,
  note, durata e quiz. Una visita rimasta senza tappe viene eliminata.
- Solo il curatore può scegliere di eliminare in massa le visite coinvolte;
  l'autore può eliminare il proprio item ma non distruggere percorsi altrui.
- Le rotte `impact` espongono l'effetto prima della cancellazione.

## 5. Musei, configurazione e piante

Un museo è definito in `server/public/allestimento/` da:

```text
<Nome>.json   configurazione obbligatoria
<Nome>.svg    pianta annotata obbligatoria
<Nome>.*      copertina facoltativa e copertine per tono
```

`loadMuseumConfigs()` rilegge i JSON a ogni chiamata. Un JSON errato viene
saltato senza nascondere gli altri musei. Il seed materializza però alcuni
percorsi nel database; dopo una modifica a `mapPath` o `imagePath` occorre
riallinearli con `testers.ts musei`.

Configurazioni presenti nel repository:

| Museo | QID | Opere configurate | Piani |
| --- | --- | ---: | ---: |
| British Museum | Q6373 | 20 | 2 |
| Galleria degli Uffizi | Q51252 | 129 | 3 |
| Metropolitan Museum of Art | Q160236 | 50 | 2 |
| Museo del Louvre | Q19675 | 25 | 3 |

Il parser `server/src/services/svgGraph.ts` interpreta:

- `data-room` su aree di sala;
- `data-qid` sui nodi opera;
- `data-poi` sui servizi;
- `data-obstacle` e `data-desc` sugli ostacoli;
- `data-edge` sui collegamenti fra sale;
- `data-flow` sull'ordine curatoriale del percorso;
- `data-floor` e `data-floor-label` sui gruppi di piano;
- `data-width-m` sulla radice per convertire unità SVG in metri.
- `data-north-angle` facoltativo sulla radice per orientare GPS e bussola nelle
  piante che non hanno il nord verso l'alto.

Le porte sono rappresentate soltanto dal varco fra due segmenti di muro. Il
relativo `data-edge`, invisibile nell'interfaccia, attraversa il varco e collega
le due aree nel grafo; non viene disegnato l'arco del battente.

La geometria non inventa adiacenze: i collegamenti sono dichiarati. L'area che
contiene il centro del nodo decide la sala e, in caso di sovrapposizione, vince
la prima nel documento. Gli elementi `data-*` non devono usare trasformazioni
che il parser non applica. I nomi delle sale devono essere unici fra i piani.
Gli archi fra piani stanno fuori dai gruppi per non alterarne il `getBBox`.

Il controllo `npx ts-node src/scripts/testers.ts mappe`, eseguito durante questa
revisione, dichiara percorribili tutte e quattro le piante.

## 6. Marketplace

Il marketplace è una SPA senza framework applicativo. Alpine e i plugin focus e
collapse sono file locali in `marketplace/public/vendor/`; TypeScript produce
JavaScript senza bundler. `AppState` in `marketplace/src/frontend/state.ts` è il
singleton condiviso da tutti i binding.

### Router

Il router è implementato con History API:

- `parsePath` riconosce solo le rotte dell'applicazione;
- `navigate` usa `pushState` o `replaceState`;
- un ascoltatore delegato intercetta soltanto i collegamenti interni sicuri;
- `popstate` gestisce avanti e indietro;
- il server usa lo stesso elenco `marketplaceViews` per servire il guscio sui
  deep link.

Le rotte sono percorsi reali, per esempio `/vetrina`, `/opera/Q12418` e
`/visita/<id>`. Frammenti, download, link esterni, tasti modificatori e file
statici devono continuare a essere gestiti dal browser.

### Schermate e flussi

| Gruppo | Schermate |
| --- | --- |
| ingresso | `soglia`, `accedi`, `registrati`, `musei` |
| comuni | `home`, `vetrina`, `opera`, `visita` |
| visitatore | `libreria`, `componi`, `sumisura` |
| autore | `lavori`, `nuovo`, `componi`, `vendite` |
| curatore | `gestione`, `catalogo` |

La vetrina unisce opere, descrizioni e visite; i testi completi vengono caricati
solo aprendo l'opera, mentre l'elenco usa `/items/metadata`. L'editor permette
più letture dello stesso soggetto anche nello stesso tono; l'id include soggetto,
autore, tono e durata e riceve un suffisso in caso di collisione. Il compositore
ordina tappe, opzionali, note logistiche, copertina, licenza, parola chiave e
quiz. La visita su misura passa al navigator come richiesta e non viene
persistita.

I binding Alpine sono stringhe valutate a runtime: rinominare un metodo richiede
una ricerca nei file HTML oltre al type-check. `i18next` deve essere caricato
prima del modulo dell'applicazione. `x-cloak` impedisce il lampo delle viste non
ancora inizializzate.

## 7. Navigator

Il navigator è una SPA Vue a indirizzo singolo. I parametri dell'URL sono un
protocollo di avvio, non route interne. Lo stato condiviso è composto da `ref`
in `navigator/src/state.ts`; `navigator/src/api.ts` è l'unico client HTTP.

### Ingresso

`App.vue` carica prima `navigator/public/config.json`, poi segue questo ordine:

1. riscatta e rimuove dall'URL l'eventuale `handoff`;
2. richiede una sessione valida;
3. apre il ruolo studente con `guidedSession`;
4. apre il ruolo docente con `guidedVisit`;
5. apre una visita diretta con `visit`;
6. genera una visita con `custom`;
7. altrimenti mostra la biglietteria del museo da query o configurazione.

`apiBase` vuoto significa stessa origine in build e `:8000/api` in sviluppo.
Il file pubblico può cambiare museo senza ricompilare il navigator.

### Esecuzione della visita

- Il guscio occupa `100dvh`; scorrono soltanto le regioni interne previste.
- La barra mostra uscita, titolo, tappa corrente e avanzamento.
- `Stage.vue` offre mappa ed elenco allo stesso livello.
- `Scheda.vue` resta sempre disponibile e raccoglie lingua, opera, TTS,
  navigazione e comandi.
- Su telefono una barra permette di passare fra mappa, elenco, opera e domande.
- Più descrizioni ancorate alla stessa opera condividono il nodo: il cerchio
  mostra il primo numero seguito da `+`, mentre il nome accessibile conserva
  l'elenco completo delle tappe.
- Quando la mappa torna visibile su telefono, il piano attivo viene nuovamente
  inquadrato; il pannello "Dove sono?" dispone i quattro metodi su due colonne
  e resta contenuto nell'altezza dello schermo.
- La mappa usa un viewport interno: trascinamento, pinch e pulsanti `+`/`−` non
  ingrandiscono la pagina; il dezoom si ferma al piano completo e la tappa
  corrente viene centrata all'apertura.
- La pianta degli Uffizi ha coordinate verticali native; le altre piante restano
  orizzontali per consentire il confronto fra le due impostazioni.
- Il selettore nativo del piano e "Dove sono?" compaiono soltanto sulla mappa.
- Nella visita guidata dello studente, il controllo dell'audio sincronizzato è
  nella barra superiore, fra l'uscita e l'avanzamento.
- I limiti o i rifiuti di fotocamera e sensori non espongono dettagli tecnici:
  la localizzazione rimanda semplicemente all'inserimento del codice.
- Le note logistiche sono transizioni prima della prima tappa o fra due tappe.
- Le tappe si identificano con l'id dell'item, non con il QID dell'opera; due
  descrizioni della stessa opera non bloccano l'avanzamento.
- Più tappe della stessa opera condividono il nodo numerato sulla pianta.
- Il segnalino di posizione non intercetta il puntatore, così non copre il nodo
  corrente durante il teletrasporto.

### Localizzazione

Sono disponibili QR, codice digitato, sensori e teletrasporto. La stima in
`localization.ts` usa:

```text
costo = (distanza / accuratezza)² + (scarto angolare / sigma_angolo)²
```

Il termine angolare è assente se il dispositivo non fornisce orientamento. Se
la confidenza non è sufficiente, l'utente sceglie fra candidate con immagini
sfocate. Il teletrasporto è una modalità esplicita, annunciata e a colpo
singolo: sposta la posizione ma non apre automaticamente una scheda.

### Voce, lingua e accessibilità

La catena vocale è registrazione, Google STT, `mapRequest`, id canonico del
comando e gestore. Gli id non sono tradotti; etichette e suggerimenti sì. Un
testo non riconosciuto può diventare domanda libera, mentre un guasto del
servizio resta un errore distinto.

Tredici lingue condividono codici separati per traduzione, TTS e STT. L'italiano
è la sorgente; i dodici cataloghi JSON sono caricati pigramente. I campi della
descrizione aperta e le note vengono tradotti in tempo reale, con ripiego sul
testo originale se il servizio non risponde.

La UI include skip link, regioni vive, nomi accessibili, focus da tastiera,
controlli equivalenti alla voce, contrasto chiaro/scuro e rispetto di
`prefers-reduced-motion`.

## 8. Visite guidate

Le sessioni guidate sono effimere e risiedono in una `Map` del processo server;
un riavvio le chiude. Non ci sono WebSocket. Il docente aggiorna studenti,
domande e quiz ogni 1,5 secondi; ogni studente mantiene invece una sola richiesta
long poll, che il server conclude subito quando cambia la revisione della visita
e altrimenti rinnova dopo dieci secondi.

Sequenza docente:

```text
crea sala -> attesa -> avvia -> cambia tappa -> avvia/chiude quiz -> termina
```

Sequenza studente:

```text
parola chiave -> presenza -> attesa -> segue la tappa -> domanda -> quiz -> voto
```

L'apertura del long poll aggiorna `lastSeen`; la presenza scade dopo il timeout
più tre secondi di tolleranza. Lo studente resta nell'elenco della sessione con
`online: false`, invece di scomparire. `visibilityState` alimenta il valore
"attento", che significa soltanto pagina in primo piano, non attenzione umana.
Il gesto iniziale richiesto dai browser attiva subito l'audio sincronizzato e
riproduce un breve tono di conferma nello stesso `AudioContext` usato poi dalle
descrizioni. Non viene riprodotto alcun audio silenzioso. Lo studente può
disattivare e riattivare la sincronizzazione in qualsiasi momento; il controllo
si trova nella barra superiore, senza un banner separato, e la scelta
interrompe subito la riproduzione e viene mostrata al docente insieme a presenza
e primo piano. Il volume fisico del telefono non è osservabile da una pagina
web. Qualunque lettura manuale avviata con "Leggi" ferma e disattiva l'audio
sincronizzato prima di riprodurre il testo richiesto; riattivare la
sincronizzazione ferma invece la lettura manuale.

Durante la preparazione della prima tappa il comando del docente è disabilitato
e mostra "Avvio in corso…", così una seconda pressione non duplica la richiesta.

Per ogni cambio tappa il server recupera il testo dell'item e completa Google
TTS prima di aggiornare la revisione e risvegliare gli studenti. La risposta
contiene testo, lingua e `playAt`; il client scarica l'MP3 dalla cache globale,
lo decodifica nel contesto audio già attivato e parte al timestamp oppure, se è
già trascorso, subito dall'inizio. Conserva soltanto il buffer corrente e un
nuovo comando interrompe il precedente. L'audio guidato principale usa per ora
il testo sorgente italiano; `audioLanguage` resta nello stato della sessione
come punto di estensione per una futura lingua dichiarata nella visita. Non
viene stimato un offset: si assume l'orologio dei dispositivi allineato
automaticamente dal sistema operativo.

Le note logistiche sono pannelli locali: il comando del docente cambia subito
la tappa condivisa e ogni studente riceve la nota relativa allo spostamento. Il
pannello si può chiudere autonomamente, senza attendere che lo chiuda il docente.

Le domande restano nella cronologia della sessione e ogni vista docente riceve
autore, testo, opera e orario. Il server rimuove `correct` dai quiz inviati agli
studenti, corregge anche le risposte mancanti come errori e impedisce una seconda
consegna. All'ultima tappa il controllo di avanzamento del docente apre il
pannello del quiz, quando la visita ne contiene uno. Una sessione terminata resta
osservabile brevemente per distinguere la chiusura prevista da una scomparsa.

## 9. Server, API e servizi

### Sessioni

Login e registrazione coniano token opachi salvati in Mongo e trasmessi come
`Authorization: Bearer`. Una sessione normale dura sei ore. Un handoff dura
dieci minuti, viaggia nell'URL una volta e viene consumato da `/users/redeem`.
Entrambi usano un indice TTL su `expiresAt`.

`resolveSession` osserva il token su tutte le API senza rifiutare; le rotte
protette applicano poi `requireSession`. Restano pubblici `/api/health`,
`/api/config`, login, registrazione, redeem e il foglio dei QR, perché una
navigazione browser non può aggiungere l'intestazione Bearer.

### Inventario delle rotte

| Prefisso | Operazioni |
| --- | --- |
| `/api/artworks` | elenco, item dell'opera, preview, impatto, creazione, cancellazione |
| `/api/items` | elenco, metadati, item di un autore, testo singolo, immagine, creazione, impatto, cancellazione |
| `/api/visits` | elenco con prezzi, dettaglio, item, visita su misura, creazione/aggiornamento, cancellazione |
| `/api/museums` | elenco, configurazione, opere, temi, visite, QR, panoramica, contenuti, svuotamento |
| `/api/users` | registrazione, login/logout, handoff/redeem, acquisto, profilo, vendite |
| `/api/guided-sessions` | creazione/join, presenza, domande, avvio, tappa, quiz, fine, viste e item |
| `/api/llm` | informazione aggiuntiva contestuale |
| `/api/speech` | riconoscimento vocale e sintesi TTS |
| `/api/translate` | traduzione in gruppo dei testi persistiti |
| `/api/wayfinding` | percorso fra posizione, opera e servizio |
| pubbliche | `/api/health`, `/api/config` |

I contratti sintetici sopra ogni endpoint in `server/src/routes/` indicano
input, risposta e autorizzazione. Per i dettagli prevale sempre
l'implementazione della rotta.

### Servizi esterni

| Servizio | Uso | Effetto se manca |
| --- | --- | --- |
| Wikidata | metadati e immagini durante il seed | non si possono aggiungere correttamente nuove opere |
| Gemini `gemini-3.1-flash-lite` | descrizioni, mappatura comandi, risposte e pianificazione | cadono le quattro funzioni LLM, il resto resta disponibile |
| Google Speech-to-Text | trascrizione dei comandi | restano i pulsanti equivalenti |
| Google Text-to-Speech | audio delle descrizioni | resta lo stesso testo a schermo |
| Google Translation | traduzione dei contenuti persistiti | resta il testo italiano originale |

Le chiavi sono `GEMINI_API_KEY` e `GOOGLE_API_KEY`. Il server non deve
stampare i loro valori. La cache delle traduzioni è una `Map` in memoria senza
limite o persistenza, adatta alla dimostrazione ma non a un servizio duraturo.
La sintesi TTS passa interamente da una cache LRU in memoria: la chiave distingue
testo, lingua e formato MP3, e una singola Promise riunisce le richieste
contemporanee. Il limite predefinito è 64 MiB e si cambia con
`TTS_CACHE_MAX_BYTES`; la cache riparte vuota al riavvio.

I tempi delle visite guidate si cambiano senza ricompilare tramite
`GUIDED_LONG_POLL_MS` (10000), `GUIDED_AUDIO_LEAD_MS` (3000) e
`GUIDED_OFFLINE_GRACE_MS` (3000). Il primo valore non può essere inferiore a un
secondo; la presenza scade dopo long poll più tolleranza.

### Confine fra modello e codice deterministico

I quattro usi richiesti dalle slide sono separati:

1. `createDescription`, `createTwistedDescription` e
   `createSubjectDescription` producono item vincolati da tono e durata.
2. `mapRequest` restituisce soltanto un id del vocabolario controllato o `null`.
3. La traduzione dei contenuti passa da Google Translation; le risposte LLM
   vengono richieste direttamente nella lingua scelta.
4. `planVisit` restituisce JSON vincolato da schema; `customVisit.ts` risolve o
   genera gli item e `sortByFlow` impone l'ordine spaziale della pianta.

Le visite su misura hanno al massimo trenta opere e non vengono salvate in
Mongo. Un `twist` non vuoto forza una nuova descrizione; senza twist si prova a
riusare un item esistente. La correttezza del percorso, dei prezzi e dei
permessi resta nel codice, non nel prompt.

## 10. Seed, migrazioni e stato dei dati

### Seed

Eseguire dalla cartella `server/`:

```bash
npx ts-node src/scripts/seed.ts
npx ts-node src/scripts/seed.ts <QID>
npx ts-node src/scripts/seed.ts <QID> --force
npx ts-node src/scripts/seed.ts tutti
npx ts-node src/scripts/seed.ts speciali
```

Senza argomenti elenca le configurazioni. Il seed di un museo è additivo e
riprendibile: non cancella gli altri musei e riusa opere e item già presenti.
La griglia standard è quattro toni per cinque durate, quindi venti item per
opera e fino a venti visite di catalogo per museo. Le durate sono 15, 30, 60,
120 e 180 secondi.

`speciali` crea una visita guidata per ogni museo, con parola chiave che include
il QID per evitare collisioni, quiz generato dalle opere reali e account docente
e studenti. I quattro account ordinari richiesti dalla consegna vengono gestiti
anche da `seedUsers.ts`.

Un'opera Wikidata senza immagine P18 viene saltata. Il completamento del seed
non va dedotto dal numero di QID nel JSON: va misurato sul database.

### Collaudi e riallineamenti

`server/src/scripts/testers.ts` espone:

```text
stato toni nomi logistica generi buchi licenze account mappe
musei griglia private autore prezzi percorso miniature tutto
```

I comandi che modificano il database sono migrazioni idempotenti, ma vanno
comunque letti prima di eseguirli. `mappe` è l'unico controllo che non richiede
Mongo. `autore` deve precedere un nuovo seed su dati vecchi, altrimenti gli item
firmati con il vecchio autore non vengono riconosciuti e possono essere
rigenerati.

Il database locale e quello del dipartimento non sono automaticamente uguali.
Durante questa revisione la connessione Mongo dal sandbox è stata negata, quindi
non sono riportati conteggi non verificati.

### Cataloghi di lingua

`server/src/scripts/languages.ts` offre:

```text
chiavi residui stato traduci [codice] [--tutto] pota [--conferma]
```

Il controllo del 9 settembre 2026 ha trovato 529 chiavi su 529 in ciascuno dei
dodici cataloghi. Rimangono quattro chiavi orfane per catalogo, 48 occorrenze in
totale. `residui` segnala soltanto `ART`, `AROUND` e `ArtAround`, cioè il marchio,
non frasi di interfaccia da tradurre. Non eseguire `pota --conferma` senza aver
letto l'elenco: una chiave usata dinamicamente può sembrare orfana.

## 11. Deploy nel dipartimento

Il riferimento infrastrutturale è `Come attivare i docker di dipartimento.pdf`:
gocker gestisce un container Mongo e un solo slot Node per il sito
`site252627`. `deploy.md` aggiunge il giro operativo specifico di ArtAround.

### Configurazione effettiva

`index.js` è il launcher di produzione. Prima di caricare il server compilato:

- imposta `ARTAROUND_ROOT` sulla radice del progetto;
- usa porta 8000 se il processo non ne fornisce una;
- imposta i valori di dipartimento per Mongo e origine del navigator se non sono
  già presenti;
- lascia prevalere ogni variabile già definita dal processo.

`server/src/env.ts` carica poi `server/.env` senza `override`: anche qui i valori
già presenti nel processo prevalgono. Il file `.env` serve soprattutto per le
chiavi dei servizi esterni e per lo sviluppo locale. Non aggiungere una porta
diversa da quella pubblicata da gocker.

Il server di produzione non usa `ts-node`: `index.js` richiede
`server/dist/server/src/index.js`. `ARTAROUND_ROOT` è necessario perché il file
compilato vive più in profondità ma deve ancora trovare marketplace, navigator,
mappe, immagini, cataloghi e `sources/`.

Il processo ritenta Mongo ogni cinque secondi e apre la porta HTTP soltanto dopo
la prima connessione riuscita. `/api/health` risponde 200 con
`database: "connected"`; se la connessione viene persa a processo avviato,
risponde 503 con `database: "unavailable"`.

### Giro di aggiornamento

Nel container di build si esegue `deploy-build.js`. Lo script:

1. sposta `HOME` e cache npm sotto la radice scrivibile;
2. installa le dipendenze delle tre applicazioni con devDependencies;
3. compila server, marketplace e navigator;
4. ricrea `sources/`, escludendo segreti, dipendenze, output, note Markdown e
   immagini dati;
5. applica permessi 755 alle directory e 644 ai file tramite
   `u=rwX,go=rX`;
6. termina senza avviare il server.

Build e server occupano lo stesso slot Node. Il giro corretto è quindi:

```text
fermare il server
avviare il container Node con deploy-build.js
controllare che tutti i passi risultino OK
fermare il container di build
avviare Mongo se necessario
avviare il container Node con index.js
```

Un `git pull` da solo lascia in memoria il processo vecchio; un build senza
riavvio fa lo stesso. L'ora di `log/lastout` e `log/lasterr` va controllata prima
del loro testo, perché i log sopravvivono al container.

### Controlli di deploy

Verificare nell'ordine:

1. log nuovi e ascolto sulla porta 8000;
2. `/api/health` con stato 200 e `database: "connected"`;
3. `/` e `/api/config` sulla stessa origine HTTPS;
4. apertura e ricarica diretta di `/vetrina` e di una scheda interna;
5. `/manca-davvero.css` ancora 404;
6. `/navigator/` senza richieste verso `:5173`, HTTP misto o asset mancanti;
7. handoff marketplace-navigator in una finestra senza sessione preesistente;
8. SVG e immagini sotto `/allestimento` e `/images`;
9. microfono e TTS in HTTPS;
10. raggiungibilità internet di Gemini, Google Cloud e Wikidata dal container.

Un 503 indica in genere assenza del container; un 502 indica più spesso un
container vivo senza processo sulla porta attesa. Dopo ogni migrazione dei file
di allestimento eseguire nel contesto che raggiunge Mongo almeno `testers.ts
musei`, `private`, `autore`, `mappe` e `griglia`.

## 12. Regole di manutenzione e verifica

`guidelines.md` è vincolante:

- ogni `.ts` e `.vue` apre con una breve intestazione italiana su cosa fa e
  perché esiste;
- all'interno restano separatori, brevi etichette di template e contratti delle
  route di due o tre righe;
- codice e identificatori sono in inglese, commenti in italiano; i nomi italiani
  di dominio, UI e payload già stabiliti non vanno tradotti meccanicamente;
- storia, date e confronti appartengono qui, non nei sorgenti;
- codice morto e commenti che lo raccontano vanno rimossi.

La riga seguente in `navigator/env.d.ts` è una direttiva del compilatore e non un
commento eliminabile:

```ts
/// <reference types="vite/client" />
```

Controlli minimi dopo una modifica:

```bash
npm run build --prefix server
npm run build --prefix marketplace
npm run type-check --prefix navigator
npm run build-only --prefix navigator
npx ts-node src/scripts/testers.ts mappe   # dalla cartella server/
npx ts-node src/scripts/languages.ts stato # dalla cartella server/
git diff --check
```

Se `navigator/dist` è di proprietà del container e la build locale non può
svuotarlo, usare temporaneamente un output in `/tmp`; non cambiare i permessi o
cancellare una directory non propria soltanto per far passare il controllo.

Risultati di questa revisione:

- build TypeScript del server: passata;
- build TypeScript e CSS del marketplace: passata;
- type-check Vue: passato;
- bundle Vite verso una directory isolata in `/tmp`: passato;
- smoke test del server compilato su porta 8123: `/`, `/vetrina`,
  `/navigator/`, `/sources/` e una pianta rispondono 200; un asset inesistente
  risponde 404;
- controllo delle quattro piante: passato;
- copertura dei dodici cataloghi: 530/530;
- Oxlint sul navigator: zero errori e zero avvisi;
- ESLint sul navigator: non passa, con 19 errori preesistenti descritti in
  `Missing`;
- `git diff --check`: passato;
- `README.txt`: non modificato;
- nessuna suite automatica di test applicativi è presente.

## Missing

1. **Stato reale del database e deploy.** Dal sandbox non è stato possibile
   interrogare Mongo. Nel container che lo raggiunge vanno eseguiti `testers.ts
   stato`, `griglia`, `account` e i riallineamenti indicati sopra; vanno poi
   controllati quantità di opere/item/visite, tre visite da almeno dieci opere
   nello stesso museo, quattro account richiesti, visite guidate e quiz.

2. **Prova completa su dispositivi reali.** Restano da verificare due browser
   simultanei per docente/studente, presenza e domande, quiz, chiusura prevista,
   microfono e TTS su iPhone, QR da fotocamera, sensori/orientamento, selezione a
   bassa confidenza, teletrasporto, cambio automatico di piano e una visita lunga
   sulla pianta degli Uffizi.

3. **Lingua dell'audio guidato.** La traccia sincronizzata usa oggi il testo
   sorgente italiano. Una futura estensione può aggiungere la lingua al modello
   `Visit` e al form del marketplace; alla preparazione della tappa il server
   dovrà ottenere il testo in quella lingua prima di inviarlo a TTS. Lo stato,
   il long polling e il player trasportano già `audioLanguage`, mentre la cache
   separa le tracce per lingua e testo.

4. **Lingua dei dati e degli errori.** I cataloghi UI sono completi e i campi
   della descrizione vengono tradotti, ma nomi di visite, titoli delle opere,
   etichette della mappa e molti messaggi testuali del server possono restare in
   italiano. Va stabilita una politica per i nomi propri e introdotti codici
   errore traducibili. Le 48 traduzioni orfane possono essere eliminate solo
   dopo aver verificato che non siano chiavi dinamiche.

5. **Ingresso autonomo del navigator.** Oggi serve una sessione ottenuta dal
   marketplace, anche se `config.json` identifica un museo specifico. Decidere
   esplicitamente cosa può vedere una persona senza account prima di aprire un
   percorso anonimo.

6. **Prestazioni mobili.** La scheda compatta del navigator usa ancora le immagini
   grandi, benché il seed produca miniature. Gli asset Vite con hash possono
   ricevere cache lunga, ma `config.json` deve restare ricontrollabile; marketplace
   e file senza hash non vanno marcati immutabili.

7. **Verifica applicativa automatica.** Le build, il type-check, il controllo
   delle mappe e quello dei cataloghi non coprono router Alpine, autorizzazioni,
   acquisti atomici, cascate di cancellazione, hard reload e flussi browser.
   Servono almeno test di integrazione API e pochi percorsi end-to-end critici.

8. **Baseline ESLint.** `npx eslint . --no-cache` nel navigator segnala otto usi
   di `any` in `api.ts`, due nelle viste delle sessioni di `guided.ts` e nove nomi
   di componenti a parola singola;
   `eslint-plugin-oxlint` segnala inoltre l'assenza di `.oxlintrc.json`. Oxlint
   diretto è pulito. Va deciso se tipizzare/rinominare o configurare eccezioni
   esplicite, poi rendere coerenti i due lint.

9. **Debito di sicurezza del prototipo.** Password e credenziali del database
   non sono gestite come in produzione. Prima di riusare il sistema fuori dalla
   consegna vanno introdotti hash delle password, segreti esterni al repository,
   rotazione delle credenziali e limiti alle richieste.

10. **Documentazione immutabile o storica.** `README.txt` non va toccato, ma
   descrive ancora l'avvio del server sorgente con `ts-node`; il codice corrente
   avvia il server compilato. Anche `deploy.md` contiene un vecchio passaggio in
   cui `.env` avrebbe precedenza sul processo e una stima del seed basata su due
   durate. Per operare usare la descrizione corrente di questo file e il codice,
   poi riallineare soltanto i documenti che è consentito modificare.
