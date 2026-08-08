# `left.md` — handoff

## ⏸ Ripresa — 2026-08-08, via il cancelletto dagli indirizzi

`#/vetrina` → `/vetrina`. Ragionamento durevole in `state.md` §4.1-bis; qui cosa e' stato
toccato e cosa resta da provare a mano.

### La premessa che era sbagliata

Il giro prima avevo scritto che togliere il cancelletto avrebbe rotto «il collegamento
obbligatorio al marketplace». **Non e' vero, e le slide dicono il contrario**: la 30 elenca
«Accesso al marketplace» fra le voci del *navigator*, cioe' un collegamento che va dal
navigator al marketplace e non il rovescio; la 19 vuole la selezione del museo «via file di
configurazione»; la 34 dice che il curatore puo' fare «una versione specifica del navigator
per il suo museo». Le due applicazioni sono separate e il navigator si apre per conto suo.
Quel collegamento era **una costante sola** (`navigator/src/config.ts:77`), non una dipendenza.

⚠️ **Resta aperta una cosa che discende da li' e che NON e' stata toccata**: oggi il navigator
non si puo' aprire da solo — senza biglietto di passaggio non c'e' sessione e si finisce in un
vicolo cieco. Viene dal giro di irrobustimento delle sessioni del 2026-08-03, non dalle slide,
e sta scomodo accanto alla 34. Va deciso, non e' un difetto del router.

### Cosa e' cambiato

| file | cosa |
| --- | --- |
| `shared/constants.ts` | `marketplaceViews` + `marketplaceLegacyViews`, letti dal router **e** dal server |
| `marketplace/src/frontend/state.ts` | `parsePath` (torna `null` se non e' nostro), `navigate(percorso, sostituendo)`, `goTo`, nuovo `redirectTo`, `interceptClicks`, `popstate` |
| `marketplace/public/index.html` | 23 righe: `#/…` → `/…` |
| `server/src/index.ts` | il guscio per gli indirizzi delle schermate, in fondo a tutto |
| `navigator/src/config.ts` | `marketplaceHome()`: `/#/home` → `/home` |

### Le tre cose che si imparano solo sbattendoci

- ⚠️ **`pushState` non emette eventi**: la rotta va applicata a mano, e scordarsene cambia
  l'indirizzo senza cambiare schermata.
- ⚠️ **Senza intercettare i click il browser ricarica** a ogni voce del binario, catalogo
  compreso. Il corpo di `interceptClicks` e' quasi tutto eccezioni: tasti speciali, tasto
  centrale, `target`, `download`, frammenti veri, e tutto cio' che non e' una schermata.
- ⚠️ **`tsc` emette anche quando fallisce.** Un `error TS2339` e' passato e `dist/` e' stato
  riscritto lo stesso: `npm run build --prefix marketplace` **non** basta guardarlo uscire, va
  letto. E' la stessa famiglia del `dist/` stantio.

### Provato, e cosa resta da provare a mano

In chromium via CDP, contro un server di prova sulla 8100 e il catalogo Uffizi (104 opere):
click vero su una scheda opera, indietro/avanti su `home → vetrina → libreria`, binario, salto
al contenuto ancora frammento, `stile:Barocco e Rococo` codificata e riletta identica,
`/api/…` + `target=_blank` + ctrl+click + link esterni **non** intercettati, zero eccezioni.
Lato server: 200 sulle schermate, 404 conservato su file e rotte inesistenti.

Resta da provare **con le mani**, che il pilota non copre bene: ctrl+click e tasto centrale
davvero (qui sono eventi sintetici, non input del sistema), il foglio dei QR del curatore che
si apre in una scheda nuova, e il giro completo marketplace → navigator → ritorno a `/home`.

## ⏸ Ripresa — 2026-08-07, la visita vuota, il binario, il foglio dei QR, e due domande

Cinque punti: tre correzioni e due domande. Ragionamento durevole in `state.md` §3.1-nonies
(la visita vuota), §4.1 (il binario e il cancelletto), §4.10/§4.14 (il foglio dei QR) e §4.9
(il QR di una visita).

### 1. Una visita senza tappe non si crea, e il buco non era dove sembrava

Il client la rifiutava gia' (`visitIssues()` → «almeno una tappa») e il server pure — ma il
server contava gli **id ricevuti**, non gli item **trovati**. Provato contro il server vivo,
per l'autore e per il visitatore, che sono la stessa rotta:

| payload | prima | ora |
| --- | --- | --- |
| `percorso: []`, solo logistiche, niente percorso | 400 | 400 |
| una tappa con un `id_item` che non esiste | **201, visita creata** | 400 che nomina l'id |
| una tappa vera piu' una fantasma | **201** | 400 |
| `itemListElement` di soli id inventati | **201** | 400 |
| `id_item: ""` | **201** | 400 «almeno una tappa» |
| due tappe vere | 201 | 201 |

- ⚠️ **Una tappa che non si risolve non da' errore, semplicemente non compare**: la visita
  usciva con durata zero e si apriva vuota. E' lo stesso danno silenzioso per cui la
  cancellazione di un'opera accorcia le visite (§1.1-sexies).
- ⚠️ **Gli id vuoti si tolgono PRIMA di contare**, o il messaggio diventa «non esiste nel
  catalogo: » con la stringa vuota al posto del nome.
- La terza strada era gia' chiusa: `/visits/custom` risponde 502 e non scrive niente.
- **Niente lasciato nel database**: 84 visite prima e dopo, zero residui `PROVA-`.

### 2. Il binario sul telefono: le icone non erano una riga

Segnalato da autore. Misurato a 390 px: *I miei contenuti* e *Crea descrizione* vanno a capo,
quindi le loro icone stavano **8,4 px piu' in alto** delle altre due, e la prima riga di ogni
etichetta si appoggiava a sinistra invece di stare sotto l'icona.

- `justify-center` → `justify-start` (icone ancorate in cima) e `text-center` sull'etichetta.
- ⚠️ **Non si risolve accorciando le parole**: quale voce vada a capo dipende dalla lingua, e
  ce ne sono tredici. Ancorare l'icona e' l'unica forma che regge senza sapere la parola.
- Dopo: quattro icone a `y=774,4`, tutte centrate sulla voce; da `lg` il testo torna a
  sinistra e il binario resta verticale.

### 3. Il foglio dei QR e' del curatore

Spostato da `lavori` (autore) alla testata di `gestione` (curatore).
⚠️ **La rotta resta aperta e non e' una svista**: il foglio si apre come pagina, quindi a
chiederlo e' il browser e a una navigazione non si attacca un'intestazione. La prerogativa e'
quindi del binario, non del server; chiuderla davvero vorrebbe dire scaricarlo con `fetch` e
aprirlo da un blob, per un documento che nasce per essere appeso al muro.

### 4. Il QR di una visita era rotto, ed e' stato TOLTO

«Portala sul telefono» sulla pagina di una visita: il QR di `…/?museum=&visit=`. Non era il QR
di un'opera — era il QR di un **collegamento**, e serviva a dire che a un certo punto si cambia
dispositivo.
⚠️ **Non funzionava dal 2026-08-03**: il collegamento non porta identita' (per scelta: e' un
codice fotografabile) e il navigator adesso pretende una sessione. Verificato aprendo quel
preciso indirizzo con `sessionStorage` vuoto: si atterrava su *«Apri l'app da museo dal
marketplace»*. Le slide non lo chiedono, quindi e' sparito invece di essere riparato.

Tolto per intero, non solo dallo schermo — un pannello nascosto avrebbe lasciato in piedi una
rotta che nessuno chiama:

| | |
| --- | --- |
| `marketplace/public/index.html` | il riquadro «Portala sul telefono» |
| `state.ts` | `visitQrUrl()` |
| `server/src/index.ts` | la rotta `GET /api/qr` e l'import di `qrcode` (`routes/museums.ts` ha il suo, per il foglio del curatore) |
| `shared/i18n/*.json` | 3 chiavi, tolte a mano dai 12 cataloghi |

- ⚠️ **Il foglio dei QR delle OPERE non c'entra e resta**: e' un'altra rotta
  (`/museums/:qid/qrcodes`), un altro QR (il qid dell'opera, non un collegamento) e una
  richiesta delle slide.
- ⚠️ **Le chiavi sono state tolte a mano, non con `pota`**: il catalogo aveva gia' 14 orfane e
  21 traduzioni mancanti **prima** di questa passata (contato con `git stash`: 513 chiavi /
  492 tradotte / 14 orfane, contro 510 / 489 / 14 adesso). `pota` ne avrebbe cancellate 204 in
  un colpo, che e' un altro lavoro. **La deriva pre-esistente resta aperta**: serve un giro
  `residui` → `traduci` → `pota` → `stato` quando si decide di farlo.
- Verificato in browser forzando il ramo `visitUsable` (senza scrivere niente nel database):
  *Inizia la visita* c'e' ed e' visibile, nessuna `img` verso `/api/qr`, nessuna traccia del
  testo. Sulle rotte: `/api/qr` ora **404**, `/museums/Q51252/qrcodes` ancora **200**.

### 5. Il cancelletto resta

`/vetrina` e' 404 sul nostro server (provato; risponde solo `/`), perche' il marketplace e'
`express.static` sulla radice. Il cancelletto non viaggia verso il server, quindi in
laboratorio si comporta identico. Toglierlo = `pushState` piu' una catch-all da tenere fuori
da `/api`, `/images`, `/maps`, `/dist`, `/i18n` e `/navigator`.

**Verificato pilotando chromium** a 390x844 densita' 3 e a 1440x900, nei due ruoli piu' il
curatore: binario misurato prima e dopo, l'autore che non trova piu' il foglio dei QR, il
curatore che ce l'ha in testa a *Gestione*, e la scansione del QR di una visita da una scheda
senza sessione. **Zero errori in console**, `tsc` verde su server e marketplace, `dist`
ricostruito. Le prove sulle rotte girano su un **secondo server** (`PORT=8100`): sulla 8000
c'e' il tuo, che vede il codice vecchio finche' non lo riavvii.

⚠️ **Il server sulla 8000 va riavviato** perche' il rifiuto della visita vuota entri in vigore:
gira in docker e `ts-node` non ricarica da solo.

## ⏸ Ripresa — 2026-08-07, quattro segnalazioni: l'attesa, il compositore, il vetro, l'iride

Quattro cose in fila. Ragionamento durevole in `state.md` §4.2-bis (l'attesa e i nodi),
§4.13 (il compositore), §4.1 (la barra) e §2.2 (l'iride).

### 1. L'attesa: il compito lungo era il COMPOSITORE, non la vetrina

La passata precedente aveva concluso «restano 20 378 elementi, sono le 128 tessere». Contati
**per sezione** invece che in blocco, non era vero:

| sezione | elementi |
| --- | --- |
| `componi` | **16 253** |
| `catalogo` | 2 110 |
| `vetrina` | 3 175 |

- L'80% della pagina era la **libreria del compositore**: 105 gruppi da 20 descrizioni, tutti
  montati all'apertura del museo perche' le voci di un gruppo stavano dentro un `x-show`.
  `x-show` nasconde, non evita di costruire.
- Passate a `x-if`: **20 385 → 5 432 elementi**, compito lungo **3 082 → 1 049 ms** con la CPU
  rallentata di quattro (a sei: 5,3 s → 1,7 s). Il marchio consegnava gia' 209 fotogrammi con
  buco massimo 31 ms *prima*, e ne consegna 86 con buco 32 ms *dopo*: l'animazione non era
  rotta ne' prima ne' ora — e' l'attesa a essere tre volte piu' corta.
- ⚠️ **Prezzo dichiarato**: via `x-collapse` dai gruppi (vuole un elemento gia' in pagina da
  misurare), quindi un gruppo si apre di scatto.
- ⚠️ **Resta il `catalogo`**, 2 110 elementi montati anche per chi quella rotta non puo'
  aprirla: e' lo stesso difetto un piano piu' su, e non l'ho toccato. Da decidere insieme,
  come il tetto *Mostra altre* sulla vetrina.
- ⚠️ **Sul telefono va riprovato.** Qui il difetto non si riproduceva nemmeno prima.

### 2. Il compositore non e' piu' lungo dieci schermate

Da `lg` la libreria ha un tetto (`70vh`) e scorre da sola: pagina da **9 127 a 1 225 px**.
Sotto `lg` no, ed e' voluto: li' i due pannelli sono due schede, e il tetto lascerebbe un
riquadro di 250 px stretto fra i filtri e la barra di salvataggio.
⚠️ **`shrink-0` sulle righe non e' una rifinitura**: in una colonna flex con un tetto i figli
si schiacciano, e i 105 gruppi erano usciti come 105 filetti da quattro pixel.

### 3. Il vetro e' sparito

`.barra` ha il fondo pieno (`bg-bg`). Con lui sono spariti `--vetro`, `--vetro-fondo`,
`--color-vetro`, l'utility `vetro` e il `@supports` che la promuoveva: era l'unica a usarli.
⚠️ **Nel navigator non c'era niente da togliere**, e non l'ho dedotto: scandagliati biglietteria
e visita in chromium, gli elementi incollati o galleggianti con un fondo traslucido sono
**zero**. Se quel che si vede sul navigator e' un'altra cosa, serve la schermata.

### 4. L'iride: piu' colore, meno verde

Quattro tinte alla stessa croma e alla stessa luminosita' (`oklch(from …)`) e interpolazione
`in oklch`, cioe' per tinta: oro → lime → verde → verderame → blu → ametista. Le posizioni
non sono equidistanti — verde e verderame sono la coppia piu' vicina e si stringono verso
l'inizio, ed e' quello il «troppo verdina».
⚠️ **Sopra ci va inchiostro** (`--on-iride`) e non piu' il bianco: misurato 5,4–6,5:1 al
chiaro e 6,5–7,9:1 al buio, dipingendo su canvas.

**Verificato pilotando chromium**, giro vero (soglia → accesso → Uffizi) da autore e da
visitatore, a 1440x900 e a 390x844: dodici rotte aperte una per una, un gruppo della libreria
aperto davvero (monta le sue 20 voci e i 20 bottoni), la vetrina scorsa nei due formati con la
barra che copre, i due temi. **Zero errori in console** in ogni giro, `tsc` verde, `dist`
ricostruito. **Niente scritto sul database**: si e' entrati con account esistenti e non si e'
comprato niente.

## ⏸ Ripresa — 2026-08-07, il marchio dell'attesa si fermava aprendo un museo

Segnalato dal telefono: premendo *Galleria degli Uffizi* l'attesa «si blocca e poi riprende da
un punto», mentre nel navigator la stessa attesa gira liscia. Ragionamento durevole in
`state.md` §4.2-bis.

- **Non era l'animazione.** Anima solo `transform` con `will-change`, quindi gira sul
  **compositore**: bloccando il filo principale per 5,3 s ha disegnato 307 fotogrammi, buco
  massimo 32 ms, mentre un controllo su `left` restava fermo. Si riscrive niente.
- **Prima correzione: `afterPaint()` anche in TESTA all'attesa** (quattro punti in `state.ts`,
  dove si accende `loading`). Un'animazione arriva al compositore solo se il filo principale
  ha dipinto un fotogramma con lei a schermo: accendere il velo e occupare il filo nello
  stesso compito la lascia ferma al primo fotogramma e poi la fa saltare. Misurato su 3 s di
  blocco: **0 fotogrammi senza, 104 con**.
- **Seconda correzione: il velo e' pieno** (`bg-bg`, era `bg-bg/90`). Velato, le ventimila
  caselle che Alpine sta costruendo sotto vanno ridisegnate e fuse a ogni fotogramma. Il velo
  del navigator era gia' pieno, ed e' la differenza fra le due applicazioni.
- ⚠️ **`dopoIlDisegno` si chiama ora `afterPaint`**: era l'unico nome di metodo in italiano,
  contro la regola 3 (codice in inglese, commenti in italiano).
- ⚠️ **Il compito lungo resta**: 847 ms qui, 3,0 s con la CPU rallentata di quattro, di cui
  796 dentro il ricalcolo di Alpine — 128 tessere, 20 378 elementi in `main`. Un fotogramma
  cade ancora nell'istante in cui la schermata nuova compare. Toglierlo vuol dire disegnarne
  meno, e i costi di quella strada stanno in `state.md` §4.2-bis.

**Verificato pilotando chromium con la CPU rallentata di quattro**, giro vero (soglia →
accesso → *Musei* → Uffizi): 208 fotogrammi dal compositore durante il compito da 3,0 s,
**buco massimo 29 ms**, marchio a inclinazioni diverse lungo tutta l'attesa, velo pieno (di
sotto non traspare piu' niente), atterraggio su `#/home` con 128 tessere, **zero errori in
console**. `tsc` verde, `dist` ricostruito.

⚠️ **Il difetto non si riproduce in locale**, nemmeno rallentando la CPU di sei e servendo il
catalogo dalla cache: e' dimostrato sui meccanismi, isolati, non sulla schermata vera. **Va
provato sul telefono.**

## ⏸ Ripresa — 2026-08-07, la seconda scheda restava appesa

Segnalato: «apro il sito dal browser, poi lo riapro in una pagina nuova sul telefono e non
carica, resta fermo». Ragionamento durevole in `state.md` §1.1-nonies.

- **Era `keepAliveTimeout`**, il valore di fabbrica di Node: cinque secondi. Il pozzo dei
  socket è del browser e non della pagina, quindi la seconda scheda **riusa** una connessione
  ferma della prima, e la riusa proprio mentre il server la sta chiudendo. Corretto in fondo a
  `server/src/index.ts`: 65 s, con `headersTimeout` a 66 s (deve restare il maggiore).
- Misurato prima e dopo tenendo un socket fermo e poi riusandolo: a 6 s di inattività prima il
  server **chiudeva invece di rispondere**, ora risponde in 11 ms.
- ⚠️ **Non è riproducibile in Chromium headless in locale**: su un collegamento veloce la
  finestra della corsa è troppo stretta. Il difetto è dimostrato *sul server*, non nel browser
  — se il telefono lo rifà, l'ipotesi va riaperta, non data per chiusa.
- ✅ **In laboratorio non c'era**, misurato sul sito vero col codice di prima: davanti c'è
  nginx e il browser gli parla in **HTTP/2**, quindi il pozzo di sei socket non esiste; e
  `site252627` ha risposto **10/10 con 200** con pause di 5-10 s. La correzione serve dove il
  difetto è stato trovato, cioè col telefono che parla direttamente col nostro processo.
- ✅ **Anche i cataloghi delle lingue**, trovati per strada e corretti: `i18n.ts` ne murava
  dentro **dodici** (437 KB, 141 compressi) per servirne uno. Tolto `{ eager: true }` dal
  glob, il programma compilato scende da **260 a 114 KB compressi** e il catalogo diventa un
  pezzo a parte da 12-14 KB. Ragionamento in `state.md` §2.3-bis.
- ⚠️ **La trappola che ne è uscita**, e vale oltre l'i18n: `t` è reattivo solo dentro un legame
  o un `computed`. `App.vue` memorizzava il risultato di `t()` dentro `erroreAvvio`/`testoAvvio`
  e con un catalogo che arriva dopo quella schermata restava in italiano. **Un messaggio che
  vive in un `ref` ci sta come chiave, non come frase tradotta.**

## ⏸ Ripresa — 2026-08-07, le miniature: il telefono scaricava figure da 960 px

Segnalato: aprendo l'applicazione da un telefono sulla rete di casa (`ip:8000`) è «really
really slow, ma non sempre», col sospetto di una porta occupata. Ragionamento durevole in
`state.md` §7-ter.1.

- **Non era la porta** e non era il server: un solo processo in ascolto sulla 8000, uno sulla
  5173, le rotte rispondono in 4-11 ms e il catalogo compresso pesa 52 KB. Erano le **figure**,
  e il «non sempre» era la cache — `/images` è `immutable, 30d`, quindi il primo giro è lento e
  il secondo istantaneo.
- **Due secchielli invece di uno**: `Q123.jpg` (960, l'opera aperta) e `Q123-c.jpg` (500, le
  tessere). Il nome lo calcola `percorsoMiniatura` in `shared/constants.ts`, perché è un
  accordo fra chi scrive i file e chi li chiede.
- ⚠️ **Non esiste una taglia intermedia da comprare**: misurato su un Duccio, `?width=500` dà
  500×817 (148 KB) mentre `600`, `700` e `800` danno **tutti** il file da 960 (469 KB). O 500
  o l'originale.
- ⚠️ **Lo spreco più grosso era lo SFONDO della soglia, non la vetrina**: il retino campiona
  a 240 px e scaricava figure da 960 — 6 figure per 1708 KB sulla prima schermata. Ora 462 KB.
- ⚠️ **La miniatura si scrive sempre, e in mancanza è una copia dell'originale**: il client il
  nome lo calcola e non può chiedere se il file c'è. Al primo giro **5 opere su 198** hanno
  preso la copia, perché 198 richieste di fila fanno scattare il **429** di Wikimedia. Da lì la
  pausa di mezzo secondo, e il riconoscimento della copia dalla dimensione identica
  all'originale, che la fa riprovare al giro dopo.
- ⚠️ **Falso positivo dichiarato**: se l'originale è già più stretto di 500 px, Wikimedia
  risponde col file stesso e la miniatura è identica per davvero. Sono **3 su 198**, e costano
  una richiesta inutile a ogni giro del comando. Distinguerle vorrebbe dire leggere la
  larghezza, cioè la libreria d'immagini che tutto questo esiste per non avere.
- **`testers.ts miniature`** riempie le opere già sul disco: richieste HTTP, **nessuna chiamata
  al modello**. Eseguito: **198 miniature**, una per ogni opera del database. I due file senza
  (`Q151952`, `Q724954`) sono orfani di un seed vecchio: nel database non ci sono.

**Verificato pilotando chromium a 390×844 densità 3**, cache vuota, entrando con
`visitatore1` e senza comprare niente: la vetrina scorsa fino in fondo chiede **11 figure,
tutte miniature, 1106 KB, zero originali, zero 404, zero errori in console**; la prima tessera
è una casella 356×267 servita da un file 500×589. Miniatura e originale confrontati a schermo
nella stessa casella: la differenza si vede solo mettendoli vicini. `tsc` verde su server e
marketplace, `vue-tsc` verde sul navigator, `dist` ricostruito.

⚠️ **Il navigator non è stato toccato**: mostra le figure grandi, dove servono grandi. Se un
giorno anche lì comparisse una griglia di anteprime, `percorsoMiniatura` è già condivisa.

## ⏸ Ripresa — 2026-08-06, le sale vuote degli Uffizi

Richiesta: riempire le sale vuote con almeno due opere ciascuna, opere vere, coi qid
controllati uno per uno prima di scriverli. Ragionamento durevole in `state.md` §1.1-octies.

- **25 opere nuove**, `art-105`..`art-129`, config da 104 a 129 qid. Quattordici sale
  passano da zero o una a due o piu': San Pier Scheraggio, Sale 16, 17, 24, 35, 42, 49, 50,
  51, 74, 75, 92, il Gabinetto dei Disegni e la Collezione Contini Bonacossi.
- **Controllati contro Wikidata uno per uno**, non a memoria: etichetta, autore, tipo,
  presenza di `P18`, e l'appartenenza al museo con la STESSA interrogazione del server
  (`P195/P361* -> Q51252`). Lo script sta nello scratchpad: **33 qid controllati, 25 usati** —
  4 scartati perche' senza immagine, 2 perche' agli Uffizi ci stanno per `P276` e non per
  collezione, 1 perche' era un doppione, 1 rimasto in panchina.
- ⚠️ **Il seed salta le opere senza immagine** (`manager.ts populateArtwork`): un qid senza
  `P18` si scrive nel config, non da' errore e non arriva mai nel database. Quattro scelte
  sono state rifatte per questo (soffitto delle Carte Geografiche, Cinghiale, Sileno ebbro,
  gruppo di Niobe).
- ⚠️ **Un `data-qid` doppio sposta l'opera nella sala sbagliata in silenzio**: `Q15974356`
  (Veronese) era gia' `art-92` in Sala 84 e stava per essere messo anche nella Contini
  Bonacossi. Trovato col controllo incrociato config/mappa, non guardando.
- ⚠️ **`P18` presente non vuol dire opera giusta.** `Q1841379` (*Gradiva*) passava ogni
  controllo automatico — immagine, collezione Uffizi — ma la sua stessa descrizione dice
  «bassorilievo ospitato nei **musei vaticani**» e porta due collezioni. L'elemento confonde
  l'originale vaticano con la replica: sostituito col *Britannico in toga*, che di collezione
  ne ha una sola. Il controllo che l'ha visto e' stato **leggere la descrizione**, dopo che
  il nome del file dell'immagine parlava di un altro rilievo.
- ⚠️ **Le coppie `(art-N, data-qid)` di prima non sono cambiate** (verificate contro `git show`
  una per una): `locationId` nel database e' quell'`id`. In Sala 2 le quattro opere si sono
  spostate di 15 unita' in x per far posto alla quinta — la posizione si puo' cambiare, l'id no.
- **`data-flow="52"` su San Pier Scheraggio**, che non ne aveva: con delle opere dentro, il
  collaudo delle piante avverte che finirebbero in fondo all'ordine di percorrenza.
- ⚠️ **`Q3698238` non e' piu' orfana**: `art-105` in Sala 2. Chiude la decisione lasciata
  aperta nella ripresa del ridisegno delle piante.

**Verificato**: `testers.ts mappe` pulito su tutte e quattro le piante; ogni nodo nuovo cade
nella sala voluta (parser vero); e in chromium sul disegno, dove i 25 nodi stanno dentro il
muro della loro sala e non toccano ne' le scritte dei nomi ne' altri nodi — il primo giro
diceva che `art-105` toccava le quattro opere della Sala 2, ed e' per questo che la sala e'
ora su tre colonne.

⚠️ **Il database non ha ancora queste opere**: vanno seminate con
`npx ts-node src/scripts/seed.ts Q51252`, che salta le 104 che ci sono gia'. Sono ~25 opere
nuove, cioe' circa mezz'ora di chiamate al modello. Fino ad allora la pianta mostra nodi che
il catalogo non conosce.

## ⏸ Ripresa — 2026-08-06, le note d'apertura uscivano dallo schermo

Segnalato: le logistiche iniziali del navigator vanno fuori schermo. Ragionamento durevole in
`state.md` §5.3-octies.

- **La finestra ha un tetto e a scorrere e' l'elenco delle note**: `max-h-[85dvh]` sul riquadro,
  `min-h-0 overflow-y-auto` sull'elenco, `shrink-0` su titolo e bottoni. Stessa forma del
  pannello del docente in `GuidedGate.vue`. Applicato anche alla finestra di **fine visita**,
  che e' lo stesso riquadro con le stesse note.
- ⚠️ **Traboccava in ALTO, non in basso**: sotto `sm` il riquadro e' appoggiato al fondo
  (`items-end`), quindi a uscire erano il titolo e le prime note. Misurato a 390x664: finestra
  863 px, 215 px sopra il bordo, e su un velo `fixed` non c'e' niente da scorrere per
  raggiungerli.
- ⚠️ **Senza `min-h-0` il tetto non serve a niente**: un elemento flex non scende sotto il
  proprio contenuto finche' ha `min-height: auto`.
- ⚠️ **Il numero delle note non lo decide piu' la visita** (§5.3-septies): sono quelle del museo
  piu' quelle dell'autore. Agli Uffizi sono cinque e lunghe; gli altri tre musei ne hanno zero
  nel config, ed e' per questo che il difetto si vede solo li'.

**Verificato pilotando chromium** su quattro riquadri (390x664, 390x500, 740x360, 1280x800) con
la visita vera degli Uffizi: finestra e bottoni dentro lo schermo, l'ultima nota raggiungibile
scorrendo, *Continua* premuto davvero (chiude e apre la prima tappa). Zero errori in console,
`vue-tsc` verde. **Niente scritto sul database**: si e' entrati con `visitatore1` e non si e'
comprato niente.

## ⏸ Ripresa — 2026-08-06, il catalogo del curatore mostrava descrizioni al posto delle opere

Segnalato: nel filtro del catalogo "Opere" elencava le descrizioni delle opere, non le opere.
Ragionamento durevole in `state.md` §1.1-septies.

- **Due assi invece di uno**: *Tipo* (Tutto · Opere · Descrizioni · Visite) e *Soggetto*
  (Tutti · Opere · Autori e stili), che compare solo dove in tabella ci sono descrizioni.
- **La riga-opera** porta codice Wikidata, numero di descrizioni e l'artista; tono, durata e
  prezzo dicono `n/d`, e i filtri su quei campi tengono le opere fuori invece di svuotare la
  tabella. L'azione e' **Rimuovi**, con la scelta sulle visite.
- ⚠️ **Il vecchio valore `meta` del filtro non esiste piu'**: era `catalogTypeFilter`, ora e'
  `catalogSubjectFilter`. Chi avesse un collegamento salvato a quella schermata non se ne
  accorge, perche' il filtro non sta nell'indirizzo.

**Verificato in chromium** contando le righe di ogni combinazione sugli Uffizi: Tutto 2248
(105 + 2120 + 23), Opere 105, Descrizioni 2120 (2080 su opere, 40 su autori e stili), Visite 23.

## ⏸ Ripresa — 2026-08-06, rimuovere un'opera senza buttare via le visite

Segnalato provando a togliere dal catalogo un'opera che il config non elencava piu': la cascata
si portava dietro **ventidue** visite degli Uffizi, la guidata compresa. Ragionamento durevole in
`state.md` §1.1-sexies.

- **`dbActions.rimuoviTappeDalleVisite`**: toglie la tappa e rimette a posto quel che le era
  appeso — tappe facoltative, note logistiche ancorate (scendono alla tappa valida che le
  precede), durata, domande del quiz che nominavano l'opera. Sparisce solo la visita che resta
  **senza tappe**.
- **La scelta e' del curatore**: `?visite=accorcia|elimina` su `DELETE /api/artworks/:qid` e su
  `DELETE /api/items/:id`. Nella conferma del marketplace ci sono le due opzioni con l'esito
  scritto sotto, e si parte da quella che distrugge meno. Il bottone ora dice **Rimuovi**.
- **`GET .../impact`** dice anche quante visite resterebbero vuote (`svuotate`), non solo quante
  sono toccate: e' la differenza fra le due strade.
- ⚠️ **Il dialogo elencava tutti i nomi delle visite** e con ventidue spingeva i bottoni fuori
  dallo schermo. Ora ne nomina tre e conta le altre, e la finestra scorre.

**Verificato**: due giri su documenti finti (opera + 2 descrizioni + 2 visite) che controllano
uno per uno nota, durata, quiz, tappe facoltative e visita svuotata, in tutti e due i modi; poi
il dialogo vero in chromium, aperto e annullato senza toccare niente.

## ⏸ Ripresa — 2026-08-06, le quattro piante ridisegnate sui musei veri

Richiesta: piante molto piu' ricche e dettagliate, gli Uffizi il piu' possibile fedeli al museo
vero, anche su piu' piani. Ragionamento durevole in `state.md` §1.1-quinquies.

- **Uffizi: 3 piani, 60 sale, 104 opere** con i nomi e i numeri veri (Sala 2 Giotto, Sale 11-14
  Botticelli, Sala 18 Tribuna disegnata come ottagono, Sale Rosse e Caravaggio al primo piano,
  San Pier Scheraggio e il bookshop al piano terra). Il senso unico e' nel grafo: lo Scalone
  Vasariano sale dall'atrio al secondo piano, la Scala del Buontalenti scende al primo e
  all'uscita, e **atrio e bookshop non sono collegati fra loro**.
- **British 2 piani / 22 sale, Louvre 3 piani / 27 sale, Metropolitan 2 piani / 24 sale**, ognuno
  con la sua forma vera: il tamburo della Reading Room dentro il Great Court, la Cour Napoleon
  aperta a ovest con l'atrio a rombo sotto la piramide, il Met senza corridoi.
- **Le coppie `(id="art-N", data-qid)` sono identiche a prima** su tutte e quattro: `locationId`
  nel database e' quell'`id`, e cambiarlo avrebbe spostato ogni opera sul nodo sbagliato **senza
  dare errore**. Confrontate una per una prima di scrivere.
- **Aggiornato** `Galleria degli Uffizi.json`: le note logistiche raccontavano il vecchio giro
  (prima Ponente, caffetteria in fondo a Levante). Ora dicono il giro nuovo, che e' quello vero.
- ⚠️ **Il seed non va rifatto**: `locationsFromMap` cerca per qid e le coppie non sono cambiate.
  Cambia invece l'ORDINE del catalogo, perche' i `data-flow` sono nuovi (`sortByFlow`).

**Verificato col parser vero** (`parseSvg` + `computeDirections`, non a occhio): ogni nodo dentro
una sala, nessun `data-flow` doppio, tutte le sale raggiungibili dall'ingresso (22/22, 24/24,
27/27, 60/60), percorsi di prova fra piani diversi. E in chromium, per il disegno: i due difetti
che si vedono e non si leggono erano un muro che si allungava fino al varco della sala accanto e
il nome della sala scritto sotto i nodi delle opere.

**Poi e' saltato fuori il vero difetto: le visite seminate non erano in ordine di percorrenza.**
`sortByFlow` ordinava il catalogo e la visita su misura, ma le visite che scrive il seed
prendevano le tappe nell'ordine di `ItemModel.find`, cioe' l'ordine di scrittura del database.
Era cosi' da sempre; con le piante a un piano solo si vedeva poco, con i piani si vedeva subito.

- **`seed.ts`**: `inOrdineDiPercorso` ordina le tappe col `data-flow` della mappa, sia nelle otto
  visite per museo sia nelle due speciali. Passa dal qid dell'opera, perche' la tappa e' un item.
- **`testers.ts percorso`**: riallinea le visite gia' nel database senza rigenerare niente.
  Tocca solo i `@id` che cominciano per `visit-` (il prefisso del seed): `tour-…` e `custom-…`
  hanno l'ordine che ha scelto un autore. Nel percorso con contenuti opzionali gli opzionali
  tornano a essere la seconda meta' del cammino, che e' la regola del seed.
- **Eseguito**: 82 visite riordinate. Verificato leggendo il database e rimappando ogni tappa
  sulla sua sala: **zero passi all'indietro** e **un solo cambio di piano** per visita (due al
  Louvre, che di piani ne ha tre).

**E poi il difetto vero del `data-flow`: crescere non vuol dire camminare.** Segnalato guardando
il Louvre: la tappa 25 sta al secondo piano e la 24 dall'altra parte. I numeri salivano, ma fra
due numeri consecutivi ci potevano essere cinque sale. Misurato con la distanza sul grafo:
2 salti sugli Uffizi, 2 sul British, 5 al Louvre, 5 al Metropolitan.

- **Rinumerati i `data-flow`** delle quattro piante: ora ogni passo del percorso e' di **una o
  due sale** (due = si passa dal corridoio, che e' una sala anche lui). Zero salti su tutte.
- **Louvre**: la scala che sale sta ora dove il giro del piano di sotto finisce (Caryatides →
  Grande Galerie, Appartamenti → Pittura francese del Settecento), non piu' in mezzo al piano.
- ⚠️ **Le opere non si sono spostate**: sono cambiati solo i numeri d'ordine delle sale, quindi
  le coppie `(id, data-qid)` e le posizioni sulla pianta sono le stesse.

**Un'opera stava nella sala sbagliata perche' la mappa vecchia la chiamava con un altro nome.**
`Q959174` portava `data-label="Crocifisso con storie della Passione e della Redenzione"`, e su
quel titolo l'avevo messa nella sala del Duecento: e' invece il *Ritratto d'uomo con medaglia di
Cosimo il Vecchio* del Botticelli. Etichetta corretta e nodo spostato nelle Sale 11-14. Trovata
confrontando i `data-label` della pianta coi nomi nel database: su 104 nodi ballavano solo due
titoli, e l'altro (`Q1569622`) e' la stessa opera detta col nome corto, non un errore.

⚠️ **Nel database c'e' una 105esima opera degli Uffizi**, `Q3698238` (*Crocifisso con storie
della Passione e della Redenzione*, Maestro della Croce 432), con 20 descrizioni gia' scritte,
FUORI da `activeArtworks` e senza nodo sulla pianta. Si porta dietro un `locationId` vecchio
(`art-1`) che oggi punta al nodo del Botticelli. Da decidere: darle un nodo in Sala 2 e
aggiungerla al config (non costa chiamate al modello, le descrizioni ci sono), oppure toglierla
con la cascata di `DELETE /api/artworks/:qid`.

**Perche' non ricapiti: il controllo e' un comando.** `testers.ts mappe` collauda le piante
(nodo fuori sala, ostacolo fuori sala, ingresso mancante, sala irraggiungibile, `data-flow`
doppio, sala con opere ma senza flusso, e il SALTO fra due tappe consecutive), piu' le opere del
config che sulla pianta non hanno un nodo. Non tocca il database e non gli serve: gira su una
copia appena scaricata, prima del seed. `testers.ts stato` lo esegue e in piu' dice quante
visite seminate si sono allontanate dalla loro mappa, col comando per rimetterle in fila.

⚠️ **Il database e' rimasto indietro, e va riallineato quando decidi tu.** Le visite seminate
erano state riordinate col `data-flow` di prima: agli Uffizi non cambia niente (le due sale
scambiate non hanno opere), ma British, Louvre e Metropolitan no. `stato` ne conta **60**. Si
sistema con `testers.ts percorso` oppure rifacendo il seed, che ormai ordina da solo.

⚠️ **Da provare quando il navigator e' su**: la pianta dentro l'app (selettore dei piani,
inquadratura per piano, numeri delle tappe sui dischi). Il `getBBox` di ogni gruppo `data-floor`
e' gia' stato controllato in chromium sul file SVG e inquadra solo il suo piano.

## ⏸ Ripresa — 2026-08-06, la visita su misura non e' roba da autore

Segnalato: un autore poteva farsi comporre una visita a parole, ma quella visita **non si
salva nel database**, quindi non e' una cosa che un autore possa fare. Ragionamento durevole
in `state.md` §4.13-bis.

- **Sparita la striscia** «Raccontala a parole» dal compositore quando chi lo apre e' un
  autore: la sola strada che ce lo portava.
- ⚠️ **Nascondere l'invito non basta**: l'indirizzo si scrive a mano, e chi ci arrivasse
  scoprirebbe che la visita e' evaporata **dopo** averla camminata. `applyRoute` rimanda
  percio' l'autore alla sua casa se chiede `#/sumisura`.
- ⚠️ **Il curatore non e' nominato**, ed e' voluto: oggi non ha nessuna strada per arrivarci,
  e una regola scritta per un caso che non esiste e' una riga che nessuno potra' provare. Il
  giorno che ne avesse una, il ragionamento e' lo stesso ed e' scritto accanto al controllo.
- **Non toccata la biglietteria del navigator**, che la composizione a parole ce l'ha per
  conto suo: li' si sta camminando nel museo, e quell'app i ruoli non li conosce.

**Verificato in chromium, cinque controlli**: autore nel compositore → zero inviti; autore che
scrive `#/sumisura` → torna su `lavori`; visitatore → invito nella home e nel compositore, e
la schermata si apre normalmente. Zero errori in console.

## ⏸ Ripresa — 2026-08-06, la copertina di una visita

Richiesta: una visita deve poter mostrare un'immagine nel marketplace, facoltativa, e dove
c'e' va vista come si vedono le opere; senza, resta il fondo colorato di adesso. Ragionamento
durevole in `state.md` §2 (il campo) e §4.6-bis (la tessera).

- **`Visit.imagePath`**, facoltativo, piu' il campo nel passo 2 del compositore e la tessera
  che diventa quella di un'opera (dissolvenza, titolo che risale nella coda). Senza immagine
  **non cambia niente**: titolo sulla struttura, come sempre.
- **Zero rotte nuove**: si carica con `POST /api/items/image`, la stessa degli item, e il file
  finisce nella stessa cartella. E' lo stesso gesto e lo stesso file su disco; una seconda
  rotta identica sarebbe solo un altro posto in cui sbagliare l'elenco dei formati.
  Stessa cosa per il client: `caricaImmagine()` e `draft.immagine` **esistevano gia'** —
  l'editor delle descrizioni e il compositore condividono la bozza.
- ⚠️ **Il campo si scrive sempre, anche vuoto, e vale `null` e non `undefined`**: Mongoose
  salta i campi `undefined` in un aggiornamento, quindi con `undefined` una copertina non si
  sarebbe piu' potuta **togliere**. E' il difetto che non si vede provando solo ad aggiungerla.
- ⚠️ **L'immagine vecchia va tolta dal disco** quando cambia e quando la visita si elimina. La
  cancellazione legge il documento **prima** di rimuoverlo (`findOneAndDelete` al posto di
  `deleteOne`): il documento e' l'unico posto che conosce il nome del file.
- **L'anteprima nel compositore non e' decorazione**: riaprendo una visita gia' pubblicata,
  senza di quella non si saprebbe che una copertina c'e', e non sapendolo non la si potrebbe
  togliere.

**Provato in chromium sul giro intero**, con il file che entra dall'input vero
(`DOM.setFileInputFiles`) e non dall'API: carica → anteprima e bozza; salva → `imagePath` sul
documento; vetrina → tessera con la figura e senza copertina tipografica; pagina della visita
→ figura alta 288 px; riapre → anteprima presente; toglie e salva → campo vuoto **e file
sparito dal disco**; elimina la visita → via anche lei. Zero errori in console, `tsc` verde su
marketplace e server. **Dato di prova rimosso**: la visita `PROVA copertina` e la sua immagine
non ci sono piu' (verificato su Mongo e sulla cartella).

⚠️ **Non toccati di proposito**: le righe delle visite in **libreria** e in **lavori**, che
non mostrano figure nemmeno adesso. Darle vorrebbe dire una seconda forma di riga accanto a
quella coi bottoni, e la richiesta era la vetrina. Il navigator ignora il campo.

⚠️ **La prova gira su un secondo server** (`PORT=8100`): sulla 8000 ce n'e' gia' uno acceso,
e il codice nuovo lo vede solo un processo riavviato.

## ⏸ Ripresa — 2026-08-06, il marchio nuovo: l'angolo della sala

Richiesta: il marchio sembrava fatto da una macchina, e si voleva qualcosa di originale —
«un'illusione ottica? un cappio strano?». Ragionamento durevole in `state.md` §4.2.

- **Il segno e' l'angolo di una sala in assonometria**, con un quadro appeso su ognuna delle
  tre facce: figura ambigua della famiglia del cubo di Necker, si legge come l'angolo dentro
  cui si sta e come uno spigolo che sporge in fuori. I quadri sono **doppi** (cornice piu'
  battuta): e' quel che gli da' profondita', ed e' il costo scelto sapendolo — sotto i 28 px i
  due rombi si impastano.
- ⚠️ **I tre spigoli interni vanno ai due vertici alti e a quello in basso.** Nella prima
  stesura finivano sul vertice in cima e su quello in basso a sinistra: due tratti che
  **tagliavano le facce** invece di disegnare dove i muri si toccano. Segnalato guardando, non
  dedotto — l'elenco delle facce e quello degli spigoli devono essere d'accordo e nessuno dei
  due controlla l'altro, quindi l'errore compila e si vede solo a schermo.
- ⚠️ **`logo.svg` e' lo stesso disegno, non una seconda versione.** Il marchio di prima aveva
  un arco **tratteggiato** che alla favicon diventava poltiglia, e per esistere aveva bisogno
  di due disegni: e' proprio quel difetto ad aver aperto la questione. Qui cambiano solo i
  colori — fuori da una pagina non c'e' nessun `currentColor` — e a 16 px resta leggibile un
  cubo con tre macchie chiare.
- **La geometria la calcola uno script** (`genera2.mjs` nello scratchpad), non la mano: sono
  una trentina di vertici e mezzo punto di scarto e' esattamente dove l'illusione muore. Nel
  sorgente finiscono i numeri, non il generatore.

⚠️ **Provata e scartata la scala di Penrose.** Una scala infinita in assonometria non si chiude
per costruzione: sullo schermo l'altezza accumulata non torna a zero, e il disegno regge solo
se un angolo **nasconde** il salto dietro la rampa vicina. Senza quell'occlusione esce una
scala rotta, ed e' quel che ha prodotto il primo generatore.

**Verificato pilotando chromium**: il marchio a 128/64/32/16 px come favicon (fondo struttura,
spigoli chiari, quadri d'accento), sulla soglia e nel binario a 28 px, nei due temi. Zero
errori in console.

## ⏸ Ripresa — 2026-08-06, si apre in italiano, e la lingua si sceglie sulla soglia

Segnalato: aprendo una scheda nuova l'applicazione resta nella lingua di prima, e si vuole
partire in italiano. Ragionamento durevole in `state.md` §5.7.

- **Non se la ricordava la scheda, se la ricordava l'ORIGINE**: la scelta stava in
  `localStorage` sotto `artaround-lang`, che tutte le schede di quell'origine condividono e
  che sopravvive alla chiusura del browser. Ora sta in **`sessionStorage`**: vale per la
  scheda, come la sessione, quindi ogni apertura nuova riparte in italiano e una scelta fatta
  chissa' quando non vince piu' su tutte le successive.
  ⚠️ **Costo dichiarato**: la lingua non sopravvive alla chiusura della finestra. Il passaggio
  al navigator invece regge, perche' avviene nella stessa scheda (`location.href`) e in
  produzione l'origine e' una sola; in sviluppo le due porte sono diverse e non se la
  passavano nemmeno prima.
- **Cambiato anche il ripiego**: `pickLanguage` non guarda piu' la lingua del
  **dispositivo**. Ora sono due casi soli: la lingua gia' scelta, altrimenti l'italiano.
  ⚠️ **Il ripiego non era un errore e va saputo perche' c'era**: copriva la prima schermata,
  che si legge prima di poter scegliere. Il difetto era che leggeva nel pensiero — un browser
  in inglese apriva in inglese un'applicazione italiana, e non si vedeva da dove venisse.
- ⚠️ **Al suo posto c'e' un controllo, e le due cose stanno insieme**: il selettore della
  lingua e' ora **sulla soglia**, cioe' proprio nella schermata che il ripiego copriva.
  Togliendolo di li' si torna al problema che il ripiego risolveva, e allora la scelta va
  ridiscussa. E' scritto sopra `pickLanguage`.
- `pickLanguage` ha perso il secondo parametro, e con lui i due chiamanti la loro
  `navigator.languages`.

**Verificato in chromium con il browser configurato in inglese**, che e' esattamente il caso
che prima decideva da solo, e **lasciando apposta un vecchio `en` in `localStorage`**, che e'
il caso in cui il difetto si era visto:

| prova | esito |
| --- | --- |
| apertura, `en` vecchio in `localStorage` | **italiano**, `<html lang="it">`, «Entra nel marketplace» |
| scelta English dalla soglia | subito inglese, `sessionStorage=en` |
| stessa scheda, ricaricata | resta inglese |
| **scheda nuova** | **italiano**, mentre l'altra resta inglese |

Zero errori in console, `dist` ricostruito, `vue-tsc` verde. Nessuna chiave nuova: il
selettore riusa `Lingua`.

## ⏸ Ripresa — 2026-08-06, due porte sulla soglia

Richiesta: dalla soglia si deve poter entrare anche nell'app da museo, non solo nel
marketplace; in tutt'e due i casi prima si accede, e chi ha chiesto l'app da museo si ritrova
nel selettore della visita. Ragionamento durevole in `state.md` §4.2.

- **`Entra nel marketplace` e `Entra nell'app da museo`**, e portano tutt'e due ad `accedi`:
  l'accesso e' uno solo perche' il navigator sta su un'altra origine e l'unico modo che ha di
  sapere chi e' entrato e' il biglietto coniato di qua, che pero' si conia solo avendo gia'
  una sessione. La scelta e' percio' un'intenzione (`entryTarget`) tenuta da parte fino a
  dopo il login.
- **Si esce senza `?visit=`**, ed e' quello a far atterrare il navigator in biglietteria.
- ⚠️ **`entryTarget` sta in memoria e non in `localStorage`**: e' la porta di QUESTO ingresso.
  Salvandola, un ricaricamento qualunque mesi dopo spedirebbe nell'app da museo chi voleva
  solo rileggere la vetrina.
- ⚠️ **L'intenzione si consuma solo se il viaggio parte davvero**: se il biglietto non si conia
  si resta nel marketplace con l'avviso, e si puo' ritentare. `openNavigator` per questo
  adesso torna un booleano.
- ⚠️ **Il controllo sta PRIMA di `loadCatalogue`**, in `initApp` e in `selectMuseum`: chi sta
  uscendo non deve aspettare il catalogo degli Uffizi per una schermata che non vedra'.
- Il navigator vuole un museo, quindi chi non ne ha uno ricordato passa lo stesso da `musei`;
  scegliendolo, parte da li'.

**Provato coi gesti veri** (bottone, modulo, *Accedi*) e non pilotando lo stato, con il
navigator davvero acceso su :5173:

| caso | esito |
| --- | --- |
| porta app da museo, museo ricordato | `localhost:5173/?museum=Q51252&handoff=…` → «Scegli la tua visita» |
| porta app da museo, nessun museo | `musei` → scelta Uffizi → stesso indirizzo, stessa schermata |
| porta marketplace | `home`, museo Q51252, `entryTarget` tornato a `marketplace` |

Zero errori in console in tutt'e tre. **Catalogo 504 chiavi, 12 lingue piene, zero orfane**
(tre chiavi nuove, tradotte con `languages.ts traduci`).

## ⏸ Ripresa — 2026-08-06, la visita si tocca tutta, il percorso e' a tessere, il tono ha un colore

Tre richieste in fila. Ragionamento durevole in `state.md` §4.6 (la tessera), §4.8 (i filtri
e i toni) e §4.9 (il percorso).

- **La tessera di una visita si apre da qualunque punto**, non piu' dalla sola copertina:
  `.tessera-intera` stesa su tutta la carta, e il titolo e' tornato un titolo.
  ⚠️ **I bottoni dentro vanno sollevati** (`relative z-30`): il velo del collegamento e' a
  `z-20` e se li mangia. Il difetto non darebbe errori — il clic finisce sul collegamento e
  la scheda si apre lo stesso, quindi *Inizia* sembra funzionare mentre non avvia piu'
  niente. E' scritto ora accanto a `.tessera-intera`.
- **Il percorso di una visita e' una griglia di tessere** con la figura dell'opera, il numero
  sulla figura e le due pastiglie (tono e durata). In riga se ne leggevano quattro per
  schermata, con la fotografia ridotta a una striscia da 136 px.
  ⚠️ **Le note logistiche restano dentro la tappa a cui sono agganciate**: e' li' che il
  navigator le fa sentire. Una tappa con una nota e' semplicemente una cella piu' alta.
- **Il tono ha un colore**, uno per gradino: azzurro, blu, giallo, arancio, dal freddo al
  caldo man mano che la lettura si fa difficile. I quattro token stanno in `theme.css`
  accanto ai ruoli semantici.
  ⚠️ **Il nome della classe si ricava dal tono** (`toneClass`), quindi non c'e' una seconda
  lista da tenere allineata a `educationalLevelHints`: un tono senza la sua riga in
  `components.css` esce come pastiglia neutra.
  ⚠️ **Si misura DENTRO la pastiglia**, dove il fondo e' la velatura della stessa tinta: sulla
  lastra l'arancio passava, nella pastiglia stava a 4,4:1 ed e' stato scurito.
- **I due filtri della vetrina anche nella pagina di un'opera**, con le voci di quell'opera.
  ⚠️ **Memoria loro e non quella della vetrina**: li' la durata, quando si guardano le visite,
  e' una fascia di minuti che nessuna descrizione ha, quindi arrivando da una vetrina
  filtrata per visite brevi l'opera si sarebbe aperta vuota.

⚠️ **Trappola della misura, non del codice, e mi ha fatto vedere quattro difetti che non
c'erano.** Al buio i colori calcolati escono in `oklch()`, e la sonda leggeva i tre numeri
come se fossero r, g, b: usciva 1,17:1 dove il vero valore era 5,39:1. Si convertono
dipingendoli su una `<canvas>` da un pixel, che e' l'unico modo di ottenere il valore sRGB
davvero mostrato.

**Verificato pilotando chromium**, zero errori in console: i tre punti della tessera di una
visita col bersaglio del punto (copertina e corpo rispondono al collegamento, il bottone
resta suo) — **senza premere niente, perche' quel bottone compra**; il percorso a 3 colonne
con figure, numeri e la nota al posto giusto; gli otto contrasti dei toni nei due temi, tutti
sopra 4,5:1; i filtri (20 → 5 col tono, → 1 aggiungendo la durata, → 20 azzerando). Tre
build verdi (`tsc` del marketplace, CSS, e il navigator, che monta gli stessi due fogli).

## ⏸ Ripresa — 2026-08-06, la scheda dell'opera: il posseduto e lo spazio

Richiesta: nella scheda di un'opera in vetrina, chi guarda deve vedere **da un bordo diverso**
quali descrizioni ha gia', e le descrizioni devono smettere di stare incolonnate in mezzo
schermo. Ragionamento durevole in `state.md` §4.8.

- **`.lastra-posseduta` e' il BORDO INTERO** in acquisito piu' una velatura della stessa tinta,
  non piu' un filo di 3 px sul lato sinistro. Il filo, in mezzo a venti tessere uguali, non si
  distingueva dal margine.
  ⚠️ **Vuole una lastra che non si accende d'accento al passaggio**: dove il bordo e' gia' il
  segnale di «ci puoi andare» i due si darebbero fastidio. Per questo sta nella scheda
  dell'opera e non sulle tessere della vetrina.
  ⚠️ La velatura e' `background-image`, non `background-color`: assegnata al colore di fondo
  sostituirebbe `bg-surface`, e la tessera posseduta uscirebbe **piu' scura** delle altre invece
  che piu' segnata.
- **Le descrizioni prendono tutta la larghezza**, `sm:grid-cols-2 xl:grid-cols-3`. Erano una
  colonna dentro la meta' destra della pagina: un'opera ne ha una ventina, quindi due schermate
  di scorrimento con mezzo schermo vuoto accanto.
  ⚠️ **`items-start` sulla griglia**: senza, aprire una descrizione allunga tutta la riga e le
  vicine restano vuote alte quanto il testo aperto. Misurato: 373 px la aperta, 152 le vicine.
  ⚠️ **La terza colonna solo da `xl`**: a 1024 px una tessera da tre colonne non tiene *Leggi* e
  *Tieni in libreria* sulla stessa riga.
- **L'intestazione e' una fascia**, immagine e testo affiancati e centrati, e la figura si stringe
  con un tetto in **altezza** (`max-h-72 w-auto`).
  ⚠️ **Il tetto e' in altezza e non in larghezza perche' il catalogo ha quadri in piedi e quadri
  sdraiati**: misurate sei opere, le larghezze vanno da 161 a 288 px e nessuna supera i 288 di
  altezza. Con un vincolo sulla larghezza i verticali uscivano alti il doppio degli orizzontali.
- `break-words` sulla riga della licenza: i contenuti seminati prima della migrazione la portano
  scritta come **indirizzo** (`https://creativecommons.org/licenses/by/4.0/`), che in una colonna
  da 296 px e' una parola sola piu' larga della tessera. Sparisce da se' con `testers.ts licenze`.

**Verificato pilotando chromium** con `aa` sugli Uffizi (*Storie di san Nicola*, 20 descrizioni di
cui 2 possedute): la griglia a 1440/1280/1024/820/390 px — 3/3/2/2/1 colonne, **zero
traboccamenti e nessuno scorrimento orizzontale**; le tessere possedute sono esattamente le 2 che
`inLibrary` riconosce; il bordo misurato **2 px in acquisito nei due temi** contro il filo di
linea delle altre; l'altezza della figura su sei opere di proporzioni diverse. Zero errori in
console, `dist` ricostruito. **Nessuna scrittura sul database**: si e' entrati con un account
esistente e non si e' comprato niente.

⚠️ **La passata precedente aveva raccontato un altro lavoro.** La voce che stava qui diceva di
aver messo il segno del posseduto **sulle tessere della vetrina** e di aver trasformato in griglia
l'elenco delle visite **in libreria**: nel codice non c'era ne' l'uno ne' l'altro — le visite in
libreria sono ancora `flex flex-col`, una per riga. Chi legge un resoconto qui dentro controlli il
codice prima di costruirci sopra.

## ⏸ Ripresa — 2026-08-05, le licenze erano dichiarate e non usate

Domanda: le licenze coprono i casi utili, sono quelle vere? Ragionamento durevole in
`state.md` §3.1-octies; qui quel che serve a chi prosegue.

- **Il vocabolario e' passato da 5 a 8 voci**: `In Copyright` piu' le **sei** combinazioni
  CC 4.0 piu' `CC0 1.0`. Mancavano le tre con `ND`, cioe' l'unico modo di dire «diffondetelo
  ma non riscrivetelo».
- ⚠️ **«Tutti i diritti riservati» non era una licenza**, ed e' sparito dal vocabolario. Non e'
  una concessione: e' l'assenza di concessione. Al suo posto `In Copyright` di
  RightsStatements.org, che e' il vocabolario che i musei usano per questo campo (lo hanno
  fatto Europeana e DPLA). CC non ha un identificatore per quel caso perche' pubblica solo
  concessioni.
- **Ogni voce porta al suo testo canonico** (`licenseUri`): un identificatore non dice niente a
  chi non l'ha mai visto, e la spiegazione la deve dare chi la licenza la pubblica, non noi.

### Il difetto che la domanda ha scoperto

⚠️ **Nessuna delle licenze dichiarate era in uso.** Tutti i **4140** item portavano
`https://creativecommons.org/licenses/by/4.0/` — il default dello schema, scritto come
indirizzo mentre ogni altra scrittura usa il codice — perche' **il seed la licenza non l'ha mai
impostata**. A schermo usciva l'indirizzo per esteso. Le visite: **82 su 84 a `null`**, perche'
il loro schema un default non ce l'aveva.

⚠️ **Il valore di partenza era scritto in tre posti e in due formati** (default dell'item come
URL, le due rotte come testo). Ora e' `DEFAULT_LICENSE`, e lo leggono i due schemi, le due
rotte e il client.

⚠️ **La migrazione converte la notazione, non i diritti**, ed e' scritto nel comando: il vecchio
indirizzo *e'* CC BY 4.0, quindi riscriverlo con `DEFAULT_LICENSE` non cambierebbe il formato ma
la licenza — e per giunta nel verso che non si puo' fare. Il comando `licenze` allinea percio'
i soli contenuti **generati** (`author: "sistema"`), e i contenuti d'autore non li tocca.

### Pronto per il seed

Controllate tutte le strade che scrivono un contenuto, non solo quella principale:

| strada | licenza |
| --- | --- |
| `populateItem` / `populateVisit` (seed) | `DEFAULT_LICENSE`, scritta per esteso |
| `POST /items` · `POST /visits` | `payload.licenza \|\| DEFAULT_LICENSE` |
| schema `Item` · schema `Visit` | `default: DEFAULT_LICENSE` |

⚠️ **`seedSpecialVisits` scriveva fuori da `populateVisit`**: le due visite speciali (tappe
opzionali e guidata) le crea `VisitModel.create` per conto suo, e lo schema della visita un
default non ce l'aveva. Sarebbero uscite senza diritti dichiarati anche dopo la correzione.
Trovato guardando *ogni* punto che crea un documento, non il solo che ci si aspetta.

⚠️ **Riseminare non riscrive quel che c'e' gia'**: il seed salta gli item esistenti, e `--force`
rigenera anche i testi. Su un database gia' popolato serve `testers.ts licenze`.

⚠️ **Restano due visite con `Tutti i diritti riservati`**, che nel vocabolario non c'e' piu':
aprendole nell'editor la tendina non trova la voce e resta vuota. Spariscono alla risemina o
col comando.

**Verificato senza toccare il database**: i default dei due schemi letti costruendo un documento
in memoria (`In Copyright` tutt'e due), le otto voci con il loro indirizzo canonico (zero senza),
e nessun indirizzo scritto a mano fuori dalla tabella. `tsc` verde su tutt'e tre le parti.
**La migrazione non e' stata eseguita**: nel database ci sono ancora i 4140 indirizzi.

## ⏸ Ripresa — 2026-08-05, il rettangolo nero sulla ricerca, e la lentezza

Segnalato: scrivendo nella barra di ricerca del marketplace compare un rettangolo nero che
copre i bordi, e «e' un po' laggoso ma forse e' normale». Erano due difetti veri, tutt'e due.

### Il rettangolo nero era MEZZO anello di fuoco

⚠️ **`focus:outline-none` toglie una meta' sola.** L'anello del progetto e' a due tinte —
`outline` chiaro piu' `box-shadow` scuro, cosi' una delle due e' sempre lontana dal fondo — e i
tre componenti-campo spegnevano il solo `outline`. Restava percio' in piedi il `box-shadow`:
6 px di quasi-nero appoggiati sul bordo del campo. **Al chiaro non si vedeva** perche' li'
l'alone e' bianco su una lastra bianca; si vedeva solo al buio, ed e' il motivo per cui era
sopravvissuto.

- I campi che SONO il controllo (`.campo`, `.campo-select`) hanno ripreso l'anello intero:
  non sopprimono piu' niente.
- La ricerca lo porta sul **contenitore** (`.campo-cerca:focus-within`), perche' e' il
  contenitore ad avere l'aspetto del campo; l'input dentro spegne **tutt'e due** le meta'.
- Regola: le due meta' si spengono insieme o non si spengono.

⚠️ **Trappola della prova, e mi ha portato fuori strada per due giri.** Mettendo il fuoco con
`element.focus()` il difetto **non si riproduce**: `:focus-visible` non scatta, la regola di
base non si applica e si misura un campo pulito. Serve una digitazione vera
(`Input.dispatchKeyEvent`) oppure `CSS.forcePseudoState`. La prima misura diceva
`boxShadow: none` e sembrava che la segnalazione fosse infondata.

⚠️ **L'anello grande e' durato una passata sola.** Rimessa la soppressione sui campi, ma su
**tutt'e due le meta'**: il segnale resta il bordo d'accento. Il difetto non era l'anello, era
spegnerne mezzo. La regola sta ora scritta accanto ai campi, perche' il prossimo che aggiunge un
`focus:outline-none` rifarebbe il rettangolo nero.

⚠️ **Costo dichiarato della scelta:** il fuoco sui campi e' segnalato dal solo colore del
bordo. E' piu' debole di un anello a due tinte, ed e' una scelta d'aspetto presa sapendolo.

### La lentezza non era normale

Misurata sugli Uffizi (2120 item, 128 tessere, 18 868 nodi): **53-207 ms per caratterte**, cioe'
si sente sotto le dita. Non e' il filtro a costare — una passata su `shownArtworks()` sta sotto
il millisecondo — e' Alpine che ridisegna l'elenco **a ogni carattere**.

Rimedio: `x-model.debounce.250ms` sui tre campi di ricerca (vetrina, catalogo, libreria del
compositore) e l'annuncio ritardato con lo stesso criterio, o direbbe un conteggio che non e'
ancora quello a schermo.

**Misurato contando i ricalcoli** durante la stessa parola di sei lettere: **24 → 5**.

**Verificato in chromium**: 6 controlli sulla ricerca, 3 sull'anello dei campi normali nei due
temi (con `CSS.forcePseudoState`), piu' le cinque tornate precedenti rieseguite intere. Zero
errori in console.

### E un tono adesso vuol dire tutta la visita

Segnalato: una visita mista compare fra le semplici. La causa era quella che immaginavi —
`tones.includes(filtro)`, quindi bastava **una** tappa di quel tono. Ora `Semplice` vuol dire
che la visita e' semplice fino in fondo.

⚠️ **Non e' un ripensamento sul perche' quella regola esisteva.** Era stata allargata perche'
prima si confrontava `Visit.level`, un campo solo, e una visita mista non compariva sotto
**nessun** tono: irraggiungibile. Da quando c'e' la voce `Misto` la si puo' stringere senza
perdere niente, e `state.md` §4.6 ora lo dice.

⚠️ **La prima prova non provava niente**, ed e' la trappola gia' scritta in §13: sul Louvre le
visite miste sono **zero**, quindi ogni asserzione passava a vuoto. Nel database ce ne sono due
in tutto (`uffizzivisita` agli Uffizi, `titolo` al British), trovate interrogando Mongo. Rifatta
la prova sugli Uffizi, dove la mista c'e' davvero: `Infantile` 7 → 6, `Semplice` 6 → 5, gli
altri due invariati, e `uffizzivisita` compare **solo** sotto `Misto`.

### Due asperita' della vetrina, dalla stessa segnalazione

- **La pagina di un'opera si apriva a meta'.** Il guscio non e' un documento che scorre ma una
  vista che si sostituisce, quindi il browser teneva lo scorrimento della schermata precedente:
  aprendo un'opera dal fondo di un elenco lungo, la sua pagina cominciava oltre la fine e
  sembrava vuota. `applyRoute` riporta ora in cima **la finestra e il `<main>`**: sotto `lg`
  scorre la pagina, da `lg` in su scorre il contenitore, e riportarne uno solo lascia l'altro
  dov'era a seconda della larghezza. Misurato: da 14 278 px a 0.
- **La tessera di un'opera si tocca tutta**, non solo il titolo. Il collegamento del titolo si
  **stira** su tutta la lastra (`.stiro`), e la figura ha smesso di essere un collegamento suo:
  cosi' il bersaglio e' la tessera intera ma nell'elenco dei collegamenti resta una voce sola
  per una destinazione sola, invece di due.
  ⚠️ **La tessera di una VISITA non lo usa e non deve**: quella ha dentro *Inizia* e *Sblocca*,
  e il velo dello stiro se li mangerebbe.

## ⏸ Ripresa — 2026-08-05, i filtri della vetrina

Richiesta: nel filtro per tipo deve esserci anche il **meta** (stili, pittori...), e ci vuole
un filtro per **durata** (sotto 30 min, sotto 60, oltre).

- **Quarta voce nel segmentato: `Soggetti`.** `marketType` passa da tre a quattro valori;
  `shownArtworks()` divide i gruppi con `isSoggetto()`, che e' il controllo che il riepilogo
  usava gia' (`g.artwork.kind`: la tessera di un soggetto lo porta, un'opera vera no). Non ne
  sono stati scritti due — quello del riepilogo ora chiama lo stesso metodo.
- **Le fasce di durata sono ora 30 e 60**, ed erano 5 e 15.

⚠️ **Le vecchie soglie non erano sbagliate: erano tarate su un catalogo piccolo.** Quando
furono scelte, le visite erano nove e duravano pochi minuti; con gli Uffizi dentro il catalogo
e' cresciuto e la terza fascia si prendeva tutto. Misurato prima di toccarle: **84 visite, da 2
a 312 minuti, mediana 40** — con 30 e 60 restano 40, 20 e 24. Sul Louvre, che e' quel che si
vede in vetrina, 12/4/4 su 20. **Rimisurare le soglie quando il catalogo cambia taglia fa parte
del lavoro**, e sta scritto accanto alla tabella.

⚠️ **Le due applicazioni non erano d'accordo su cosa fosse una visita breve.** Il navigator
aveva la stessa domanda scritta a mano come catena di `if` con soglie 30 e 60; il marketplace
leggeva `visitDurationBands` con 5 e 15. Ora la tabella e' una sola e la usano tutt'e due: il
navigator ha perso il suo `if` e le sue tre `<option>` scritte a mano. Le tre etichette del
navigator erano gia' quelle giuste, quindi riusandole il catalogo non e' cresciuto — sono le
tre del marketplace ad essere diventate orfane.
- Il filtro durata compare anche sui **Soggetti**, con i secondi di lettura come per le opere:
  un soggetto e' un contenuto e una durata ce l'ha.

⚠️ **Una traduzione sbagliata trovata leggendola, non deducendola.** La riga che spiega perche'
su *Tutto* la durata non c'e' diceva «Scegli una **specie**…», e il modello ha letto "specie"
come la categoria di una visita: in inglese usciva *Choose a **tour***, in francese *un
parcours*. Tedesco e cinese erano giusti, quindi guardando una lingua sola non si vedeva. La
frase italiana nomina adesso le tre voci — «Scegli Visite, Opere o Soggetti» — e si traduce da
se'. E' la regola gia' pagata due volte: si riscrive l'italiano, non le dodici traduzioni.

### E il catalogo del curatore, che aveva la TERZA copia delle fasce

Chiesto che i filtri del curatore combacino con gli altri. Si riusa la **tabella**, non la
meccanica: le due schermate filtrano forme diverse — la vetrina gruppi di tessere, il catalogo
righe piatte comprese le private e le guidate — quindi un motore di filtri condiviso sarebbe la
cucitura sbagliata (regola 4). A essere condivisa e' `visitDurationBands`, come gia' fa la
vetrina.

⚠️ **Cercando dove riusarla e' saltato fuori un difetto vero: il filtro durata del curatore
parlava italiano in tutte e tredici le lingue.** `catalogDurationOptions()` costruiva le voci
con le etichette scritte a mano dentro lo script — `label: "meno di 30 min"`, `` label:
`${s} secondi` `` — mai passate da `t()`. E' il punto cieco di §5.7-bis, e `residui` non lo
poteva vedere perche' guarda i nodi dei template. Ora le due liste vengono dalla stessa tabella
della vetrina e passano da `t()`.

- `catalogTypeFilter` passa da `tutti | item | visite` a **`tutti | opere | meta | visite`**:
  le stesse quattro voci della vetrina, perche' le due schermate dividono il catalogo sullo
  stesso asse e devono chiamarlo con le stesse parole. La voce `Descrizioni` si e' divisa in
  `Opere` e `Soggetti`.
- ⚠️ **`kind` vuol dire due cose diverse a un passo di distanza**: la riga della tabella ha un
  suo `kind` (`item` o `visita`), l'item ha il `kind` del genere (`opera`, `stile`, `artista`).
  Il controllo legge quello dell'item (`raw.kind`), non quello della riga.

**Verificato in chromium**: 11 controlli sulla vetrina, 7 sul catalogo, 5 sul navigator, zero
errori in console. Quel che conta e' che le partizioni tornino: in vetrina opere + soggetti
fanno esattamente il totale di *Tutto* (25 + 2 = 27), nel catalogo opere + soggetti + visite lo
fanno pure (500 + 40 + 20 = 560), e le tre fasce coprono esattamente le visite (12 + 4 + 4 = 20)
senza che nessuna resti vuota. Catalogo **500 chiavi, 12 lingue piene, zero orfane**,
`residui` a 4.

## ⏸ Ripresa — 2026-08-05, potature di testo e due correzioni

Richiesta: togliere copy che non serve, e due difetti d'uso.

### Tolto

- Le due frasi di contorno: quella sotto il marchio sulla soglia e quella sotto il titolo
  della scelta del museo.
- **Gli esempi a pastiglia della visita su misura**, in tutt'e due le applicazioni (tre nel
  marketplace, tre nel navigator).
  ⚠️ **Non erano mai stati tradotti**, ed e' il motivo per cui `pota` non ha tolto niente per
  loro: stavano in un array di stringhe italiane (`customExamples`, `examples`) rese con
  `x-text="e"` e `{{ e }}`, mai passate da `t()`. Sono il punto cieco di §5.7-bis. Toglierli
  ha quindi tolto anche sei frasi italiane che comparivano in tutte e tredici le lingue.

### `Gratis` diceva due cose diverse

Comprata una visita, la riga continuava a dire «Gratis»: `costoDi` scende a zero perche' non
resta niente da pagare, e zero lo si stampava come gratuito. Ora `visitPrice` guarda prima il
possesso. ⚠️ **Le due etichette non sono intercambiabili**: `Acquistato` dice come la visita e'
entrata in libreria, `Pubblicata da te` dice che l'hai scritta — un autore la sua visita non
l'ha comprata. `Gratis` resta solo per cio' che non costa e non si ha ancora.

### Uscire da una visita non lasciava piu' rientrare

La freccia col nome della visita chiama `exit()`, che abbassa `started` ma **non chiude la
visita**: `visit` resta in piedi. Mancava solo la strada per tornarci, e per una visita **su
misura** o aperta da un **collegamento diretto** non ce n'era una seconda — quelle nell'elenco
della biglietteria non ci sono. Ora la biglietteria mostra in cima «Visita in corso · Riprendi»
quando c'e' una visita aperta, e `resume()` rialza `started` senza ricaricare niente: la tappa
aperta e' ancora quella.

⚠️ **Tre chiavi nuove, e una e' stata riscritta perche' non si traduceva.** `Tuo` usciva
`Your` in inglese: un possessivo da solo, senza la cosa posseduta, non regge il passaggio. E'
diventato `Pubblicata da te` (`Published by you`, `由您发布`). Stessa forma della trappola gia'
pagata col glossario: si riscrive l'italiano, non le dodici traduzioni.

**Verificato in chromium**: 8 controlli sul marketplace e 8 sul navigator, zero errori in
console. Il prezzo di una visita posseduta e' stato provato **senza comprare niente**, mettendo
l'id nella collezione del solo client e rimettendo poi lo stato com'era: il database non e'
stato toccato. Catalogo **503 chiavi, 12 lingue piene, zero orfane**, `residui` a 4 (il marchio).

## ⏸ Ripresa — 2026-08-05, lo sciame piu' svelto

Richiesta: durante una dimostrazione si devono vedere piu' opere senza stare ad aspettare.

- `MORPH` 3000 → **1800**, `HOLD` 3400 → **900**. Ciclo da 6,4 s a **2,7 s**.
- ⚠️ **Le due fasi non si accorciano allo stesso modo, ed e' la ragione per cui il taglio non
  e' proporzionale.** `HOLD` e' tempo in cui non succede niente: si taglia e si perde solo
  attesa. `MORPH` e' l'unica parte che si guarda, e accorciarlo alza la velocita' di ogni
  punto — la smootherstep ha derivata massima 1,875, e il punto piu' ritardato dispone solo
  del 65% della fase. Sotto il secondo si torna verso lo strappo che era gia' costato una
  passata (`left.md` §0-bis, ottava).
- **Il modello del moto non e' stato toccato**: interpolazione, archi, ritardo per punto,
  ramo a moto ridotto. Sono cambiate due durate.

- ⚠️ **`HOLD` puo' stare basso perche' la figura si vede piu' a lungo di lui.** La
  smootherstep arriva sul bersaglio con velocita' nulla, quindi l'ultimo quinto del passaggio
  e' gia' la figura quasi ferma: il tempo in cui si legge e' quella coda piu' `HOLD`.

**Misurato in chromium, non stimato:** 8,6 → **21 opere al minuto**, con i fotogrammi al
secondo sani (57,3) e zero errori in console.

⚠️ **Una finestra di misura corta non distingue due cadenze vicine.** Su 15 secondi passano
sei transizioni, quindi una in piu' o in meno vale ±4 opere al minuto: 3,4 s e 2,7 s di ciclo
davano lo stesso numero. Su 40 secondi si separano (16,5 contro 21) e tornano a coincidere con
il conto teorico.

⚠️ **Trappola della misura, non del codice.** Il primo confronto campionava *tutte* le
particelle a ogni fotogramma per misurare lo spostamento: la sonda da sola dimezzava il frame
rate (28-31 fps), e siccome lo spostamento per fotogramma dipende dal frame rate, quella
colonna confrontava il costo della sonda e non la modifica. La sonda che conta e' leggera.

⚠️ **`prefers-reduced-motion: reduce` e' il valore di serie di chromium headless**: senza
`Emulation.setEmulatedMedia` si misura il ramo fermo, dove non c'e' nessuna animazione.

## ⏸ Ripresa — 2026-08-05, il restyle: sorgente accesa e lingua della dissolvenza

Richiesta: i flussi vanno bene, ma le slide pesano la *sofisticazione grafica*, quindi curare
molto di piu' il dettaglio — sfumature, trasparenze, accenti, colori accesi — e in particolare,
nel compositore, sostituire il quadratino con una dissolvenza. Ragionamento durevole in
`state.md` §0.5 (riepilogo), §2.2 (la sorgente) e §2.4 (le tre forme della dissolvenza).

### Quel che e' stato fatto

- **Sorgente accesa** a regola dichiarata (`shared/theme.css`): ogni ruolo e' il colore piu'
  saturo della sua tinta che regge 4,6:1 sul muro. La `categoria` ha cambiato tinta (ardesia →
  **ametista**, 288 gradi), e con lei il nome della classe.
- **Velature** (`--*-velo`), **vetro** (`--vetro` + `@utility vetro`), **filo d'accento**,
  **riga figurata** (`.riga-figurata` / `.figura-riga` / `.riga-corpo` / `.numero-tappa`),
  **figura sfumata**. Sparite `.miniatura` e `.scheda-click`, che non le usava piu' nessuno.
- **Marketplace**: compositore (libreria e percorso), libreria, lavori, percorso della pagina
  di una visita, home, scelta del museo, barra di copertura del curatore.
- **Navigator**: scheda, biglietteria, elenco delle tappe, pista dell'avanzamento.
- Un metodo nuovo, `itemImage(id)` in `state.ts`: la figura di una tappa e' l'opera che
  descrive, oppure l'immagine caricata quando il soggetto un'opera non e'.

### I due difetti veri, tutt'e due trovati misurando

⚠️ **Il credito nel binario era illeggibile nel tema chiaro: 1,87:1.** Il binario e' scuro in
tutt'e due i temi, ma l'ottone si schiarisce **solo** al buio. E' la stessa forma del difetto
del `<select>` sul binario: un token che segue il tema, messo su una superficie che il tema non
cambia. Ora `--brass-chiaro` + `.valore-su-struttura`, **5,73:1 nei due temi**. E' vecchio
quanto il binario, non l'ha introdotto questa passata.

⚠️ **Due coppie erano sotto AA al buio da prima**, e la sorgente accesa da sola non bastava:
`--danger` e' passato da `oklch(… 0.71 …)` a `0.82` e `--muted` dal 66% al 78% di muro. Con
quelle due, le coppie sotto AA sui token derivati passano da **4 a 0**.

### Trappole, e sono tutte della prova

⚠️ **`@apply` in Tailwind 4 non vede le classi di `@layer components`.** `.vetro` serviva dentro
`.barra`, e scritta come le altre fermava la compilazione con «Cannot apply unknown utility
class». Va dichiarata `@utility`, che sta **fuori** dal blocco `@layer`.

⚠️ **E poi `@apply` si e' portato via il `@supports`, spegnendo il vetro ovunque in silenzio.**
La ricaduta al fondo pieno stava dentro l'`@utility`; appiattendola dentro `.barra`, Tailwind ha
emesso `background-color: var(--bg)` **senza la condizione**, cioe' come regola successiva che
vinceva sempre. Il sorgente sembrava giusto e il foglio compilato diceva un'altra cosa: trovato
leggendo `dist/style.css`, non il CSS scritto a mano. Ora la condizione sta su una variabile
(`--vetro-fondo`, opaca di partenza e promossa a traslucida da un `@supports` su `:root`), che
`@apply` non puo' appiattire. Verificato a schermo: fondo con alfa 0,72 e `blur(14px)`.
**Regola:** dentro un'utility che qualcuno applichera' con `@apply` non ci si mette un
`@supports`; lo si mette su un token.

⚠️ **Ho modellato la pastiglia sbagliata e mi sono spaventato per niente.** Misurando la
velatura *sopra* `surface-2` uscivano 13 coppie sotto AA; ma le varianti colorate
**sostituiscono** `bg-surface-2`, quindi il fondo vero e' la velatura sulla lastra. Misurate le
pastiglie **realmente a schermo**: zero sotto AA. La lezione e' quella gia' scritta altrove —
si misura l'elemento renderizzato, non il modello che si ha in testa.

⚠️ **La finestra emulata sopravvive alla navigazione.** Una prova che finisce con uno scatto a
390 px lascia la successiva a 390 px, e li' tutto quel che compare solo da `lg` risulta
nascosto: sembrava che la libreria del compositore non avesse righe, e ne aveva 27. Il pilota
nello scratchpad ora azzera `Emulation.setDeviceMetricsOverride` all'apertura.

⚠️ **`selectMuseum` vuole il museo, non il suo qid**, e passandogli la stringa il catalogo resta
vuoto senza errori: `belongsToMuseum` confronta e non trova niente. Difetto della prova, non
del codice.

⚠️ **Uno scatto preso durante il cambio di tema restituisce un fotogramma composto a meta'.**
Cambiando tema e scattando dopo 300 ms, tutta la tabella del curatore usciva slavata e sembrava
un difetto di contrasto grosso; misurando l'elemento, il colore era `rgb(43,43,43)` con opacita'
1 e nessun filtro. Le transizioni di colore erano semplicemente ancora in corso. Dopo il
cambio di tema si aspetta, e comunque **si misura invece di guardare il PNG**.

⚠️ **`openNavigator` naviga con `location.href`, non con `window.open`**: intercettare `open`
non cattura niente. Per entrare nel navigator senza comprare una visita si conia il biglietto
con `POST /api/users/handoff` e si entra **senza** `?visit=`, cosi' si atterra in biglietteria.

**Verificato pilotando chromium**: 13 controlli sul compositore nei due temi, 4 sul giro
(percorso figurato di 25 tappe, copertura del curatore, zero errori in console), 20 rapporti di
contrasto misurati **sugli elementi veri** e 30 sui token derivati nei due temi, tutti sopra
4,5:1. Tre type-check verdi, `marketplace/dist` ricostruito. **Nessun dato di prova nel
database**: si e' entrati con account esistenti e non si e' comprato niente.

### Rimasto aperto

- Schermate non ripassate una a una, perche' non avevano niente da correggere oltre ai token
  che ereditano: soglia, accesso e registrazione, editor della descrizione, visita su misura.
  Nel navigator il runtime (`Stage`, `Pannello`, `Info`, `Comando`, `Posizione`) e `GuidedGate`
  usano gia' solo classi condivise: gli unici `bg-surface-2` rimasti sono le barre finte del
  caricamento in `Info.vue`, dove il grigio e' quel che ci va.
- **Il tipo e il tono sono tutt'e due pastiglie ametista**, e non e' una svista: `theme.css`
  assegna alla categoria «tipo di contenuto, livello, metadati secondari», quindi sono lo stesso
  ruolo. A distinguerli e' l'intestazione della colonna, cioe' la label. Dargli due colori
  vorrebbe dire un secondo ruolo cromatico per una distinzione che la parola gia' fa.

## ⏸ Ripresa — 2026-08-05, le immagini del marketplace

Primo giro sulla sofisticazione grafica, che le slide pesano. Richiesta: piu' colore, e in
particolare togliere il bordo attorno alle immagini della vetrina, far **sfumare** la figura
e portarle il nome sopra. Ragionamento in `state.md` §4.6-bis.

- **Tre classi al posto di `.mat*`** in `shared/components.css`: `.dissolvenza` (la tessera,
  con la maschera), `.figura` (l'opera intera, **sull'`<img>` e senza contenitore**),
  `.miniatura` (il quadratino delle righe). Sono sparite `.mat`, `.mat-grande`,
  `.mat-piccolo`, `.mat-vuoto` e tre `<div>`/`<span>` d'involucro.
- ⚠️ **La regola dichiarata e' cambiata**: `prelude.md` diceva «immagini sempre a
  passe-partout, mai ritagliate». Ora si ritaglia nella tessera e si contiene nella pagina.
  Chi rilegge quella riga sappia che e' stata superata di proposito.
- ⚠️ **Le fermate della maschera sono un vincolo di contrasto**: dove passa il titolo l'alfa
  vale 0,12. Misurato leggendo il pixel vero del quadro dietro ogni riga di titolo su 49
  tessere, due musei, due temi: **9,35:1 chiaro, 5,99:1 scuro**. Toccandole, rifare la misura
  (`contrasto.mjs` nello scratchpad).
- ⚠️ **Difetto vero trovato guardando, non deducendo**: `artworkSummary()` non era mai stata
  tradotta, ne' le tre righe d'elenco. `residui` non le poteva vedere — sono frasi composte
  con `${}` dentro `state.ts`, esattamente il punto cieco di §5.7-bis. Ora `artworkCount()` e
  `artworkFromPrice()`. **501 chiavi**, 12 lingue piene, zero orfane, `residui` a 4 (marchio).
- ⚠️ **`1 descrizione` corretta a mano in en, ja, tr, zh-CN**: il modello, senza il plurale
  sotto gli occhi, aveva risposto «1 opera» dove il plurale dice «descrizioni». E' la
  trappola gia' pagata due volte — una voce di glossario non basta se le due forme si
  traducono separatamente.
- **La copertina di una visita** e' passata dal grigio alla **struttura**, col titolo in
  display, e non lo ripete piu' sotto.
  ⚠️ **Provato e scartato: metterci la figura della prima tappa.** Le visite di catalogo di
  un museo sono le stesse opere nello stesso ordine, quindi usciva la stessa fotografia su
  tutte e venti. Non c'e' una regola migliore nel dato. Se un giorno si riprova, il difetto
  da conoscere e' l'altro che era emerso: `::after` e' l'ultimo figlio e dipinge **sopra** il
  titolo, quindi `relative` da solo non basta a tirarlo su, ci vuole un `z-index`.

**Verificato pilotando chromium**: la vetrina nei due temi, la pagina dell'opera, la bozza
dell'editor, le righe del compositore, la scheda del navigator a 1400 e a 390 px (contenuta
da `lg`, ritagliata sul telefono), piu' le misure di contrasto qui sopra. Zero errori in
console, tre type-check verdi, `marketplace/dist` ricostruito. Nessun dato di prova nel
database: si e' entrati dalla visita su misura, che non si salva.

## ⏸ Ripresa — 2026-08-05, le logistiche del museo mancavano a due visite su tre

Segnalato come «dal marketplace non si vedono le logistiche, dall'elenco del navigator si'».
Ragionamento in `state.md` §5.3-septies.

⚠️ **Non era l'ingresso, era la visita.** I due ingressi finiscono nella stessa riga
(`Visita.vue:68` → `openingNotes()`), e provandoli tutti e due sulla stessa visita seminata
si comportano uguale. Le quattro indicazioni degli Uffizi le porta dentro **solo** chi le ha
avute dal seed: `seed.ts openingNotes(config)` le copia nelle visite che genera, mentre una
visita composta nel marketplace nasce con `logistics: []` e `POST /visits/custom` scrive
`logistics: []` a mano (`visits.ts:195`). Due delle tre strade che creano una visita non
sapevano niente del museo in cui sta.

- **Rimedio: leggerle dove stanno.** `openingNotes()` in `state.ts` mette prima
  `museum.value.logistics` (che arriva da `GET /museums/:qid/config` ed era **gia' scaricato**
  a ogni visita, solo mai letto) e poi le note d'apertura della visita. Piu' `logistics?:
  string[]` su `Museum` in `shared/types.ts`, che il tipo non dichiarava pur ricevendolo.
- ⚠️ **Nessuna migrazione, ed e' il motivo per cui questa strada e' stata scelta**: le visite
  gia' nel database funzionano appena il codice cambia. Copiarle a scrittura avrebbe invece
  lasciato indietro `uffizzivisita` e ogni altra visita gia' composta.
- ⚠️ **Il salto del testo doppio serve**: le visite seminate una copia ce l'hanno, e senza
  quel controllo mostrerebbero otto note invece di quattro. Sparisce da se' se un giorno il
  seed smette di copiarle — e allora la configurazione resta l'unica sorgente, che costa pero'
  una migrazione dei documenti gia' scritti.

**Verificato in chromium, quattro casi**: `uffizzivisita` (composta, vuota) mostra le quattro
del museo; una seminata degli Uffizi ne mostra **quattro e non otto**; un tour del Louvre
mostra la sola nota del suo autore; una del British non apre nessun riquadro vuoto. Piu' il
gesto segnalato, per intero: accesso, scheda della visita, *Inizia la visita*. Zero errori in
console, tre type-check verdi. **Dati di prova rimossi**: le tre visite aggiunte alla libreria
di `visitatore1` tolte dalla `collezione` (portafoglio mai toccato, erano gratuite) e le 26
sessioni di prova cancellate.

### «Stile: Unknown» era un buco salvato come se fosse un nome *(stessa giornata)*

Segnalato: molte opere dicono `Unknown` nel marketplace. E' dell'**opera**, non degli item:
67 opere su 143 avevano `style.name: "Unknown"` e 13 un buco in `author.name` (11 `Unknown`
piu' 2 indirizzi di nodo anonimo `.well-known/genid/…`).

⚠️ **Lo scriveva `services/wikidata.ts`**: `binding.authorLabel?.value || "Unknown"`. Un buco
salvato come parola non si distingue piu' da un nome, quindi ogni schermata deve ricordarsi di
riconoscerlo — e **nessuna lo faceva allo stesso modo**: `nomeAutore()` filtrava gli indirizzi
ma non `Unknown`, `nomeStile()` nessuno dei due, `contentFacts` `Unknown` ma non gli indirizzi,
`museums.ts` e `seed.ts` tutti e due, `Scheda.vue` e `stopSubtitle` nessuno. Sette letture,
cinque regole diverse.

- **Rimedio alla sorgente**: `valoreOMai()` in `wikidata.ts`, un buco resta **vuoto**. Le due
  forme sono l'assenza e l'indirizzo del nodo anonimo, e si decidono in un posto solo.
- **Migrazione**, perche' riseminare non basta: quando l'opera esiste gia' il seed le aggiorna
  **solo la posizione**. `npx ts-node src/scripts/testers.ts buchi` — 13 autori e 67 stili
  svuotati, zero residui, e rilanciata dice `0 e 0`.
- ⚠️ **Nessuna modifica alle viste, ed e' la prova che il posto era quello**: il marketplace
  scrive gia' `nomeStile() || 'n/d'` e il navigator ha `v-if="stile"`. Vuoto sanno gia'
  gestirlo; `Unknown` no.

⚠️ **Difetto latente trovato di conseguenza**: la richiesta al modello era
`l'opera ${name} realizzata da ${author}` senza condizione, quindi per quelle 13 opere finiva
con «realizzata da» e basta. Ora la meta' con l'autore entra solo se l'autore c'e'. **I testi
gia' scritti per quelle opere sono nati con «realizzata da Unknown» nel prompt** e per
rifarli servirebbe `--force`, che pero' rigenera tutto: non ne vale la pena.

⚠️ **Considerato il seed in corso** (Uffizi, un altro terminale): non lo tocca. Le opere degli
Uffizi con autore vuoto sono **zero**, `piuRicorrente` scarta i nomi vuoti con `!valore.name`
prima dei controlli su `Unknown`, e il processo ha comunque in memoria il codice caricato alla
partenza. Le opere del museo esistono gia' tutte, quindi non ne scrivera' di nuove.

### `seed.ts speciali` su ogni museo, non piu' solo sul primo *(stessa giornata)*

Chiude il secondo blocco del 18-33 (`state.md` §0): il modulo I aveva il codice e non il dato.

- `main()` fa ora il giro su tutti i config; `seedSpecialVisits` resta per-museo e gli account
  (`docente1`, `studente1..3`) escono in `seedDemoAccounts()`, chiamata **una volta sola** —
  sono persone, non arredo di un museo, e ripeterle quattro volte stampava quattro volte.
- ⚠️ **La parola chiave ha dovuto diventare unica per museo** (`Fenice rossa Q6373`,
  `Fenice rossa Q51252`, …), e non e' cosmetico: `POST /visits` rifiuta con **409** due
  guidate che condividano la parola, e `guidedSessions.ts` tiene le sale aperte in
  `byAccessKey`, **una mappa indicizzata sulla parola**. Con una parola sola per quattro musei
  l'ultima sala aperta si sarebbe presa gli studenti delle altre, e a chi arriva dal museo
  sbagliato la `/join` avrebbe risposto «non esiste nel museo selezionato».
- Il suffisso e' il **qid** perche' e' l'unico campo unico *per costruzione* fra quelli che il
  curatore scrive: `name` e `location` sono unici di fatto, non per definizione. Un elenco di
  parole poetiche indicizzato sul museo sarebbe stato un'enumerazione che si rompe al quinto.
- Un museo non ancora seminato non ha item da cui pescare: lo dice e passa oltre.

**Eseguito e verificato sul database**: 4 guidate con 4 parole distinte, 4 con tappe
opzionali, 3 domande di quiz ciascuna (British 16 tappe, Uffizi 104, Met e Louvre 13).
**Rilanciato una seconda volta: 44 visite prima e dopo**, cioe' idempotente davvero — gli
`@id` portano il qid. `tsc` verde.

⚠️ **Quattro visite composte a mano portano un `quiz` senza avere una parola chiave**
(`uffizzivisita`, `titolo`, `vediamo se funziona`, `Visita Infantile · 60s (mia versione)`).
Non le ha toccate questo lavoro ed e' innocuo — il quiz lo distribuisce solo la sessione
guidata, e `GET /visits/:id` non lo manda mai — ma viaggeranno nel dump.

### La scelta della lingua, resa coerente *(stessa giornata)*

Ragionamento in `state.md` §2.3. I tre punti in cui si sceglie erano diversi in tutto tranne
la classe CSS; ora sono lo stesso controllo.

- **Un componente solo nel navigator.** `Scheda.vue` ricopiava il markup di
  `LanguageSelector.vue`, `cambiaLingua` compreso: due copie dell'unico controllo che apre
  l'applicazione a chi non legge l'italiano. Ora lo importa, con `etichetta`/`id` come prop.
- **L'etichetta e' `Lingua`**, non «Lingua dei contenuti»: `setLanguage` chiama `setLocale`,
  quindi cambia anche comandi, titoli e annunci. La vecchia chiave e' stata potata (12
  traduzioni), il catalogo e' **473**.
- ⚠️ **`appearance: none` era necessario, e il perche' non si deduce leggendo.** Sul binario
  il campo restava un rettangolo **bianco col testo nero** pur avendo `background: transparent`
  e `color: on-structure` **calcolati addosso** — verificato con `getComputedStyle`. E' il
  browser che dipinge il controllo chiuso coi propri colori. Non toglie il selettore nativo:
  su un telefono il tocco apre lo stesso quello del sistema operativo, che e' la ragione per
  cui questi sono `<select>`.
- ⚠️ **Si vede solo nel tema chiaro**, perche' li' il binario resta scuro mentre tutto il
  resto schiarisce. Provando solo al buio il difetto non compare.
- La freccia sono **due gradienti in `currentColor`**, non un SVG in `data:`: segue tema e
  contesto senza una seconda regola per `.dark`.
- In biglietteria il campo e' sceso **nella riga dei filtri**: a tutta larghezza sopra di loro
  pesava piu' del titolo. Le tre `<label>` restano, tutte `sr-only`.

⚠️ **Trappola della prova, non del codice:** il profilo di chromium riusa `dist/style.css`
dalla cache, quindi il primo scatto dopo una ricostruzione del CSS puo' mostrare il vecchio
foglio mentre `getComputedStyle` legge gia' il nuovo. Sembra che la regola non funzioni.
Serve una navigazione con l'indirizzo cambiato.

**Verificato in chromium**: i tre punti nei **due temi**, la vetrina e la biglietteria con i
campi chiari invariati, le tre `<label>` lette dallo screen reader, zero errori in console,
`vue-tsc` e `tsc` verdi, `dist` ricostruito.

### La vetrina parlava ancora italiano dove conta *(stessa giornata)*

Segnalato: «3 tappe · 2 min · Personalizzata» su ogni carta, «10 visite · 104 opere · 2
soggetti» sotto il titolo, il segmentato «Tutto / Visite / Opere» e il filtro dei livelli.
Ragionamento in `state.md` §5.7-bis. **Catalogo 447 → 474 chiavi, 12 lingue piene, zero
orfane, `residui` a 4** (il marchio).

⚠️ **Erano tutte frasi composte in uno script con `${}`**, e nessuno strumento le poteva
segnalare: `residui` guarda i nodi dei template. Ora passano da `t()` con segnaposto —
`visitSummary`, `marketSummary`, `museumSummary`, `marketDurationOptions`, `visitStatus`,
`visitIssues`, `readablePrice`, `visitLevelLabel`.

⚠️ **`t` era ombreggiato in tre punti di `index.html`.** `x-for="t in visitStops(...)"`
(riga 830) rendeva `t(\`Opzionale\`)` un `t is not a function` a **ogni** disegnata della
scheda di una visita; `x-for="t in tones"` (1091 e 1637) faceva stampare il tono grezzo. Le
variabili di ciclo si chiamano ora `tappa` e `tono`. **Verificato: zero eccezioni** dove
prima ce n'era una per tappa opzionale.

⚠️ **Tre cose sono dovute salire in `shared/constants.ts`**, e il motivo e' operativo, non
estetico: `keysFromSource` raccoglie le chiavi **calcolate** solo da quel file, quindi una
`t(x)` con la chiave scritta altrove non entra in catalogo e **`pota` la cancella come
orfana** alla passata dopo. Sono `visitDurationBands` (le tre fasce di durata, che usa il
solo marketplace) e `CUSTOM_LEVEL` / `AI_LEVEL` — «Personalizzata» e «Su misura», che erano
stringhe a mano dentro `routes/visits.ts` e che ora la rotta importa.

⚠️ **`formatDuration` resta in italiano**, ed e' voluto: la usano gli script del server. Le
due applicazioni ora compongono la frase con `durationMinutes` piu' le proprie chiavi
(`{n} min`, `meno di 1 min`). Toccata anche `Biglietteria.vue`, perche' le due sponde devono
dire il minuto allo stesso modo.

⚠️ **Il glossario e la trappola di come si scrive una voce.** «visita» usciva con due parole
diverse nella stessa schermata (de: `Visite`=Besuche, `{n} visite`=Rundgänge). Scrivendo nel
glossario «va resa sempre con la stessa parola» il **coreano ha lasciato la parola italiana**
e il **francese ha perso il plurale**. La forma che funziona e' «scegli UN termine della
lingua d'arrivo, con le sue forme di singolare e plurale» — poi 관람 코스 e *parcours*. E' la
stessa lezione gia' pagata coi toni e con «vetrina»: **il glossario si spiega, non si
traduce**, e non deve nominare nessuna parola straniera.

**Verificato in chromium**, lingua cinese: il selettore dei musei e la vetrina senza una
parola italiana residua **cercando solo fra i nodi visibili** (Alpine costruisce anche le
viste nascoste, quindi `body.innerText` accusa il falso); l'editor coi toni letti tradotti e
il valore ancora `Infantile`; la scheda di una visita da 104 tappe con zero eccezioni; la
biglietteria del navigator che dice `3 个站点 · 2分钟 · 个性化`, cioe' le stesse parole del
marketplace. Restano italiani i **nomi** delle visite e delle opere, che sono dati. Tre
type-check verdi, `dist` ricostruito, dati di prova rimossi.

⚠️ **Non provata la pastiglia «Opzionale» a schermo**: nel database non c'e' nessuna visita
con tappe opzionali (`state.md` §3.5). La prova che regge e' l'assenza dell'eccezione.

## ⏸ Ripresa — 2026-08-05, revisione di lingua e sessioni, e il difetto che ne e' uscito

Richiesta: guardare com'e' implementata la traduzione nelle due applicazioni e come sono
implementate le sessioni, e dire se il deploy sui docker di dipartimento rompe qualcosa.
Poi correggere. Il ragionamento durevole sta in `state.md` §0.3 (il riepilogo), §5.7 (lingua),
§"Le sessioni", §1.1-quinquies (fin dove regge) e §1.1-sexies (il difetto di prestazioni);
qui quel che serve a chi prosegue.

### 1. La lingua si perdeva a ogni ricaricamento (marketplace)

⚠️ **Difetto vero, e la traduzione del marketplace era di fatto inservibile.** La lingua
scelta valeva solo dentro il caricamento in cui la si sceglieva: **qualunque ricaricamento
tornava all'italiano**, compresa la prima schermata di chi era gia' stato qui e il ritorno
dal navigator. Trovato pilotando chromium, non leggendo:

```
lingua = it            -> "Entra"
cambiaLingua('zh-CN')  -> "进入"     (e' il caso che era stato provato)
ricarico, zh-CN salvato-> "Entra"    ma t('Entra') = 进入, html lang = zh-CN
```

La causa e' l'incontro fra due scelte giuste: Alpine costruisce **tutte** le viste all'avvio
(sono `x-show`, quindi stanno nel documento anche da nascoste) e ogni legame si valuta li'
una volta sola; `t()` ha una sola dipendenza reattiva, `lingua`, che al ricaricamento era
**gia'** il valore finale. Il catalogo arriva dalla rete e trova la pagina gia' disegnata:
non c'e' piu' niente da invalidare. Non si autoripara nemmeno richiamando `cambiaLingua`
con lo stesso valore, perche' assegnare lo stesso valore non e' un cambiamento.

**Rimedio, e la regola da non rompere:** `lingua` parte da `SOURCE_LANG` e la lingua vera
si assegna in `start()` **dopo** `await preparaLingua`. E' l'assegnazione a ridisegnare,
quindi deve venire dopo l'attesa. Non si vede nessun lampo di italiano perche' finche' si
aspetta `view` vale ancora `"avvio"`, che non e' nessuna schermata.

⚠️ La prima idea era `window.deferLoadingAlpine`, che **non esiste in Alpine 3**: e' di
Alpine 2. Controllato nel file vendorizzato prima di scrivere la correzione.

### 2. La lingua del dispositivo, e la regola in `shared/`

Il navigator la proponeva dal telefono, il marketplace no, e il marketplace e' la porta
d'ingresso: la schermata che si legge prima di poter scegliere era proprio quella che non
guardava. `pickLanguage(saved, preferite)` e `LANG_KEY` stanno ora in `shared/constants.ts`
e li usano tutt'e due; il navigator ha perso `defaultLanguage`, `browserLanguage` e
`loadLanguage`. E' una funzione pura: memoria e dispositivo glieli passa chi chiama, perche'
le due applicazioni li leggono in posti diversi. La lingua **del dispositivo non si salva**:
e' un ripiego, non una scelta, e scrivendola le due cose diventerebbero indistinguibili.

⚠️ **La lingua sopravvive alla chiusura della finestra, ed e' voluto**: sta in `localStorage`
sotto la stessa chiave del navigator, quindi si sceglie una volta per tutt'e due. La sessione
invece muore con la scheda. Chi lo nota adesso lo nota perche' prima il ricaricamento
ripartiva sempre in italiano, cioe' per via del difetto qui sopra. Volendo il contrario basta
`sessionStorage`, ma si perde la scelta condivisa fra le due applicazioni, che in sviluppo
stanno su due origini diverse.

### 3. Due punti che non erano MAI stati tradotti, trovati provando

⚠️ **Il binario, cioe' la navigazione principale del marketplace.** Le voci erano
`x-text="v.raw"` su stringhe italiane dentro un `x-for` scritto in linea nel markup. Ora
`label:t('Vetrina')`: la chiave e' letterale, quindi l'estrattore la vede.

⚠️ **`viewLabel()`**, che alimenta il titolo della pagina e **ogni annuncio della regione
viva**: cioe' quel che sente chi non guarda lo schermo era italiano in tutte e dodici le
lingue.

Nessuno dei due lo poteva segnalare `residui`: il primo e' testo dentro l'espressione di un
attributo, il secondo sta in uno script, e `residui` guarda i template. La rete di sicurezza
resta la prova in browser con la lingua impostata su un'altra.

**Catalogo: 434 → 447 chiavi**, dodici lingue piene, zero orfane, `residui` a 4 (il marchio).
Delle 13 chiavi nuove, 12 vengono da questi due punti.

⚠️ **Il glossario ha imparato «vetrina» e «libreria»**, per la ragione gia' pagata coi toni:
`Vetrina` in cinese era uscita 展柜, cioe' il mobile con i ripiani, e `Libreria` rischiava il
negozio di libri. Rifatte le 5 chiavi: cambiate 3 in ja/ko/zh-CN, 1 in de/es/nl/pt, 2 in pl,
**nessuna** in en/fr/ru/tr. E' il motivo per cui il diff dei dodici cataloghi non ha lo stesso
numero di righe pur avendo tutti 447 chiavi: dove la resa nuova coincide con la vecchia, git
non vede niente. `zh-CN: Vetrina` e' stata poi corretta **a mano** in 展示, e va riguardata
da chi il cinese lo legge.

### 4. Sessioni: tre buchi, nessuno strutturale

- ⚠️ **Il biglietto di passaggio era una credenziale piena.** `createSession(who, 10min)`
  scriveva una riga identica a una sessione, quindi il biglietto che viaggia **in un
  indirizzo** valeva come `Authorization: Bearer` per tutti i suoi dieci minuti, e usato
  cosi' non si consumava: «vale una volta sola» era vero solo per `POST /users/redeem`. Ora
  `Session.kind` (`sessione` | `handoff`), `resolveSession` filtra `kind: {$ne: "handoff"}` —
  con `$ne` e non `=== "sessione"`, perche' le righe scritte prima del campo non ce l'hanno e
  sono sessioni vere — e `/redeem` pretende un biglietto. Il `kind` sta nell'**interrogazione**
  e non in un controllo dopo, o mandare una sessione a `/redeem` la butterebbe giu'.
- ⚠️ **Il navigator non gestiva il 401 in nessun punto** (`grep 401 navigator/src` non dava
  niente): a sessione scaduta ogni chiamata falliva per conto suo dentro il proprio `catch`, e
  la persona restava davanti a una pianta che non rispondeva. Ora `onSessionExpired` in
  `call()` e una schermata che dice dove si rientra. L'avviso e' stato messo **prima** di
  `GuidedGate` nella catena `v-else-if`: una sessione scaduta spegne anche la visita guidata, e
  lasciarla a schermo direbbe che si sta ancora seguendo il docente.
- `sessionStorage` era letto a livello di modulo senza guardia in tutt'e due le `api.ts`: un
  browser che nega la memoria faceva cadere il modulo prima che esistesse qualcosa in grado di
  dirlo.

**Verificato contro il server vivo, 15 controlli, zero fallimenti**: il biglietto da'
401 come intestazione ma si riscatta ancora; monouso; una sessione mandata a `/redeem` viene
rifiutata **e sopravvive**; uscita, biglietti inventati e le quattro rotte aperte invariati.
Piu' la prova in browser della scadenza a meta' visita, con un gesto vero e non con un import.

⚠️ **Trappola della prova, non del codice:** `await import('/src/api.ts')` da CDP puo' dare
una **seconda istanza** del modulo. Il 401 ripuliva `sessionStorage` (che e' globale) ma il
gestore era quello dell'altra copia, quindi la schermata non cambiava e sembrava un difetto.
Va premuto un bottone vero.

### 5. Il difetto di prestazioni, segnalato come «l'accesso e' lentissimo»

⚠️ **Non era l'accesso** (101 ms) **e non era il server** (13-45 ms a chiamata): era il primo
caricamento del catalogo di un museo grosso. **Galleria degli Uffizi: 8246 ms**, di cui ~300
di rete e il resto thread principale, in due blocchi da 4,3 e 3,6 secondi.

`findItem()` ricostruiva `[...myItems, ...marketItems, ...visits]` — 868 elementi ricopiati —
**a ogni chiamata**, e poi lo scandiva. La chiamata sta in `visitTones()`, una per tappa,
dentro `shownVisits()`, che e' un legame reattivo: 36 visite × 104 tappe = **3744 chiamate per
ogni disegnata**, ognuna delle quali ricopia 868 elementi **attraverso il Proxy di Alpine**.
Il profilo della CPU: 3,0 s in `findItem`, 5,9 s nel Proxy sotto di lui.

Rimedio: un `Map<string, Content>` **fuori** dallo stato (dentro sarebbe a sua volta
proxato), rifatto da `reindicizza()` nei cinque punti in cui i tre elenchi vengono assegnati.
L'ordine di riempimento e' rovesciato perche' l'ultimo `set` vince e i propri contenuti devono
restare quelli che rispondono, com'era quando la ricerca si fermava al primo trovato.

**8246 ms → 1201 ms (6,9×)**, e nel profilo non resta calda nessuna funzione nostra: quel che
avanza e' Alpine che disegna 250 carte. Il British Museum stava gia' a ~500 ms, quindi il
difetto si vedeva solo dove c'e' volume, e cresce con **item × visite**.

### 6. Quanto regge il catalogo di un museo: misurato

Il catalogo vero degli Uffizi moltiplicato dentro la pagina, database intatto (`state.md`
§1.1-quinquies per il ragionamento):

| item in UN museo | ingresso nel museo | cambio schermata | un tasto nella ricerca | nodi DOM |
| --- | --- | --- | --- | --- |
| 848 (oggi) | 1,2 s | 169 ms | 221 ms | 8 462 |
| 2 544 | 1,6 s | 55 ms | 165 ms | 20 334 |
| 5 088 | 5,8 s | 72 ms | 262 ms | 38 142 |
| 10 176 | 13,5 s | 91 ms | 559 ms | 73 758 |

**Non e' un lavoro da fare prima dell'esame** (oggi il museo piu' grosso sta a 1,2 s); e' un
tetto da saper raccontare. Il rimedio vero, quando servira', sta in `state.md` §1.1-quinquies.

### 7. Il deploy: `deploy.md` aggiornato

Cinque cose fermavano il sito e non erano scritte, una era scritta al contrario. Ora ci sono:
`PORT=3000` (`deploy.md` diceva «Express resta in chiaro sulla 8000», che e' il modo in cui il
sito non risponde e i log non dicono niente di sbagliato); `npm run setup` con
`--include=dev`, perche' `tsc`, `vite` e `vue-tsc` stanno fra le devDependencies e i due
`build` senza di loro muoiono; **Mongo si raggiunge solo da dentro il cluster**, con la prova
in una riga e la via d'uscita (`start node-22 <sito> <file>.js`, che gira dentro e vede la
stessa cartella); leggere `scripts/mongo.js` di Company invece di indovinare `authSource`;
provare **presto** se il container esce su internet, o cadono le quattro voci LLM; e
`node-22` invece di `nodemon-22` il giorno della dimostrazione, perche' un riavvio scioglie
una classe collegata.

⚠️ **Una conseguenza del deploy che si vede solo li':** stessa origine vuol dire
`sessionStorage` condiviso, quindi **un biglietto che non si riscatta non si nota piu'** — il
navigator trova la sessione del marketplace e prosegue. Toccando `handoff`/`redeem`, la prova
che conta va fatta da un browser che quella sessione non ce l'ha.

### Stato e verifiche

Tre type-check verdi, `marketplace/dist` ricostruito, server riavviato. In browser: 12
controlli sulla lingua (ricaricamento in cinese che regge dentro l'accesso e dopo un secondo
ricaricamento, ritorno all'italiano, dispositivo cinese senza scelta salvata, navigator
invariato), 15 sulle sessioni contro il server vivo, piu' le misure di prestazioni. Zero
errori in console. **Nessun dato di prova lasciato nel database**: il carico e' stato
simulato nel client.

⚠️ **Rimasto aperto, e non e' stato toccato**: i ~94 messaggi d'errore del server sono
italiani e arrivano a schermo cosi' come sono in 17 punti del marketplace, quindi in cinese i
percorsi d'errore parlano italiano. `residui` non li vede perche' non sta nei client. Il modo
giusto e' un codice nella risposta che il client mappa su `t()`, non ricopiare le stringhe.

## ⏸ Ripresa — 2026-08-04, la traduzione del marketplace

**Stato: fatta. 434 chiavi in 12 lingue, `residui` a zero** (restano solo `ART`,
`AROUND` e `ArtAround`, che sono il marchio). Ragionamento in `state.md` §5.7.

### Che cosa c'e' gia', e funziona

- **`marketplace/src/frontend/i18n.ts`** (nuovo): stessa libreria del navigator,
  `i18next`, con le stesse identiche opzioni. Non si puo' importare da npm perche' il
  marketplace non ha un impacchettatore, quindi arriva da
  `public/vendor/i18next-26.3.6.min.js` (43 KB) con un `<script defer>` messo **prima**
  del modulo, come Alpine.
- **`GET /i18n/<codice>.json`**: il server pubblica `shared/i18n/` (una riga in
  `index.ts`). Il navigator i cataloghi se li porta dentro il pacchetto compilato, il
  marketplace no: ne scarica **uno solo**, quello della lingua scelta.
- **`AppState.lingua` + `AppState.t()`**: `t()` legge `this.lingua`, quindi leggerla
  dentro un binding Alpine registra la dipendenza e cambiare lingua **ridisegna da se'**
  tutto il tradotto. E' l'equivalente del `ref` letto dentro `t` nel navigator.
- **Selettore lingua** nel piede del binario, 13 voci, nomi ciascuno nella propria lingua.
- **La lingua e' la stessa chiave del navigator** (`artaround-lang` in `localStorage`):
  scegliendola di qua, di la' e' gia' scelta.
- **`languages.ts` scandisce anche il marketplace** (`SOURCE_DIRS` + `SOURCE_FILES`):
  `index.html` si tratta come un template, prendendo il `<body>`. Senza questo `pota`
  avrebbe preso le chiavi del marketplace per orfane e le avrebbe cancellate.
- **Cataloghi: 392/392 su 12 lingue.**

### Le frasi mescolate a un tag

Le 58 che lo script non poteva toccare erano di tre forme, e si sono chiuse cosi':

| forma | soluzione |
| --- | --- |
| testo accanto a un'icona (`<svg/> Indietro`) | uno `<span x-text>` attorno al solo testo: un `x-text` sul controllo cancellerebbe l'icona |
| prefisso piu' valore (`Curatore: <span x-text=…>`) | **una frase intera con segnaposto**, `t("Curatore: {nome}", {nome})` |
| `<option>` statici | `x-text` sull'option |

⚠️ **I frammenti non si concatenano.** `Curatore: ` piu' il nome sono due pezzi in italiano
e possono non esserlo altrove: in altre lingue cambiano ordine e accordo, e una frase
composta a pezzi esce sgrammaticata senza che niente lo segnali. Per lo stesso motivo sono
state riscritte le `aria-label` che si costruivano con `+` (`'Inizia la visita ' + v.name`).

⚠️ **`ART`, `AROUND` e `ArtAround` restano fra i residui e NON vanno tradotti**: sono il
marchio. `residui` non li puo' distinguere, come non distingue gli id dei comandi.

⚠️ **Una traduzione sbagliata trovata leggendola, non deducendola**: «non ha prezzo» in
cinese era diventato «e' inestimabile». L'italiano era ambiguo (il campo prezzo non si
imposta, non il valore incalcolabile), quindi si e' riscritta la frase italiana invece di
correggere dodici traduzioni. Cambiare l'italiano cambia la chiave: serve `pota` e poi
`traduci`.

### Come si e' fatto il grosso, se serve rifarlo

Uno script nello scratchpad (`avvolgi2.py`) ha avvolto i due casi meccanicamente sicuri:
elementi con **un solo nodo di testo** e i quattro attributi visibili. Due cose imparate:

⚠️ **Il primo tentativo aveva un'espressione regolare che non terminava piu'**: il gruppo
degli attributi era `(?:"[^"]*"|'[^']*'|[^>])*?`, ambiguo, e su un file da 1800 righe
faceva backtracking esponenziale. La forma buona alterna «carattere che non sia `<`, `>` o
virgoletta» con «stringa fra virgolette intere»: ogni alternativa consuma almeno un
carattere e la scelta e' decisa dal primo, quindi la scansione e' lineare. Serve davvero:
un `>` dentro `x-show="n > 0"` altrimenti spezza il tag a meta'.

⚠️ **Le chiavi si scrivono fra backtick** — `x-text="t(\`Dov'e' il bagno?\`)"` — perche'
l'italiano e' pieno di apostrofi e dentro un attributo gia' delimitato da virgolette
doppie una stringa con `'` non si chiude.

**Verificato in chromium**: `i18next` su `window`, `t()` che interpola anche in italiano
(`7 tappe`), il selettore con 13 lingue, il cambio a `en` e a `zh-CN` **senza ricaricare**
(1 sola navigazione), la soglia in cinese con lo sciame intatto e il marchio non tradotto,
piu' la suite dell'editor rieseguita per le regressioni. Zero errori in console, struttura
dell'HTML immutata (conteggio dei tag identico prima e dopo).

## ⏸ Ripresa — 2026-08-04, passata sui commenti di tutto il codice

Richiesta: commenti che spiegano e non si vantano, senza racconto di com'era prima,
senza trattini lunghi e senza emoji. 66 file toccati, 638 righe aggiunte e 673 tolte.

- **Zero trattini lunghi, zero `⚠️`, zero frecce unicode** in tutti i sorgenti di
  `shared/`, `server/src`, `navigator/src`, `marketplace/src` e `index.html`. Tolti anche
  dalle stringhe visibili: il segnaposto della licenza e del tono e' `n/d`, il titolo del
  foglio QR e' «QR delle opere di X», gli avvisi di `testers.ts` usano `!`.
- **Tolto il racconto.** I commenti dicevano spesso «prima era cosi', ora e' cosi'»: quella
  roba invecchia e diventa falsa. Ora dicono cosa succederebbe *senza* la riga che
  spiegano, che e' la stessa informazione senza data di scadenza.
- **Tolte le misure** (`1,1 MB contro 300 KB`, `74% del peso`, `94 as any`): stanno nei
  commit e qui, non in un'intestazione che nessuno riallinea.
- **Corretto un commento che era diventato falso**: `shared/access.ts` dichiarava che il
  nome utente arriva dalla richiesta e nessuno lo verifica. Non e' piu' vero da quando
  c'e' la sessione, e un commento sbagliato sull'autorizzazione e' peggio di nessuno.

⚠️ **Conseguenza da conoscere:** riscrivendo una stringa italiana visibile (in
`Posizione.vue` c'era un trattino lungo) la sua chiave cambia, quindi le dodici traduzioni
diventano orfane. Il giro `pota` + `traduci` e' stato rifatto: **229/229 su 12 lingue**.
Sono sparite anche tre chiavi del combobox delle lingue, che non esiste piu'.

**Verificato**: cinque controlli verdi (tre type-check, due build), stack riavviato, e le
due prove in browser rieseguite intere (navigator: italiano, cambio a 中文 senza ricaricare,
ritorno; marketplace: editor e barra «Manca ancora»). Zero errori in console.

## ⏸ Ripresa — 2026-08-04, da `vue-i18n` a `i18next`

Una libreria sola per le due applicazioni. Ragionamento in `state.md` §5.6-bis.

- **Ha toccato un file**: `navigator/src/i18n.ts` riscritto, piu' una riga di `main.ts`
  (`.use(i18n)` non serve piu'). I **16 file che chiamano `t` non sono stati toccati**, e i
  **12 cataloghi nemmeno**: `interpolation: {prefix:"{", suffix:"}"}` li legge come sono.
- **Perche':** il marketplace dovra' leggere gli stessi file e Vue non lo puo' avere (slide 37),
  quindi con `vue-i18n` servivano due letture degli stessi cataloghi — e due letture che devono
  comportarsi uguale, quando smettono, non danno un errore ma una schermata sbagliata.
- ⚠️ **La lingua si passa a ogni chiamata** (`t(k, {lng: locale.value, ...})`) e non con
  `changeLanguage`, che e' **asincrona**: subito dopo averla chiamata `t` risponde ancora nella
  lingua di prima. Leggere il `ref` dentro `t` fa anche da dipendenza reattiva — e' quel che
  sostituisce il solo servizio che il plugin di Vue dava gratis.
- ⚠️ **`escapeValue: false` non e' facoltativo**: col valore di serie `L'Ange thuriféraire`
  diventa `L&#39;Ange` a schermo. E' sicuro perche' Vue interpola testo come testo — **nessuno
  di questi messaggi deve mai finire in un `v-html`**.
- Sparito `fallbackFormat`: `i18next` interpola da se' una chiave che non trova, che qui e' il
  caso normale (l'italiano non ha catalogo). Il difetto delle graffe non e' piu' possibile.

**Verificato in chromium**: italiano `Tappa 1 di 13` e nessuna graffa; cambio lingua dentro la
visita → `跳至内容 · 退出 · 第 1 站，共 13 站` con **una sola navigazione** (ridisegna, non
ricarica) e ritorno all'italiano; avvio con telefono `zh-CN` ancora cinese; `stato` 232/232 su
12 lingue; `vue-tsc` verde; zero errori in console.

⚠️ **Cambiando dipendenza il dev server va riavviato** (`docker restart node-con`): Vite
ottimizza le dipendenze all'avvio e non si accorge da solo dello scambio.

### E via headless UI, che era una dipendenza per un componente

Trovata guardando la trappola qui sopra — il combobox che una prova non riesce a pilotare.

- **`@headlessui/tailwindcss` era morto in tutt'e due le applicazioni**: caricato come plugin
  nei due fogli di stile per dare le varianti `ui-open:`/`ui-selected:`, che **nessuno usa**.
  Nel marketplace non poteva nemmeno funzionare — li' non c'e' Vue e non c'e' nessun
  componente headless. Tolto da `main.css`, da `style.css` e dai due `package.json`.
- **`@headlessui/vue` serviva a un file solo** (1,1 MB per un componente). `LanguageSelector`
  e' ora un `<select>` nativo: **126 righe → 40**, ed e' lo stesso controllo che la scheda
  usa gia' per la stessa scelta — una scelta sola, un vocabolario solo. Su un telefono il
  nativo apre il selettore del sistema, che e' meglio di una lista disegnata da noi.
- Ci va dietro la ricerca per codice (`zh`, `ru`) aggiunta poche ore prima: serviva perche' i
  nomi sono scritti nella propria lingua e senza quella tastiera non si digitano. Con tredici
  voci tutte visibili non c'e' piu' niente da digitare.

⚠️ **Tailwind non c'entra e resta dov'e'**: quello tolto e' un plugin *per* Tailwind. Le due
applicazioni continuano a compilare `@import "tailwindcss"` come prima.

**Verificato**: la biglietteria elenca 13 lingue, il cambio a 中文 ridipinge con **una sola
navigazione**, il ritorno all'italiano pure; la stessa prova dentro la visita non e' cambiata;
`vue-tsc` verde, CSS del marketplace ricostruito, zero errori in console, scatto guardato.

## ⏸ Ripresa — 2026-08-04, l'immagine del meta-item non serve piu'

Chiude la riga di `missing.txt` «l'immagine non dovrebbe essere obbligatoria quando creo un
meta item». Ragionamento in `state.md` §3.1-septies.

- **La figura da cui ripiegare c'era gia'**: e' l'**ancora** della tappa, l'opera davanti a cui
  si sta mentre si ascolta parlare di uno stile. `stopImage()` ora ci arriva, e restituisce
  `{src, name}` invece del solo indirizzo — la didascalia deve dire **il quadro che si vede**,
  non il soggetto della tappa, o la Primavera verrebbe annunciata come «Rinascimento».
- Tolti i due controlli che la pretendevano: il 400 in `POST /items` e `l'immagine` in
  `itemIssues()`. Il **soggetto** resta obbligatorio, il museo pure.
- ⚠️ **Aperto, ed e' una scelta di prodotto**: a schermo niente dice che quella figura e' il
  posto in cui ti trovi e non il soggetto. L'`alt` lo dice (quindi con uno screen reader si
  capisce), una didascalia visibile no. Costa una chiave nuova e un giro di `traduci`.

⚠️ **Difetto vero trovato provando, e NON e' di questo lavoro: i segnaposto non venivano
sostituiti in italiano.** `Tappa {n} di {m}` con le graffe, e solo nella lingua predefinita —
in inglese era giusto, che e' il motivo per cui era passato. In italiano il catalogo non
esiste, quindi ogni chiave e' «mancante» e `missing` ne restituiva la chiave: `vue-i18n` usa
quel valore **senza compilarlo**. Ora `fallbackFormat: true` in `i18n.ts`. Riguarda una
ventina di stringhe (progresso, annunci, punteggio del quiz, studenti collegati).

**Verificato pilotando chromium**, non dedotto: la tappa su uno stile senza immagine mostra
`Q137925932.jpg` — l'opera successiva del percorso — con `alt="Immagine di La route de
Verrières"`; la tappa 2, opera vera, non e' cambiata; `3 tappe` e `Tappa 1 di 3` in italiano
prima e dopo la correzione; l'editor del marketplace risponde `[]` a un contenuto su uno stile
senza immagine e `["il soggetto"]` senza nome. Zero errori in console, scatti guardati.
Tre type-check verdi, `dist` ricostruito, `stato` a 228/228 su 12 lingue e zero residui.
**Dati usa e getta rimossi** con la cascata (item + visita), zero residui `ZZ` nel database.

⚠️ Il server va **riavviato** (`docker restart node-con`, ~35s) o si prova la rotta vecchia.

### E la lingua adesso la propone il telefono

Segnalato: «per un cinese sara' difficile scegliere». Vero, e non per l'elenco — i nomi delle
lingue sono gia' scritti nella lingua stessa (中文, Русский) — ma perche' la **prima** schermata
la leggi prima di poter scegliere, e partiva sempre in italiano.

- `loadLanguage()`: quella gia' scelta → **quella del telefono** (`navigator.languages`,
  codice intero e poi radice) → l'italiano. Un telefono `zh-CN` apre tutto in cinese.
- Il filtro del selettore cerca anche nel **codice**: i nomi sono scritti nella lingua stessa,
  quindi senza quella tastiera non si possono digitare — `zh`, `ru`, `de` invece si'.
- **Verificato in chromium** con `--lang` e `Emulation.setLocaleOverride`: `zh-CN` → 选择你的参观路线。
  e `<html lang="zh-CN">`; `en-GB` → radice `en`; `ja` → giapponese. Zero chiavi nuove.

### Anche i toni, ed e' il secondo punto a chiave calcolata

`Infantile · Semplice · Medio · Avanzato` restavano italiani in mezzo al cinese. Non sono dati:
stanno in `shared/constants.ts`, quindi sono programma come le etichette del vocabolario
controllato — e come quelle l'estrattore le raccoglie **a parte**, perche' nel sorgente si legge
`t(v.level)` e una scansione del testo non vedrebbe mai la chiave. **Catalogo 228 → 232.**

⚠️ **Si traduce quel che si legge, non il valore.** `Medio` resta `Medio` nel database, nel
confronto del filtro e nella richiesta al server: tradurre il valore vorrebbe dire che un filtro
scelto in cinese non trova piu' niente. Provato — con la tendina su `进阶版` il valore e' `Medio`
e le visite passano da 8 a 2.

⚠️ **Il glossario ha dovuto imparare i quattro toni**, e per la ragione gia' pagata una volta:
`Infantile` senza spiegazione diventa *puerile* o *sciocco*. Ora la voce dice in italiano che
e' «il tono di chi racconta a un bambino, con parole semplici e affetto; NON puerile». Il
risultato: `Kid-friendly`, `儿童版`, `子供向け`, `Für Kinder`, `Детский` — nessuno spregiativo.
Nella stessa passata sono uscite dal glossario e dal prompt le parole inglesi finite dentro la
prosa italiana (`il catalog dei contenuti`, `per keys ESATTAMENTE`) e dai messaggi di `stato`
(`orphans`, `stray dal catalog`).

I **nomi delle visite** restano italiani: quelli sono dati.

## ⏸ Ripresa — 2026-08-04, l'interfaccia del navigator nelle 13 lingue

**Tutto il navigator: 228 chiavi, 12 lingue.** Ragionamento in `state.md` §5.6.

- `vue-i18n@11`; `navigator/src/i18n.ts` e' l'istanza, agganciata al `ref` `language` che
  c'era gia'. Cataloghi in `shared/i18n/`, **uno per lingua e nessuno per l'italiano**: la
  chiave e' la frase italiana, quindi l'originale sta nel sorgente e non puo' mancare.
- `server/src/scripts/languages.ts` — `chiavi · residui · traduci [codice] [--tutto] · pota · stato`.
  `traduci` riempie **solo i buchi**, quindi una traduzione corretta a mano resta, e
  scrive **a ogni blocco**, quindi interromperlo non butta via il fatto.
- **Un `t` globale importato**, non `useI18n()`: diciassette file su diciannove hanno
  stringhe anche nello script, e alcuni sono moduli `.ts` dove `useI18n()` non si puo'
  chiamare.
- I **plurali** sono quattro in tutto e sono due chiavi scelte con un `if`
  (`t("1 tappa")` / `t("{n} tappe")`), non le forme con `|`: il ramo c'era gia'.

**Il giro quando si cambia l'interfaccia** (dettaglio in `shared/i18n/README.md`):
`t("…")` in italiano → **`residui`** (deve dire nessuna) → **`traduci`** (costa solo le
chiavi nuove) → **`pota`** (toglie le traduzioni delle frasi cancellate) → **`stato`**.
⚠️ I due che nessuno ricorda sono `residui` e `pota`, e non sono simmetrici: saltare `pota`
lascia file piu' grassi, saltare `residui` lascia **una frase italiana in mezzo al cinese** —
e l'avviso del runtime li' non aiuta, perche' una stringa mai avvolta non risulta «mancante».

⚠️ **`residui` guarda solo i template.** Le stringhe negli script (`announce`, messaggi
d'errore) non le elenca: distinguerle da chiavi e classi CSS sarebbe indovinare. Sono state
trovate a mano; la rete di sicurezza sono le altre due — l'avviso del runtime sulle chiavi
mancanti, e la prova in browser che cerca parole italiane a schermo con la lingua impostata
su un'altra.

⚠️ **Il glossario si SPIEGA, non si traduce** — difetto vero trovato guardando uno scatto,
non deducendo. Il glossario diceva `"tappa" = ... (stop / Station / 站点)` e il modello ha
ricopiato quella resa invece di cercare la parola giusta: **quattro lingue** dicevano la
fermata dell'autobus — ステーション, 下一站, 정거장, станция. Ora le voci descrivono in italiano
che cosa la parola significa. Regola: se una voce del glossario contiene una parola straniera,
il modello la usera'.

⚠️ **Le chiavi si raccolgono a commenti tolti.** `t("Esci")` scritto in un commento
d'intestazione finiva in catalogo come chiave vera — la stessa trappola dello script di
rinominazione (`guidelines.md`).

⚠️ **Duecento chiavi in una richiesta sola non tornano.** La risposta sfonda il tetto dei
token e arriva un JSON troncato, cioe' non valido — e il messaggio era «risposta non JSON»,
che sembra un guasto del modello e invece e' una richiesta troppo grossa. Ha colpito
**cinese, giapponese e coreano**, dove i valori pesano in token piu' di quanto sembrino in
caratteri. Ora si va a blocchi di **40** (`PER_BLOCCO`).

⚠️ **`i18n.ts` non deve importare niente del navigator.** Traducendo `api.ts` si era chiuso
l'anello i18n → state → api → i18n e l'app partiva bianca («Cannot access 'language' before
initialization»). Un import circolare **compila**, quindi i type-check erano verdi: l'ha visto
solo il browser. La lingua ora la spinge `state.ts` con `setLocale`; `i18n` e' una foglia.

⚠️ **Lo spezzatore dei template deve saltare virgolette ed espressioni.** Un `>` dentro un
attributo (`v-if="n > 0"`, `@action="(a) => …"`) e un `<` dentro un'espressione
(`{{ n < 0 ? … }}`) tagliavano il tag a meta' e facevano passare per «testo da tradurre»
pezzi di markup: sette falsi allarmi su otto file.

⚠️ **Il vocabolario controllato ha la chiave nei DATI**, non nel codice: nel sorgente si
legge `t(o.label)`, quindi l'estrattore le 22 stringhe di `options` le prende da
`shared/constants.ts` a parte. E' l'unico punto del navigator con una chiave calcolata.

⚠️ **`navigator/node_modules` era di root** e non lo e' piu' (`chown -R` sull'albero).
Erano di root anche **tre dei quattro JSON dei musei** — cioe' gli *input* della genericita':
il curatore non poteva modificarli. Ora si'.

---

## ⏸ Ripresa — 2026-08-04, la strada per la prossima tappa

Chiude la riga di `missing.txt` «indicazioni per arrivare a una opera». Ragionamento in
`state.md` §5.3-sexies.

- **Nessuna rotta nuova sul server.** `POST /wayfinding` accettava gia' un qid come
  destinazione: nel grafo `GraphNode.id` di un nodo-opera *e'* il qid. Per la ricerca del
  cammino il bagno e un quadro sono lo stesso caso, quindi non c'e' nessun ramo da aggiungere.
- **`NEXT_STOP_COMMAND`** in `shared/constants.ts`: l'id sta li' perche' lo confrontano
  `Visita.vue` (per risolvere il qid) e `Pannello.vue` (per spegnere il bottone). Riscrivere la
  stringa in tre file e' il modo in cui le due meta' smettono di essere d'accordo.
- **Si punta all'ANCORA della tappa successiva, non alla sua opera**: una tappa su uno stile non
  ha un posto sulla pianta, la sua ancora si'. Nessun ramo nuovo — `buildStops()` ce l'ha gia'.
- ⚠️ **Chiedere la strada non e' andarci.** La tappa aperta non cambia: e' il teletrasporto
  rovesciato (li' si sposta senza aprire).
- ⚠️ **Il bottone si spegne all'ultima tappa e per lo studente guidato**, ma la **voce ci arriva
  lo stesso**: `actionHandler` annuncia «sei all'ultima» invece di non fare niente. Un comando
  riconosciuto, ripetuto e poi silenzioso e' il difetto gia' pagato in `state.md` §3.2.

**Difetto vero trovato provando, non deducendo:** a inizio visita la tappa di riferimento e'
*gia'* la prossima, quindi il percorso andava da un punto a se stesso e le indicazioni
dettagliate dicevano «siete gia' nella sala corretta» a chi stava ancora alla porta. Ora una
**partenza vuota vuol dire l'ingresso** (`data-poi="entrance"`, che ogni pianta dichiara).
Un `from` *sconosciuto* resta un errore: sono due cose diverse.

**Verificato**: 22 controlli in chromium su due tornate, zero errori in console, scatti guardati
a 1400 e 390px. Il controllo che conta e' a meta' visita — la sala mostrata coincide con quella
che l'API da' per la coppia (3 → 4), e la controprova (3 → 3) ne dava un'altra. Piu' le rotte:
partenza vuota, partenza inventata, servizi invariati. Tre type-check verdi.

⚠️ **Non provato: lo studente in visita guidata** — nel database non c'e' nessuna visita guidata
(0 su 36). Serve `npx ts-node src/scripts/seed.ts speciali`.

⚠️ **`ts-node` non ha un watcher**: `npm run start` e' `npx ts-node src/index.ts` e basta, e
`getMuseumGraph` tiene in cache la pianta. Toccando il server va **riavviato `node-con`**
(~35s), altrimenti si prova il codice vecchio credendo di provare il nuovo.

---

## ⏸ Ripresa — 2026-08-03, le sessioni

L'identita' non sta piu' nell'indirizzo. Ragionamento e alternative scartate in `state.md`
§"Le sessioni"; qui quel che serve per proseguire.

- **Un biglietto opaco** coniato in `login`/`register` (i due soli punti dove una password si
  verifica), mandato in `Authorization: Bearer …`, risolto da `resolveSession` montata su tutto
  `/api`. Le rotte leggono `sessionUser(req)`. **Nessun `?user=` e nessun `username` in un
  percorso o in un corpo**: `POST /users/:username/buy` e' diventata `POST /users/buy`,
  `GET /:username/sales` e' `GET /sales`.
- **La sessione sta in Mongo** (`models/session.ts`, indice TTL su `expiresAt`) e non in una
  `Map`: `ts-node` riparte a ogni modifica, e in memoria ogni riavvio butterebbe fuori tutti.
- **Nel client sta in `sessionStorage`**, in tutt'e due le applicazioni: sopravvive al
  ricaricamento e al viaggio verso il navigator, muore chiudendo la scheda. E' il motivo per cui
  la soglia resta raggiungibile riaprendo l'applicazione — la proprieta' la cui perdita aveva
  fatto togliere la persistenza la prima volta.
- ⚠️ **Si entra dal marketplace.** Il navigator aperto da solo non ha sessione e lo dice invece
  di rompersi. Per lo stesso motivo e' sparita la porta anonima della soglia.
- ⚠️ **Un biglietto per ogni viaggio**, non per accesso: vale una volta sola, quindi
  `openNavigator()` ne chiede uno fresco al momento del tocco. I collegamenti al navigator sono
  percio' diventati `<button @click>` — erano `<a :href>`, e un indirizzo si scrive quando la
  pagina si disegna, cioe' troppo presto.

**Difetti veri che questo chiude** (riprodotti prima, non dedotti): chiunque poteva spendere il
portafoglio di un altro (`POST /users/:username/buy` prendeva il nome dal percorso), pubblicare
a nome di un altro e vederselo comparire nel suo resoconto vendite, leggere i testi a pagamento
altrui cambiando `?user=`, e **guidare la classe di un altro docente** — quel controllo era
`if (req.body.teacher && req.body.teacher !== s.teacher)`, che **non mandando niente si
superava**.

**Codice tolto perche' rimasto senza usi:** `state.user` e `state.handoff` nel navigator,
`guidedUser` in `guided.ts`, il campo `handoff` e `redeemHandoff()` nel marketplace,
`navigatorUrlBase()` (era diventata identica a `navigatorUrl`), `sampleUrl()` e la porta
anonima, `autore: this.currentUser` nei due payload (il server lo ignora: lo decide la
sessione), la vecchia `Map` in memoria dei biglietti.

⚠️ **`/api/config` porta anche le opere della soglia con la loro immagine**, ed e' voluto: e' la
schermata di chi non e' entrato, quindi non puo' chiedere il catalogo.

⚠️ **Quattro rotte restano aperte** e vanno lasciate tali: `/api/config`,
`/api/users/{login,register,redeem}`, `/api/qr` e `/api/museums/:qid/qrcodes`. Le ultime due
perche' a chiederle e' il **browser** (`<img>` e navigazione di pagina) e a quelle non si puo'
attaccare un'intestazione. Nessun testo a pagamento passa di li'.

**Verificato**: 26 controlli sulle rotte (tutto chiuso senza biglietto, le quattro aperte
aperte, biglietto inventato/senza `Bearer`/speso → 401), 14 sui difetti qui sopra, 11 sulle visite
guidate, **47 in browser via CDP** su marketplace e navigator — accesso, ricaricamento che non
butta fuori, andata e ritorno fra le due origini con la sessione che regge, autore, curatore,
sessione scaduta che riporta alla soglia. Zero errori in console, scatti guardati davvero. Tre
type-check verdi, `marketplace/dist` ricostruito. **Dati usa e getta rimossi**: database
riportato alla fotografia iniziale (items 1177, visits 36, users 12, sessions 0, i due
visitatori a €100).

### Due regressioni segnalate subito dopo, e corrette

1. **La soglia non componeva piu' le figure.** `loadShapes()` chiedeva `/api/artworks` per
   pescarne sei — ma la soglia e' la schermata di chi NON e' entrato, e il catalogo ora vuole
   una sessione: rispondeva 401, l'elenco arrivava vuoto e lo sciame restava senza forme.
   Ora le opere della soglia arrivano gia' risolte in `{qid, imagePath}` da **`/api/config`**,
   che e' aperta. Ne esce anche piu' leggera di prima: scaricava 143 opere per usarne sei.
2. **Un lampo di soglia a ogni ricaricamento**, poi il salto alla home. `view` partiva da
   `"soglia"`, ma prima che `start()` abbia speso il biglietto **non si sa** che schermata sia:
   la pagina diceva "non sei entrato" a chi era entrato. Ora la partenza e' `"avvio"`, che non
   corrisponde a nessuna schermata — finche' non si sa, non si disegna. Verificato campionando
   `view` ogni 40 ms durante il ricaricamento: `soglia` non compare mai.

⚠️ **Trappole della prova, non del codice.** `Alpine.$data(el)` — `el.__x.$data` e' Alpine 2 e
qui lancia. E andare da `/` a `/#/vetrina` e' un cambio di hash, **non un ricaricamento**: il
modulo non si rivaluta, quindi una prova che manomette `sessionStorage` e poi "naviga" non prova
niente. Ci vuole `location.reload()`.

---

## ⏸ Ripresa — 2026-08-03, un contenuto puo' parlare di uno stile

La richiesta piu' grossa di `missing.txt`, e l'ultima riga di specifica scoperta: la slide 21
vuole item «sia sugli oggetti della visita, sia su contenuti associati (movimenti culturali,
stili, artisti, eventi storici)», e finora `Item.about` era obbligatorio e puntava a un'opera.
Ragionamento in `state.md` §3.1-septies (dati) e §5.3-quinquies (navigator).

- **Un campo, non una tabella.** L'item porta `kind`, e da quello dipende tutto: `opera` ⇒
  c'e' `about`; qualunque altro genere ⇒ c'e' `subject` (il nome scritto dall'autore) e
  `imagePath`. ⚠️ **Niente collezione dei soggetti**: uno stile non esiste finche' non c'e' un
  contenuto che ne parla, e una tabella di soggetti avrebbe righe che nessuno sa quando
  cancellare. Il raggruppamento del catalogo usa `genere:nome` dove usava l'`@id` dell'opera.
- **I nomi li da' il museo**, non un elenco nel codice: `GET /museums/:qid/topics` restituisce
  stili e autori che le sue opere gia' dichiarano, e l'editor li mette in un `datalist`.
  Scritto uguale, il contenuto si ritrova dalla pastiglia dello stile sulla pagina dell'opera —
  che ora e' un collegamento, ma **solo se qualcuno ne ha scritto**: un link a una pagina vuota
  e' peggio di nessun link.
- **L'immagine e' dell'item** quando il soggetto non e' un'opera, ed e' obbligatoria: non c'e'
  nessun quadro da cui ripiegare. La nomina il **server** (`POST /items/image`) e la
  cancellazione dell'item la toglie dal disco. ⚠️ Un'immagine caricata e mai pubblicata resta
  li': sono due richieste, e la seconda puo' non arrivare.
- **L'ANCORA** e' la parte da spiegare a voce: una tappa che non e' un'opera prende la
  posizione della **prossima opera** del percorso. Cosi' un contenuto sul Rinascimento messo
  davanti a quelle sale ti porta davanti al primo quadro mentre lo ascolti. Sulla pianta non
  serve nessun ramo nuovo: la tappa cade nel raggruppamento che gia' esisteva per due
  descrizioni dello stesso oggetto, e il disco porta "Tappe 1, 2".
- ⚠️ **Il seed i soggetti li crea ma non li mette in nessuna visita.** Ci aveva provato — in
  testa a ogni visita di catalogo — ed era una scelta di curatela presa da un'enumerazione
  meccanica: quale stile apra quale percorso non lo sa il seed. Le visite seminate contengono
  solo opere; per la dimostrazione dell'ancora si compone una visita nel marketplace mettendo
  il contenuto sullo stile dove ha senso.
- ⚠️ **La trappola:** `isItem()` distingueva item e visita con `"about" in c`. Reso opzionale
  `about`, ogni contenuto non-opera sarebbe sparito dagli elenchi delle due app insieme, senza
  errori. Ora guarda `kind`.

**Il database non e' stato riseminato**: `npx ts-node src/scripts/testers.ts generi` ha riempito `kind`
e `ofMuseum` sui **751 item** che c'erano (0 orfani), e `npx ts-node src/scripts/seed.ts Q6373` ha
aggiunto i due soggetti del British — *scultura ellenistica* e *Alfred Sisley*, 16 item — e
rifatto le sue 8 visite di catalogo, che ora si aprono con quelle due tappe. Gli altri tre
musei hanno solo la migrazione: per avere i loro soggetti serve `seed.ts <qid>` (16 chiamate
LLM per museo, ~2 minuti).

**Verificato pilotando chromium**, non dedotto: 14 controlli sul marketplace (l'editor che
cambia forma col genere, il caricamento vero di un'immagine, il rifiuto di un file che
immagine non e', «Manca ancora: il soggetto, l'immagine», la pubblicazione, la pagina del
soggetto, il testo che arriva dalla rotta nuova, la pastiglia dello stile) e 11 sul navigator
(la visita che si apre su due tappe non-opera, il segnalino sull'opera successiva, il disco con
tre numeri, l'elenco che dice nome e genere). Zero errori in console, scatti guardati davvero,
dati usa e getta rimossi. `marketplace/dist` ricostruito.

**Trovato provando, ed e' vecchio quanto il seed:** l'autore di un'opera del British e'
`http://www.wikidata.org/.well-known/genid/…` — Wikidata risponde con l'indirizzo di un nodo
anonimo dove l'entita' non ha etichetta, e quella stringa finiva stampata come nome
dell'autore. Ora i suggerimenti la saltano e la pagina dell'opera mostra "—", ma **il valore
e' ancora nel database** e il navigator lo mostrerebbe: la correzione vera sta in
`manager.populateArtwork`, alla prossima risemina.

---

## ⏸ Ripresa — 2026-08-03, l'ordine di visita lo dichiara la mappa

Chiude la riga di `missing.txt` sullo zig zag. Ragionamento in `state.md` §1.1-quater.

- **`data-flow="3"` sulle sale**, accanto a `data-room` e `data-floor`. Numerate tutte e quattro
  le piante: 5, 6, 10 e 21 sale. Una mappa che non lo dichiara si comporta come prima.
- ⚠️ **Non si calcola.** BFS dall'ingresso o giro goloso erano scrivibili, ma il giro che un
  museo consiglia non e' una proprieta' geometrica — Botticelli prima di Leonardo non si vede
  sulla pianta. Il curatore lo sa gia', ed e' un numero per sala.
- ⚠️ **Alla visita su misura l'ordine non si chiede al modello**: si sceglie con `planVisit` e si
  **riordina la risposta** con `sortByFlow`. Nel prompt sarebbe una speranza, non una garanzia.
- Nel marketplace e' sparito il `sort` alfabetico in `loadCatalogue`: buttava via l'ordine che il
  server aveva appena messo. La libreria del compositore ora segue la percorrenza, quindi
  scegliere dall'alto in basso da' un percorso che non torna indietro.

**Verificato**: i quattro percorsi letti dal grafo (ogni sala una volta sola, il Met cambia piano
una sola volta in fondo), gli ordini serviti da `GET /artworks?museum=` e `GET
/museums/:qid/artworks`, tre type-check verdi, `dist` ricostruito, le due suite in browser
rieseguite — 14 controlli marketplace e 12 navigator, zero errori in console.

⚠️ **Riavviare `node-con` uccide un seed in corso**, che gira come `docker exec` dentro quel
container. Il seed e' riprendibile e non perde niente, ma va rilanciato.

---

## ⏸ Ripresa — 2026-08-02, la scheda non si apre piu' perche' non si chiude mai

Quattro richieste in fila; questa e' la prima. Dettaglio in `state.md` §5.3-ter.

- **Via gli scatti della scheda** (`riposo`/`media`/`piena`) e il bottone che li pilotava, il
  velo, il `dialog` con la mappa `inert`, la chiusura, il pannello «Ho una domanda» della barra
  e il riquadro d'ingresso sotto la mappa: **−136 righe**. La scheda e' un pannello fisso —
  colonna da `lg`, fascia da 55dvh sul telefono — con dentro, in quest'ordine: lingua, opera,
  barra (voce e avanti/indietro), Chiedi/Orientati.
- ⚠️ **Il guscio ora e' alto esattamente lo schermo** (`App.vue`: `h-[100dvh] overflow-hidden`).
  Era `min-h-`, e con la scheda non piu' `fixed` la barra dei comandi finiva **97px sotto il
  bordo** del telefono. Chi ha bisogno di scorrere scorre dentro di se': se si aggiunge una
  schermata lunga va data a lei `overflow-y-auto`, come alla biglietteria.
- Le due meta' della scheda si spartiscono l'altezza `3:2` con `basis-0 grow-[n]`, che si
  ribalta a `2:3` con una risposta aperta. Servono altezze definite: senza `basis-0` i due
  riquadri prendono l'altezza del contenuto e la barra esce dallo schermo.

**Verificato pilotando chromium** (script nello scratchpad), 32 controlli a 1400 e 390 px, zero
errori in console, scatti guardati davvero.

### Le altre tre della stessa tornata

2. **L'esito del comando vocale non si porta piu' appresso.** «Non ho capito» restava scritto
   sotto al microfono per tutto il resto della visita, e sembrava il commento all'opera che si
   stava guardando: `esito` si azzerava solo ripremendo *Parla*. Ora `Comando` riceve la tappa
   e, quando cambia, azzera esito **e** `errorMsg` (che sta in `useSTT` ed e' di modulo, quindi
   sopravvive anche lui). Riprodotto davvero in chromium con il microfono finto
   (`--use-fake-device-for-media-stream`): il messaggio compare, e alla tappa dopo non c'e'.
3. **I servizi della pianta si toccano** (`state.md` §5.3-quater). Nessuna modifica al server:
   `POST /wayfinding` accettava gia' un tipo di POI. ⚠️ Il bersaglio e' il `data-poi` del
   disegno — **non aggiungere una tabella di servizi nel codice**, e' il motivo per cui
   funziona anche l'uscita di emergenza, che nessun comando nomina.
4. **«La barra di ricerca fa uno strano effetto quando scrivo»** — ed era un difetto vero,
   misurato: filtrando da meta' elenco la pagina si accorcia, il browser riporta lo
   scorrimento in fondo (1200 → 139) e **il campo in cui stai scrivendo esce dallo schermo**.
   Ora `.barra` e' incollata in alto (vetrina, libreria, lavori: sono le tre che la usano).
   ⚠️ Sotto `lg` c'e' gia' un'intestazione incollata a `z-30`: la barra ci finiva sotto. Si
   ferma a `--app-bar`, che e' anche l'altezza con cui quell'intestazione e' disegnata —
   se cambia una, cambiano tutt'e due. **`marketplace/dist` ricostruito.**

---

## ⏸ Ripresa — 2026-08-02, come si comincia una visita

«Vorrei un bottone che mi apre la descrizione della prima opera»: non c'era, e non era solo un
bottone mancante. Dettaglio in `state.md` §5.3-bis.

- La scheda esiste solo da `v-if="currentArtwork"`, quindi **appena entrati non c'e' nessun
  comando**: l'unica strada era toccare un disco sulla pianta.
- Le note d'apertura si mostravano da sole con un bottone **«Continua»** che non continuava:
  `target: -1` chiudeva il riquadro e lasciava la visita ferma. Ora apre la prima tappa.
- Con nessuna tappa aperta compare un comando solo, largo quanto lo schermo, dove poi sta la
  scheda: *Inizia dalla prima tappa* / *Riapri la tappa*. Il secondo chiude anche «da mobile se
  chiudo la card non riesco a riaprirla».
- Da tappa aperta in poi non serviva niente: la scheda a riposo tiene gia' avanti/indietro.

**Verificato in browser** a 1400 e a 390 px, 6 controlli piu' gli scatti guardati: la porta
c'e' senza toccare la pianta, «Continua» entra nella tappa 1, si avanza alla 2, e chiudendo la
scheda compare *Riapri la tappa*. Zero errori in console. Rieseguite le tre tornate del
navigator (piani 13/13, tappa seguita 4/4, annunci 5/5). Visita usa e getta rimossa.

---

## ⏸ Ripresa — 2026-08-02, il server rifiuta, il client suggerisce

Scansione del client per capire cosa gli restasse di logica non sua. Dettaglio in `state.md`
§3.1-sexies. Il risultato grosso e' un difetto vero:

⚠️ **Il prezzo negativo coniava denaro.** Nessuno rifiutava `prezzo: -99` su un item: dentro
una visita porta il totale sotto zero e `wallet = credito − totale` **aggiunge**. Comprando,
il portafoglio andava da **€ 100 a € 199**. Ora `POST /items` e `POST /visits` rifiutano prezzo
negativo, testo vuoto e visita senza tappe.

- **Il client fa la precheck, il server decide.** Restano nel client le domande di pura forma
  (campo vuoto, nessuna tappa), che alimentano «Manca ancora: …» mentre si scrive; sono usciti
  il prezzo e il possesso, che richiedono di sapere cose che sa solo il server.
- **`WORDS_PER_MINUTE` in `shared/constants.ts`**: le 100 parole al minuto erano scritte in
  `llm.ts` e in `state.ts`, ed e' lo stesso cambio durata↔lunghezza visto dai due lati.

⚠️ **Trappola in cui sono ricascato**, ed e' gia' scritta qui sotto: `.barra-salva` esiste
anche nell'editor delle descrizioni, che sta prima nel documento ed e' solo `x-show`-nascosto.
Va presa quella con `offsetParent !== null`, o la prova legge la barra sbagliata.

⚠️ **E una nuova**: TypeScript non segnala il codice irraggiungibile. Tre controlli inseriti
per sbaglio DOPO un `return`, dentro la guardia del titolo, compilavano benissimo e non
scattavano mai. Se ne e' accorta solo la prova contro il server: `tsc` verde non vuol dire che
la riga venga eseguita.

**Verificato**: i quattro rifiuti e il caso valido contro il server vivo; 15 controlli in
browser (compositore, editor, binario, e la barra «Manca ancora» che dice ancora forma ma non
piu' prezzo), zero errori in console. Dati usa e getta rimossi: 750 item, 27 visite, i due
visitatori a €100.

---

## ⏸ Ripresa — 2026-08-02, la regola di lettura in `shared/`

Chiude la fragilita' segnalata: la regola «si legge se e' gratuito, tuo o comprato» era scritta
**cinque volte** (`server/access.ts`, il controllo delle guidate in `routes/visits.ts`, e nel
marketplace `availableNow`, `allowedInGuided` e una copia in linea in `editorLibrary`) ed era
gia' andata fuori sincrono — da li' veniva il difetto del gratuito da comprare. Dettaglio in
`state.md` §3.1-quinquies.

- **`shared/access.ts`** (nuovo): `isReadable(contenuto, utente, posseduto)`. Il possesso lo
  risolve il chiamante — `Set` sul server, array sul client — cosi' qui c'e' la regola e li'
  la ricerca. `server/src/access.ts` e il marketplace la chiamano tutti e due.
- **Due predicati, non uno**: `canRead()` (posso leggerlo) e `inLibrary()` (me lo sono preso).
  Non si fondono: con la regola sbagliata o si chiede di comprare il gratuito, o la Libreria
  diventa tutto il catalogo. `owns()` e' stato rinominato `inLibrary()` perche' sembrava la
  domanda piu' forte ed era la piu' stretta — **9 binding Alpine rinominati**, che sono
  stringhe e nessun compilatore le guarda: riprovare in browser dopo averli toccati.
- **Trovato distinguendole**: nella pagina di un'opera «Leggi» era legato a `inLibrary`, quindi
  una descrizione **gratuita** stava dietro «Ottieni» mentre il server ne mandava gia' il testo.
  Ora «Leggi» segue `canRead` e «Tieni in libreria» e' un'azione a parte.
- **I soldi li conta solo il server** (`server/src/pricing.ts`). Via da `state.ts`
  `purchaseCost`, `missingCost`, `missingItems` e il totale «atteso» col suo 409: le visite
  arrivano da `GET /visits?user=` con dentro `mancanti`, `costoMancanti`, `totale`, e il client
  li scrive. Stessa funzione per mostrare e per addebitare.
  ⚠️ Il conto invecchia con l'acquisto: `performPurchase` rilegge le visite. E le tappe di
  tutte le visite si prendono con **una** query — non una per visita.

**Verificato in browser**, 25 controlli in tre tornate, zero errori in console: la vetrina, la
pagina della visita, la pagina dell'opera (gratuite che si leggono subito e a pagamento che si
sbloccano), l'acquisto unico €100 → €86,50, la Libreria che **non** e' diventata il catalogo,
piu' le due tornate precedenti rieseguite intere per le regressioni del rinominamento. Sulle
API: `atteso` sbagliato → 409, `atteso` giusto → acquisto. Dati usa e getta rimossi (750 item,
27 visite, i due visitatori a €100).

---

## ⏸ Ripresa — 2026-08-02, comprare una visita compra le sue tappe

Il terzo caso del collega — visita a € 2,50 con dentro € 14 di descrizioni, comprata la
visita te ne chiedeva altri 14 — non era un errore di conto ma il modello: due acquisti
distinti, mai dichiarati. **Ora l'acquisto e' uno** (`state.md` §3.1-quater).

- `POST /users/:username/buy` su una visita prende anche le sue tappe **a pagamento e non
  ancora tue**, ognuna al suo prezzo: ogni autore incassa la sua adozione, e una visita da
  due euro non regala quattordici euro di contenuti altrui.
- Il conto si dice **prima**: `Sblocca visita e contenuti (€ 16.50)` sul bottone, scomposto
  nella conferma. La conferma compare anche su una visita **gratis** con tappe a pagamento —
  prima quel caso passava dal ramo "e' gratis, prendila e basta" e avrebbe pagato in silenzio.
- **Transazione unica**: prima il client comprava in un ciclo, una richiesta per tappa, e a
  credito insufficiente si restava pagati e incompleti. Vale anche per «Sblocca i contenuti
  mancanti», che era rimasto un ciclo: **non si compra a rate**, credito corto vuol dire
  acquisto non fatto.
- ⚠️ **«Completare» non e' «comprare»**, e il codice non deve dirlo: la visita ce l'hai gia',
  quel che compri sono le descrizioni che le mancano. Le due strade usano la stessa richiesta
  soltanto perche' quella prende sempre e solo quel che non hai — la visita, gia' tua, non
  entra nel conto.

**Verificato ricostruendo il caso e poi smontandolo** (database ricontrollato: 750 item, 27
visite, `visitatore1` e `visitatore2` di nuovo a €100). 5 controlli in browser, zero errori in
console: bottone a € 16,50, conferma che scompone 2,50 + 14,00, acquisto unico €100 → €83,50,
e poi solo «Inizia la visita». Piu' quattro prove sulle API: le tre descrizioni di `autore2`
risultano ognuna 1 adozione e il suo ricavo (5, 6, 3) e la visita di `autore1` 1 adozione e
€ 2,50; ricomprare non muove il portafoglio; chi possiede gia' una tappa da € 6 paga € 10,50 e
non € 16,50; con € 5 di credito la richiesta viene rifiutata **senza prendere niente**.

---

## ⏸ Ripresa — 2026-08-02, «Sblocca tutto» → «Visitatore non trovato»

Segnalazione del collega: da autore, sulla **sua** visita, lo sblocco falliva dicendo
«Visitatore non trovato». **E' un difetto, anzi due.** Causa e ragionamento in `state.md`
§3.1-ter; qui quel che serve per proseguire.

1. `missingItems()` misurava con `owns()` («ce l'ho in libreria») invece che con
   `availableNow()` («gratuito, mio, o comprato»), che e' la regola del server in `access.ts`.
   Il marketplace chiedeva di comprare quel che il server regala: **lo sblocco costava €0,00**.
2. Un autore **non puo' comprare** — il portafoglio sta solo sul visitatore — ma i tre bottoni
   di sblocco delle *visite* non erano riservati ai visitatori come lo era gia' quello delle
   descrizioni. Ora passano da `canBuy()`, e l'autore legge il motivo invece di sbattere sul
   404. Il 404 stesso, se il nome esiste con un altro ruolo, ora lo dice.

⚠️ **Nel database non esiste nessun contenuto a pagamento** (0 su 750): e' il motivo per cui
il primo difetto si vedeva ovunque, ed e' anche il motivo per cui il paywall non lo esercita
mai nessuno. Per provare il percorso a pagamento bisogna **fabbricarsi** un item con un
prezzo — vale la pena seminarne qualcuno per la dimostrazione, altrimenti meta' del
marketplace (prezzi, credito, adozioni, ricavo) non ha dati che la mettano alla prova.

**Verificato riproducendo davvero**, con dati usa e getta poi **rimossi** (database
ricontrollato: 750 item, 27 visite, `visitatore1` di nuovo a €100 con la sua sola descrizione).
Prima della correzione: visita gratis di autore1, tutta di descrizioni gratis →
«Sblocca 2 contenuti mancanti (€ 0.00)» → «Sblocca tutto» → **«Visitatore non trovato»**.
Dopo: 10 controlli verdi in chromium, zero errori in console — l'autore sulla sua visita gratis
la avvia e basta; sulla sua visita con dentro una descrizione a pagamento altrui non gli si
offre nessuno sblocco e l'avviso dice perche'; il visitatore la prende in libreria, vede
«Sblocca 1 contenuti mancanti (€ 3.00)», compra (€100 → €97) e parte; e una visita gratis del
catalogo non chiede piu' di sbloccare niente.

---

## ⏸ Ripresa — 2026-08-02, cinque asperita' del marketplace

Cinque voci di `missing.txt`, tutte nel marketplace. Il ragionamento sta in `state.md`
§4.1, §4.12 e §4.13; qui il minimo per proseguire.

1. **Le voci dell'autore dicono l'azione**: `Contenuti · Descrizione · Visita` →
   `I miei contenuti · Crea descrizione · Crea visita`. Guardate anche a 390 px, dove il
   binario e' una barra in basso: stanno su una riga sola, non vanno a capo.
2. **L'opera si vede mentre la si descrive.** Seconda colonna da `lg`, appiccicata in alto;
   sotto `lg` apre la pagina e non e' appiccicata (con la barra di salvataggio incollata in
   basso, su un telefono non restava schermo per scrivere). `draftArtwork()` e
   `draftArtworkFacts()` in `state.ts`, la seconda salta gli `Unknown` di Wikidata.
3. **Il compositore e' una strada**: si pubblica solo dall'ultimo passo, prima il bottone
   dice `Continua · Impostazioni` e poi `Continua · Quiz`. Quale sia l'ultimo passo lo sa
   solo `nextVisitStep()`, perche' il quiz esiste solo per le visite guidate.
4. **Il "Salta al contenuto" invisibile che non faceva niente** non era un mistero: e' il
   collegamento di salto per chi naviga da tastiera, sr-only finche' non prende il fuoco. Su
   soglia e accesso pero' puntava a `#contenuto`, che li' e' dentro un sottoalbero
   `display:none` — quindi si prendeva il primo Tab della pagina e non portava da nessuna
   parte. Ora tutti e due i salti seguono `guscioMontato()`.

**Verificato in chromium via CDP**, non solo compilato — sono binding Alpine, che nessun
compilatore controlla: 15 controlli (salti spenti su soglia e accesso, accesi e con i bersagli
visibili una volta dentro, le tre voci nuove, il pannello dell'opera vuoto e pieno, immagine,
`position: sticky`, l'opera ancora in vista col testo al centro, la catena
percorso → impostazioni → pubblica e percorso → impostazioni → quiz → attiva), zero errori in
console, piu' gli scatti a 1400 px e a 390 px guardati davvero. **`marketplace/dist`
ricostruito.**

⚠️ **Trappola della prova:** `.barra-salva` esiste anche nell'editor delle descrizioni, che
sta PRIMA nel documento ed e' solo `x-show`-nascosto — `querySelector('.barra-salva button')`
prende quello e fa sembrare che la catena dei passi non funzioni. Va presa la barra con
`offsetParent !== null`.

---

## ⏸ Ripresa — 2026-08-02, i piani

**Fatto:** un museo puo' avere piu' piani. Il ragionamento e il contratto stanno in `state.md`
§1.1-ter; qui resta quel che serve a chi prosegue.

- **Server:** `svgGraph.ts` legge `<g data-floor data-floor-label>` e riempie
  `MuseumGraph.floors`; `wayfinding.ts` mette `floor`+`floorLabel` su ogni `RouteStep`;
  `llm.ts` scrive `SALI/SCENDI al <etichetta>` nel prompt dove il piano cambia; la risposta
  semplice aggiunge `(Primo piano)` solo se il piano cambia davvero.
- **Navigator:** `Stage.vue` ha il selettore dei piani, che compare solo con piu' d'uno e
  **inquadra** un piano per volta col `viewBox` invece di nascondere gli altri.
- **Mappa:** il **Metropolitan** e' ora su due piani — e' l'unica pianta che li abbia, apposta,
  cosi' le altre tre restano la prova che un museo a un piano solo non e' cambiato.
  `art-8` e `art-13` sono saliti di sopra: `id` e `data-qid` sono gli stessi, quindi
  `locationId` nel database non si muove e **non serve riseminare**.

**Verificato**, non dedotto: 4 piante parsate (le tre vecchie danno `floors: []` e grafo
identico), percorsi che salgono e scendono in tutti e due i versi, l'avviso sulle sale omonime,
un `<g>` dentro un commento che non sposta piu' il piano; **22 controlli** in chromium via CDP
(selettore, etichette dalla mappa, `viewBox` che combacia col `getBBox` del gruppo, l'opera di
sotto fuori dal riquadro, la pianta che segue la tappa aperta, i tre annunci, il British
immutato), zero errori in console, piu' gli scatti dei due piani guardati davvero. Server
riavviato e interrogato: `Galleria Superiore (Primo piano)` sulla risposta semplice, «Prosegua
verso lo Scalone e salga al Primo piano» su quella parlata, «Descend to the Ground Floor» in
inglese.

⚠️ **Due trappole della prova, non del codice.** La vista mappa/elenco sta in `localStorage`:
una prova che la lascia su *elenco* fa fallire la successiva con `getBBox` a zero e nessun
numero di tappa, e sembra una regressione grossa. E il `getBBox` di un gruppo si assesta col
caricamento del font: il riquadro puo' differire di ~0,06 unita' da quello che si rimisura
dopo, quindi va confrontato con una tolleranza e non con `===`.

**Difetto vecchio quanto la rotta, trovato provando e corretto:** le indicazioni dettagliate
verso un'opera dicevano il **qid** invece del titolo — «dove si trova la destinazione Q248101».
`GraphNode.label` ripiega su `data-qid` e nessuna delle quattro piante da' un `data-label` ai
nodi-opera, perche' il titolo non e' roba della mappa: e' del database. Ora `RouteIR.to` porta
anche il `qid` (vuoto per i servizi) e `routes/wayfinding.ts` cerca il nome in `Artwork` prima
di far verbalizzare — **solo sulla strada dettagliata**, che e' l'unica che usa quel nome.
Provato sul server vivo: «Per raggiungere la sezione Bronzi del Benin…», e la Toilette del
British resta l'etichetta della mappa.

**A che piano si e' lo dice il selettore, non un sensore** — nessuna misura che l'app fa
distingue un pavimento dall'altro, quindi il piano si **dichiara**, come la posizione col QR o
col teletrasporto. Perche' valga anche per chi non vede, ogni cambio di piano si **annuncia**
(`Pianta: Primo piano`), sia scelto a mano sia seguito da una tappa.

---

## ⏸ Ripresa — 2026-07-31, quarto museo

**Il quarto museo esiste come configurazione, non ancora nel database.** Tutto il codice è
verde (`tsc` server + marketplace, `vue-tsc` navigator) e provato contro Mongo su un database
usa-e-getta, ma **il seed vero non è stato lanciato**: sono ~832 chiamate all'LLM, circa due ore.

⚠️ **La quota gratuita di Gemini è 500 richieste al giorno per modello, e il seed ne ha
bisogno di una per descrizione.** Il primo giorno si è fermato a **438/832** (56 opere su 104,
nessun testo vuoto o troncato: `populateItem` non scrive un item che il modello non ha
prodotto). Ne restano **394**, che stanno in una quota giornaliera.

**Da fare, in quest'ordine:**

1. `cd server && npx ts-node src/scripts/seed.ts Q51252` — riprende dalle 394 mancanti. Si può
   interrompere e rilanciare: le opere e gli item già scritti li salta, e lo dice riga per riga.
   **Mai con `--force`**: rigenererebbe tutte le 832 e brucerebbe la quota nelle prime 500.
   Quando la quota finisce conviene fermarlo subito, perché ogni item rimasto spende comunque
   i suoi 3 ritentativi senza produrre niente.
2. `npx ts-node src/scripts/seed.ts speciali` — visita guidata + tappe opzionali (il buco aperto da più
   tempo, `state.md` §3.5). Le semina sul **primo** museo configurato, che in ordine alfabetico
   è il British Museum.
3. `npx ts-node src/scripts/testers.ts nomi`.

**Che cos'è cambiato nel codice** (dettaglio e motivi in `state.md` §1.1 e §3.5):

- `data/museumConfigs.ts` (nuovo) legge `data/museums/*.json`, che ora sono l'**ingresso**:
  aggiungere un museo è un JSON più una SVG, senza toccare codice. Cancellati
  `data/museumContent.ts` (l'elenco dei musei in TypeScript) e `services/museumConfig.ts`
  (riscriveva i JSON del curatore a ogni seed).
- `seed.ts` riscritto: un museo per volta, additivo, riprendibile, con CLI. `dbActions.insert*`
  sono diventate create-or-update per `@id`.
- `Artwork.locationId` si risolve cercando il `data-qid` **nella mappa** invece di contare le
  posizioni nell'elenco del file (`GraphNode.elementId`, nuovo).
- Le `logistics` del file di configurazione finiscono in apertura a ogni visita seminata.

**Due cose da sapere prima della dimostrazione:**

- ⚠️ **Un titolo è rotto su Wikidata, non nel codice.** `Q1569622` (la *Maestà di Santa Trinita*
  di Cimabue, terza tappa) ha come etichetta italiana «Madonna in trono col Bambino fra angeli e
  profitieren. ˋMaestà di Santa Trinitá» — con dentro una parola tedesca. È tenuta lo stesso
  perché è la Maestà che nella sala 2 degli Uffizi sta accanto a quelle di Duccio e Giotto, che
  ci sono entrambe. Per toglierla: un qid nel JSON e il `data-qid` del nodo `art-3` nella SVG.
- ~~⚠️ **832 item in un museo solo rendono visibile la paginazione mancante**~~ — **fatto**,
  ed è venuto fuori che non serviva paginare ma togliere i testi dall'elenco (`state.md`
  §3.1-bis). Accesso al museo: **138 KB → 36 KB** sul Louvre, ~1,1 MB → ~285 KB proiettati
  sugli Uffizi. Due rotte nuove (`GET /items/metadata`, `GET /artworks/:qid/items`);
  **`GET /items` è rimasta identica** e ora non la chiama nessuno — tenuta apposta.
  Guidato in chromium per davvero: entrata, vetrina, ricerca, filtro per tono, acquisto,
  apertura di una descrizione col **testo visibile nel DOM**, pagina di una visita, libreria,
  compositore dell'autore. Zero errori in console.

---

## ⏸ Ripresa — 2026-07-30, fine sessione

**Ultimo commit: `015663a curatore`** (ruolo curatore, due schermate, cascata di
eliminazione). Tutto il resto è **in albero, non committato**, e tutto verde: `tsc` ×2 +
`vue-tsc`, `marketplace/dist` ricostruito, server riavviato.

Nell'albero ci sono sei lavori distinti, da committare separati (l'ordine è quello):

1. **catalogo per museo** — `?museum=Qxxx` su artworks/items/visits, `initApp` risolve il
   museo *prima* di scaricare, `GET /museums` porta i conteggi. 453 KB → 153 KB.
2. **indici** — `models/{item,visit,artwork,user}.ts`. COLLSCAN → IXSCAN.
3. **N+1 vendite** — `routes/users.ts`. 314 query → 3; 654 ms → 67 ms; verificato identico.
4. **fix: il terzo ruolo cadeva nel ramo del visitatore** — `roleTitle()`. Difetto
   utente-visibile: **da tenere in un commit suo**, non fuso col refactor.
5. **tipi + logica fuori dai binding** — guardie in `shared/types.ts`, 94→55 `any`,
   10→0 espressioni Alpine lunghe.
6. **`MONGO_URI` in `env.ts`** + `guidelines.md` (nuovo, **untracked**) + `CLAUDE.md`
   (puntava a `spec.md`, cancellato da tempo) + passata sui commenti del marketplace.

**Aperto, in ordine di peso:**
- ⚠️ **nel database non c'è nessuna visita guidata** (0 con `accessKey`, 0 con quiz, 0 con
  tappe opzionali): il modulo I non è dimostrabile. `seedSpecialVisits()` non è mai stato
  eseguito e *oggi funzionerebbe*. Vedi `state.md` §3.5. È il rimedio più economico che c'è.
- passata sui commenti di `server/src` e `navigator/src` (non fatta, non urgente).

**Chiuso il 2026-07-31:** le note logistiche d'apertura che migravano in fondo (§10), la
visita su misura nel marketplace (§11) e il teletrasporto (§9, commit `87abfe2`).

---

**Written 2026-07-27** (restyle, §0–§7). **Extended 2026-07-28** (feedback pass, §8).
Task of the first: implement `prelude.md` end to end. Of the second: twelve corrections
found by actually using it.

> ## ✅ STATUS — all three parts green
> - **Marketplace**: `tsc --noEmit` → exit 0, `npm run build` → exit 0, **`dist` rebuilt**.
> - **Navigator**: `vue-tsc --build` → exit 0, `vite build` → exit 0.
> - **Server**: `tsc --noEmit` → exit 0. **Running and restarted** on :8000, so the current
>   routes are the ones being served.
>
> Nothing is committed — `git status` is the whole diff, two passes deep. **Commit.** See §6.
>
> **Verified live against the running stack** (Mongo + server up in docker): the whole guided
> quiz protocol end to end with two students — open room, join, start, start quiz, both
> submit, marks 3/3 and 2/3, teacher's board, close, planned `terminata` with the mark
> still readable; a guided visit converted **back** to a catalogue visit (`accessKey: null`,
> price restored); `GET /visits/:id` no longer leaking `correct`; the quiz generator run
> against the real catalogue (three sensible questions from the Louvre's own artworks).
>
> ⚠️ **Still never opened in a browser: the whole navigator** — including the command panel,
> the end-of-visit screen and both quiz screens added on 28/07. The marketplace *soglia* has
> been driven for real (§0-bis) and it paid; nothing else has. Expect the same yield.
>
> ⚠️ **`seedSpecialVisits()` is a no-op against the current DB** (§8, `state.md` §3.5) — the
> generated quiz is in the code, not yet in Mongo.
>
> **Alpine bindings were statically verified** (they're strings, so TS never sees them —
> a typo'd method name fails silently and is the classic way an Alpine rewrite breaks):
> all **88 distinct root-scope function calls** in `index.html` resolve to an `AppState`
> member or an Alpine component; all **33 `x-model`** targets point at real fields; every
> view name used in `vaiA()`/`href="#/…"`/`vista === '…'` exists in the `Vista` union.
> Worth re-running after template edits — the throwaway scripts are gone, but they were
> ~20 lines of node: extract `attr="…"` expressions, strip string literals, match
> `(^|[^.\w$])(ident)\s*\(` against the class members.

---

## 0. Convenzioni di codice (deciso 2026-07-27)

Tre regole, volute dall'utente:

1. **Un commento descrittivo in cima a ogni file, e basta** — niente spiegazioni
   sparse nel mezzo del codice.
2. **Commenti-separatore** per dividere le parti dentro un file.
3. **Commenti in italiano, identificatori in inglese.**

**Stato: fatte tutte e tre, su tutto il codice.**

- Ogni file `.ts`/`.vue` di `shared/`, `server/src/`, `navigator/src/` e
  `marketplace/src/` ha una descrizione in cima e nessuna spiegazione sparsa nel mezzo.
- Restano solo i **separatori** (`// ====` e `// ----`) e, nei template, le etichette di
  sezione corte (`<!-- MAPPA -->`): le spiegazioni lunghe sono salite nell'intestazione.
- Identificatori in inglese ovunque, tranne le eccezioni elencate qui sotto.

Verificato dopo ogni passaggio: `tsc` e `vue-tsc` a zero, entrambe le build verdi,
**il server realmente avviato**, `testers.ts` rieseguito contro il database, e i binding
Alpine ricontrollati.

### Cosa resta deliberatamente in italiano

Non è una dimenticanza — la regola dice "variabili e funzioni":

- **Copy dell'interfaccia** e messaggi d'errore.
- **Classi CSS** (`.lastra`, `.btn-primario`, `.pastiglia`, `.pianta`): sono vocabolario
  grafico, non codice, e sono la lingua condivisa fra `prelude.md` e i template.
- **Nomi delle rotte** (`#/opere`, `#/componi`) e i valori del tipo `View`: compaiono
  nell'URL, quindi sono superficie utente.
- **Nomi dei file dei componenti** (`Biglietteria.vue`, `Scheda.vue`): stessa categoria del
  vocabolario grafico.
- **Il formato di scambio col server**: le chiavi dei payload (`tipo`, `titolo`, `autore`,
  `percorso`, `id_item`, `opzionale`, `indicazione`, `descrizioni`…) e quelle delle risposte
  (`stato`, `partecipanti`, `nuoveDomande`, `adozioni`, `ricavo`, `collezione`). Rinominarle
  richiede di toccare client e server insieme: va fatto in un passaggio dedicato, non di
  sfuggita. **Questa è la principale incoerenza rimasta.**

### Come è stato fatto il rinominamento

Con uno script che rinomina **solo nel codice**, saltando commenti, stringhe e testo dei
template (tre modalità: `.ts`, `.html` con le sole espressioni Alpine, `.vue` con lo script
più direttive e `{{ }}`). Un `sed` cieco non va bene: parole come `Contenuto`, `vista`,
`opere`, `tappe` esistono sia come identificatori sia nella prosa italiana — il primo
tentativo con `sed` ha infatti tradotto "Contenuto pubblicato con successo" in "Content
pubblicato…".

⚠️ **Due trappole incontrate, entrambe corrette — se lo script viene riusato, sapere che
esistono:**

1. **I letterali regex.** La prima versione non li riconosceva: in
   `server/src/routes/museums.ts` la regex `/"/g` dentro `escapeHtml` ha disallineato il
   tracciamento delle stringhe, con due effetti opposti nello stesso file — tre messaggi
   italiani tradotti a metà **e** tutto il resto del file non rinominato affatto. Ora lo
   script riconosce le regex; quel file è stato sistemato a mano.
2. **Le direttive `/// <reference>` non sono commenti.** Lo spogliatore le ha cancellate, e
   `server/src/env.ts` ha perso il riferimento ai tipi di dotenv. `tsc` continuava a
   passare (legge `include`), ma **`npm run start` non partiva più**: `ts-node` i `.d.ts`
   ambientali non li carica. Scoperto solo avviando davvero il server — "compila" non vuol
   dire "funziona". Ora le direttive sono preservate.

**Verifiche dopo il rinominamento:** `tsc` e `vue-tsc` a zero errori, entrambe le build
verdi, i binding Alpine ricontrollati (88 chiamate, 33 `x-model`, tutte le rotte),
`testers.ts` rieseguito contro il database.

---

## 0-bis. La soglia: marchio e fondale

**Il fondale è uno SCIAME di punti** (`swarm()` in `marketplace/src/frontend/app.ts`):
una nuvola che si raduna a formare, una dopo l'altra, le opere in vendita e le piante dei
musei, resta ferma qualche secondo, poi scivola nella figura successiva. Ha sostituito
prima "La Pianta" statica, poi un automa cellulare ciclico.

### Sesta passata (28/07) — «non si vede niente»: le due cause vere

Il fondale mostrava una macchia informe. Due difetti distinti, entrambi trovati aprendo
finalmente la pagina in un browser.

**1. Le piante non arrivavano mai.** Tutte e tre le mappe in `server/public/maps/` avevano
`<line data-edge ...>`: un attributo *senza valore*. È legale in HTML, **non in XML** — e
una SVG caricata come `<img src="blob:…image/svg+xml">` passa dal parser XML, che la
rifiuta in blocco. `img.onerror` scattava, `shapeFromSvg` restituiva `null`, e lo sciame
restava con le sole opere. Ora è `data-edge=""`.
*Non se ne era accorto nessuno perché il navigator inietta la stessa SVG nel DOM, dove a
parsarla è il parser HTML, che è indulgente: la mappa nell'app funzionava.*
Il server continua a leggerle (`svgGraph.ts` usa `rawAttrs.includes("data-edge")`) —
verificato: la connettività delle sale è identica, 5 ali attorno alla Hall Napoleon.

**2. Sui dipinti l'estrattore era quello sbagliato.** Si misurava il *contrasto locale* e si
tenevano i punti dove cambiava di più. Su una pianta, che è al tratto, funziona benissimo.
Su una fotografia no: **un Caravaggio non ha contorni, ha luce e buio**, e il gradiente lo
riduceva a grumi sparsi — esattamente la macchia che si vedeva. Ora gli estrattori sono
**due**, scelti secondo la sorgente:
- **`contour()`** — per le mappe. Invariato.
- **`halftone()`** — per i dipinti. Un **retino**: un punto dove il quadro è chiaro, densità
  proporzionale alla luce, errore diffuso sui vicini (Floyd-Steinberg). È il modo in cui si
  stampa una fotografia avendo un solo colore, ed è quel che serve qui, perché le particelle
  sono tutte uguali e l'unica cosa modulabile è quante ce ne sono per centimetro.
  La luminosità è prima riportata sull'intervallo effettivo del quadro (senza, un Caravaggio
  resta quasi tutto sotto soglia) e poi piegata con una gamma di 1.5.

**Numeri che decidono se è un quadro o una macchia**, non toccarli a caso:
`TONES` 9000 punti per figura, particelle `max(6000, min(13000, area/110))` — erano **2600**,
ed è il singolo motivo per cui una faccia non si riconosceva. `DOT` 1.6, `ALPHA` **0.85**:
il fondo Notte non è nero ma un blu medio (`#284b63`), e a mezza opacità i punti ci si
sciolgono dentro.

**L'ordine delle sorgenti non è più casuale.** Prima le opere (nell'ordine in cui le dà il
server: Gioconda, poi la *Morte della Vergine* del Caravaggio), poi le piante. Il sorteggio
faceva aprire la soglia su un quadro qualunque, ogni volta diverso. Nessun QID è scritto nel
codice: resta generico, cambia da sé se cambia il museo.

**La figura non sta più al centro.** Al centro finiva esattamente dietro ad "ART AROUND".
Ora: viewport larga → figura a destra (0.70 / 0.50), il titolo tiene la sinistra; viewport
stretta → la figura sale (0.50 / 0.37) e il volto va nella fascia vuota in cima, col testo
sotto. `.sciame-velo` segue in tre varianti (stretta: ombra crescente verso il basso;
`≥1024px`: ombra a sinistra sotto al titolo e luce spostata a destra).

### Settima passata (28/07) — solo opere, scelte a mano, e niente rimbalzo

**Le piante sono uscite dalla rotazione**, su richiesta: la soglia mostra solo opere.
`contour()` e `shapeFromSvg()` sono stati rimossi perche' erano rimasti senza chiamanti
(recuperabili da git; la correzione XML alle mappe resta valida e serve comunque).

**Quali opere lo decide la curatela, non il codice.** `server/src/data/soglia.json` elenca i
qid e l'ordine; `GET /api/config` li restituisce come `thresholdArtworks`; se il file manca o
e' vuoto il marketplace ripiega sulle prime sei del catalogo. **Nel marketplace non c'e'
nessun qid**, quindi la genericita' regge.
Il file si rilegge a ogni richiesta: cambiare la scelta non richiede di riavviare il server.
⚠️ Ma **aggiungere il campo si': il server va riavviato una volta** perche' `/api/config`
cominci a restituirlo.

*Perche' a mano e non a caso:* il retino rende bene una figura grande con un forte stacco di
luce, e rende illeggibile una scena affollata di mezzi toni. La *Morte della Vergine* del
Caravaggio era il secondo caso ed e' stata tolta. Le sei scelte sono state confrontate
rendendo **tutte e 22 le opere del catalogo** attraverso la pipeline vera e guardando il
provino: Gioconda, San Giovanni Battista, Napoleone in trono, *A Girl Blowing on a Brazier*,
*Buona ventura*, Mondrian.

**Tolto il rimbalzo.** L'avvicinamento al bersaglio era una **molla smorzata** (accelerazione
verso il bersaglio + attrito 0.88) e, sotto-smorzata, faceva arrivare ogni punto lungo per poi
tornare indietro: la figura si assestava ballonzolando. Ora e' un **avvicinamento
esponenziale** — ogni passo copre `1 - e^(-RATE·dt)` della distanza che resta, quindi il punto
rallenta e **non puo' superare il bersaglio**. Insieme e' sparito il "respiro" a figura ferma,
che era l'altra meta' del tremolio.
Verificato numericamente, non a occhio: seguendo il segno di `(bersaglio - posizione)` per
tutte le 11 782 particelle lungo i 216 fotogrammi di una fase, **zero inversioni di segno,
superamento massimo 0 px**, distanza residua a fine fase 0,05 px.

**La soglia si apre componendo il primo quadro.** Prima restava per tutta la durata di `HOLD`
con i punti che vagavano in un campo di flusso, e la Gioconda arrivava dopo quattro secondi di
ghirigori. Tre correzioni: `compose()` parte appena la prima opera e' pronta (**solo la
prima** — senza quella guardia ogni opera in arrivo faceva scattare la successiva e la soglia
si apriva sull'ultimo quadro); la prima `build()` non aspetta piu' i 150 ms dell'antirimbalzo;
e i punti nascono gia' dentro il riquadro dove la figura si formera', non sparsi su tutto il
campo, cosi' il testo non si prende la grana addosso. Piu' una dissolvenza di 900 ms.

### Ottava passata (28/07) — «uno scatto meccanico», e non era l'easing

Segnalato: nell'istante in cui i punti cominciano a cambiare figura si vedeva **uno strappo**,
poi il moto tornava fluido. Due cause, la prima delle quali e' un difetto vero.

**1. `tick()` non ricalcolava `elapsed` al cambio di fase.** `elapsed` si misurava *prima* di
decidere se la fase finiva, e poi si continuava a usarlo: il primo fotogramma di ogni
passaggio girava quindi con l'`elapsed` della fase *appena conclusa* — piu' lungo dell'intera
fase nuova — cioe' con `progress = 1`, avanzamento massimo. **Un fotogramma copriva l'8% del
tragitto, il successivo lo 0,001%.** Non era una sensazione: e' un salto di velocita' di
tremila volte fra due fotogrammi consecutivi. Ora `elapsed` si azzera quando la fase cambia.

**2. L'inseguimento e' il modello sbagliato per un passaggio.** «Ogni passo una frazione fissa
della distanza che resta» ha velocita' **massima al primo istante** e poi decade: niente
accelerazione, niente arrivo — uno scarto secco seguito da una coda. L'easing c'era ma
moltiplicava il *tasso*, non la posizione, quindi non poteva togliere lo scatto.
Ora il passaggio e' un'**interpolazione** fra la posizione di partenza (`sx`, `sy`, fissata
in `compose()`) e il bersaglio, con **smootherstep** `6e⁵-15e⁴+10e³`: derivata prima *e*
seconda nulle a entrambi i capi, quindi si parte da fermi senza strappo e ci si posa sul
bersaglio esattamente a fine fase invece di avvicinarvisi all'infinito.
Misurato: spostamento massimo per fotogramma **8,00% → 1,04%**, primi fotogrammi a 0,000%.

**3. Le traiettorie sono archi, non segmenti.** Rette parallele si leggono come un
meccanismo. Ogni punto ha ora un `bow` proprio (ampiezza e verso, ritirati a ogni passaggio
insieme al `delay`) che lo scosta perpendicolarmente seguendo una campana di seno — nulla ai
due capi, quindi non tocca ne' la partenza ne' l'arrivo. `BOW: 0.16` e' l'unica manopola:
sopra 0,2 le scie si incrociano e sembra turbolenza, sotto 0,05 non si distingue da una retta.

`MORPH` 2600 → 3000 ms. `RATE` non esiste piu'. Il ramo "moto ridotto" non simula piu' 240
passi: la figura ferma e' l'ultimo fotogramma dell'interpolazione, quindi `px = tx`.

⚠️ **Non guardato in un browser**: la correzione e' verificata numericamente (il profilo di
velocita' per fotogramma, sopra), l'ampiezza dell'arco no. Va guardata.

### Prestazioni: era a 12 fps, ora sta nel budget

Misurato nel browser vero, non stimato: **80,9 ms per fotogramma** a 1440×900, più **142 ms
di singhiozzo** a ogni cambio di figura. Tre cause, tutte risolte — **ora 10,5 ms** (63% del
budget a 60 fps) con 4,5 volte più particelle di prima:

| | prima | dopo |
| --- | --- | --- |
| fotogramma @1440×900 | 80,9 ms | **10,5 ms** |
| fotogramma @2560×1440 | 96,5 ms | **12,7 ms** |
| cambio figura | 141,9 ms | **4,1 ms** |

1. **`tint.r/g/b` letti dentro il ciclo sui pixel.** La tavolozza è un array di oggetti
   semplici, e *quelli* Alpine li avvolge davvero in un Proxy (i `Float32Array` no: Vue non
   proxa i typed array). Tre trappole per pixel ≈ **900 000 per fotogramma**, da sole i due
   terzi del disegno. Ora la tinta si scompone in tre locali prima del ciclo.
2. **`this.px[i]` &c. dentro i cicli caldi**: ~15 accessi al Proxy per particella in
   `advance()`. I vettori si prendono ora una volta sola in locali.
3. **`Math.atan2` dentro i comparatori di `sort`** in `nextShape()`: mezzo milione di
   chiamate a ogni cambio figura. Ora gli angoli si calcolano una volta in un `Float32Array`
   e si ordinano indici.

Scomposizione finale del fotogramma: azzeramento 0,16 ms · `advance` 0,68 ms ·
`putImageData` 0,36 ms · rasterizzazione delle particelle 9,6 ms.

### Come è stato verificato (ed è la parte che mancava a tutto il restyle)

**La pagina è stata finalmente aperta in un browser**, pilotando chromium via CDP: sonda
sullo stato dello sciame, cattura degli errori di console, screenshot delle figure fatte
convergere una per una, e benchmark eseguito *dentro* la pagina. Vale la pena rifarlo così
per ogni ritocco a `swarm()` — gli script sono nello scratchpad della sessione.

⚠️ **Trappola:** headless chromium dichiara `prefers-reduced-motion: reduce` **di default**.
Tutti i primi screenshot erano quindi del ramo "fermo", non dell'animazione. Il valore va
imposto esplicitamente con `Emulation.setEmulatedMedia` in *entrambi* i versi. Verificati poi
tutti e due i rami: a moto ridotto `still=true` e nessun `requestAnimationFrame` attivo, con
una figura composta e ferma; a moto normale la rotazione gira (figura 0 → 1 → 2 in 20 s).

**Un bug vero trovato dalla console mentre si guardava il fondale:** `x-init="$watch('vista',
…)"` nella sezione VENDITE — `vista` è rimasto dalla rinomina italiano→inglese, la proprietà
non esiste più, Alpine lanciava e il guardiano non si registrava. `loadSales()` non era
raggiungibile da nessun'altra parte: **la tabella delle vendite restava vuota per sempre.**
Corretto in `$watch('view', …)`, più il caso iniziale (entrando da `#/vendite` il guardiano
non scatta). *Conferma che i binding Alpine sono stringhe che nessun compilatore controlla:
la verifica statica di §0 li aveva contati, ma non poteva vedere questo.*

Restano invariate le regole di garbo: punti tenui, moto sospeso quando la sezione non si vede
o la scheda è in secondo piano, `ResizeObserver` invece del listener sul ridimensionamento,
sfumatura ai bordi, e nuvola che vaga piano se le sorgenti non arrivano.

**Il marchio.** L'opera incorniciata e il percorso che le gira intorno, con il visitatore
sopra: "art" e "around". Il tratto è aperto, non un cerchio chiuso, perché una visita ha un
inizio e una fine. Due forme:
- `#ico-marchio`, simbolo in linea nello sprite: usa `currentColor`, segue il tema, arco
  punteggiato. Compare grande sulla soglia e piccolo nel binario, accanto al nome.
- `marketplace/public/logo.svg`, autonomo: ha colori propri (serve anche da **favicon**) e
  l'arco **pieno** invece che punteggiato — a 16 pixel un tratteggio diventa poltiglia.

⚠️ Come tutto il resto della riprogettazione, **non è stato visto su schermo**: la regola è
verificata numericamente e il markup compila, ma l'effetto va guardato.

---

## 1. Decisions already taken (do not re-litigate)

The user chose these explicitly. They are load-bearing.

| Decision | Value |
| --- | --- |
| Display font | **Bricolage Grotesque**, self-hosted, no CDN |
| Tone vocabulary | **The slides' four tones**: `Infantile · Semplice · Medio · Avanzato` (slide 22). `shared/constants.ts` already changed. A DB migration is still owed. |
| DB helper scripts | Must all live in **one file: `server/src/scripts/testers.ts`** (user's instruction, verbatim) |
| Quiz | ~~Deferred~~ → **built 2026-07-28** (§8). Teleport is still deferred and is now the *only* thing missing for 18-33 |
| Session persistence | **Rivista il 2026-08-03**: c'e', ma in `sessionStorage`, quindi riaprire l'applicazione mostra ancora la soglia — che era la proprieta' da difendere. Il rifiuto del 2026-07-31 riguardava `localStorage`, che quella proprieta' la toglieva |
| Compatibility defects | **Deferred**, parked in `state.md` §10 (voice broken on iOS, QR/blind; the CDN one is closed). Do not chase them |

The user's framing for the whole job: *"start this glorious artistic refactor"* — flow and
information first, not a repaint.

---

## 2. What is DONE and verified

### 2.1 Foundation — shared, verified in both apps
- **`shared/theme.css`** (new) — the whole design system: palette (Gesso/Cemento/Grafite/
  Notte/Verderame + 7 documented derived values), light `:root` + `.dark`, `@font-face` for
  Bricolage, type scale (`text-hero`…`text-caption`), radius/shadow/easing tokens, the
  **two-tone focus ring**, `prefers-reduced-motion`, `.sr-only`, `.measure`.
  Imported by both apps as `@import "../../../shared/theme.css";` — **verified this
  cross-project import resolves** in both Tailwind CLI and Vite.
- **Fonts** — `navigator/public/fonts/bricolage-{latin,latin-ext}.woff2`, copies in
  `marketplace/public/fonts/`. Referenced as `/fonts/…` so one CSS works for both.
- **Alpine vendored** — `marketplace/public/vendor/alpine-3.15.0.min.js`,
  `alpine-focus-3.15.0.min.js`, `alpine-collapse-3.15.0.min.js`. `index.html` loads these,
  no jsDelivr.
- **`shared/constants.ts`** — rewritten. 4 tones + `educationalLevelHints`,
  `options[]` now `{id, label, surface:"chiedi"|"orientati"|"scheda", hint?}` with **label
  decoupled from id** (labels are finally correct Italian), `labelForCommand()`,
  `formatDurata()`.
- **`shared/types.ts`** — added `LogisticNote {after, text}`; `Visit.logistics` is now
  `(string | LogisticNote)[]` (old string rows still readable).
- **`shared/components.css`** (new) — the component vocabulary, shared by both apps:
  `.salta .lastra .btn-* .icona-mini .icona-tonda .campo* .barra .segmenti .segmento
  .scelta .comando .pastiglia* .mat* .nota-logistica .vuoto .avviso .link*`.
  Both apps import it right after `theme.css`. App-specific classes stay in the app:
  marketplace keeps `.voce-binario .passi/.passo .barra-salva .copertina .pianta [x-cloak]`;
  the navigator keeps its map styles inside `Stage.vue`.
  **Verified: `npm run build` in marketplace still exits 0 after the split.**

### 2.2 Marketplace — COMPLETE, `npm run build` exits 0
- `public/index.html` — full rewrite. SVG icon sprite (zero emoji), **Soglia** hero with
  *La Pianta*, left rail (bottom tab bar < lg) replacing the top header, Banco, Visite,
  Opere, **artwork page** and **visit page** (were nested modals), libreria, lavori,
  item editor, 3-step visit workbench, sales table, single confirm dialog, toast.
- `src/frontend/state.ts` — full rewrite. **Hash router** (`applicaRotta`/`vaiA`), role-less
  login flow, museum remembered in `localStorage`, two catalogues, `validazioneItem()` /
  `validazioneVisita()` returning *text* instead of a silent disabled button,
  `logisticaDopo`/`logisticaSenzaPosizione`, `urlEsempio()`, `urlQrCodes()`.
- `src/frontend/api.ts` — rewrite, all-relative URLs, `fetchConfig()`, `login()` handles 300.
- `src/frontend/app.ts` — `appData` + `themeToggle` (was inline in `<head>` ×3) + **`pianta()`**
  which fetches a real museum map SVG for the hero.
- `src/frontend/style.css` — the component layer (`.lastra`, `.btn-*`, `.campo*`, `.segmenti`,
  `.voce-binario`, `.pastiglia*`, `.passo*`, `.mat*`, `.copertina`, `.nota-logistica`,
  `.vuoto`, `.avviso`, `.salta`, `.pianta` + draw-in animation).
- Deleted dead `marketplace/dist/backend/` and `dist/frontend/`.

### 2.3 Server — edited, **not yet type-checked**
- `index.ts` → new `GET /api/config` returning `{navigatorOrigin}` (env `NAVIGATOR_ORIGIN`).
- `routes/users.ts` → `POST /login` resolves the role from credentials; **300** + `{scelta,ruoli}`
  only when the same username+password matches both profiles.
- `routes/visits.ts` → logistics saved as **anchored** `{after, text}` walking the ordered
  `percorso` (fixes `state.md` §9.6).
- `routes/museums.ts` → `GET /:qid/visits?user=` excludes guided visits always, returns only
  free visits without `user`, free+owned+authored with it (fixes `state.md` §7.4). Added
  `UserModel` import.
- `models/visit.ts` → `logistics: [Schema.Types.Mixed]`.
- `services/llm.ts` → `mapRequest` maps onto `o.id`, not `o.label` (unlocks the label fix).

### 2.4 Navigator — PARTIAL
Written and believed complete:
- `public/config.json` (new) — **the curator's config file the slides require**
- `src/config.ts` (new) — `loadConfig/apiBase/mediaOrigin/museumQid/museumTitle`;
  kills `DEFAULT_MUSEUM_QID = "Q6373"` and every `localhost` literal
- `src/api.ts` — rewritten on `apiBase()`; `getVisitsByMuseum(qid, user?)`
- `src/state.ts` — rewritten: `utente`, `vistaStage` (mappa/elenco, persisted),
  `logisticaDopo()`, `logisticaIniziale()`, map fetched via `mediaOrigin()`
- `src/App.vue` — rewritten: loads config first, then guided / deep-link / normal entry
- `src/components/selection/Biglietteria.vue` (new) — **visit list**, filters can no longer
  dead-end, su-misura block promoted with example chips
- `src/components/visita/Visita.vue` (new) — runtime: progress rail `Tappa N di M`,
  **logistics transition dialog between stops**, teleport-shaped `vaiAOpera()`
- `src/components/visita/Stage.vue` (new) — map/list as **peers**, numbered discs drawn onto
  the SVG, `<title>` per node, optional toggle with the `TODO TEMP` fixed
- `src/components/visita/Scheda.vue` (new) — the **bottom sheet** (riposo/media/piena),
  Chiedi/Orientati split, permanent mic, language selector moved in here
- `src/components/visita/Info.vue` (new) — restyled, static loading block, retry on error
- `src/components/visita/useTTS.ts`, `useVoce.ts` — `git mv`'d from `map/speech/`

---

## 3. What is MISSING — do this first, in this order

### ~~3.1 `Comando.vue`~~ — **DONE**
The voice command, promoted to a permanent control in the sheet footer. Announces every
state and **repeats the recognized command before executing it**.

### ~~3.2 `Posizione.vue`~~ — **DONE**
One entry point, two equal ways: *Inquadra il QR* (reuses `useQRScanner`) and *Scrivi il
codice* (single pasteable field, mono, never split, never timed). The QR tab is disabled
with a stated reason when `!window.isSecureContext`.
The printed sheet was fixed to match: `GET /api/museums/:qid/qrcodes` now renders the code
in **22px bold monospace, black on white, above a rule**, with a line telling the visitor
they can scan *or* type it. It was an 11px grey caption — unreadable as something a person
is meant to transcribe, which left the typed-code path with nothing to type from
(`state.md` §10.3).

### ~~3.3 `GuidedGate.vue`~~ — **DONE**

Rewritten on `./visita/Visita.vue`. Waiting room is a full-bleed `bg-structure` stage with
the access key at `font-mono text-display` (it gets read aloud across a room; it was 18px).
A **conduzione bar** separates commands-on-the-class from commands-on-the-visit. The two
overlapping asides became one sheet from one edge. Joins, leaves and incoming questions are
announced. **Four phases now**: `quiz` has its own neutral screen, so starting a quiz no
longer shows everyone "Visita terminata" mid-visit; and the ended screen distinguishes
*teacher ended it* from *session vanished*.

**`guided.ts` groundwork (done):**
1. `type Stato` now includes **`"quiz"`** — without it, the moment a teacher starts a quiz
   every client falls into the final branch and shows "Visita terminata" mid-visit. The quiz
   *UI* stays deferred, but the state had to stop being a lie.
2. New export **`guidedChiusuraPrevista: Ref<boolean>`** + `endLocally(prevista = true)`.
3. `pollOnce()` now calls `endLocally(false)` — the session vanishing under your feet is a
   different event from the teacher pressing Termina, and must read differently.

4. `resetGuided()` resets `guidedChiusuraPrevista`.

~~The quiz *screens* remain deferred as instructed~~ — **they exist now, see §8.** What this
pass added was only the missing **state**, because representing it wrongly was showing users
a false screen; the screens came later and slotted straight into that phase.

### ~~3.4 Component classes~~ — **DONE**, see §2.1 (`shared/components.css`)

### ~~3.5 Delete the superseded files~~ — **DONE**
Removed `components/map/` entirely, plus `selection/Selector.vue`,
`selection/DropDownMenu.vue`, `Header.vue`, `Footer.vue`, `ThemeToggle.vue`.
Verified no dangling references remain.
Kept `composables/{useQRScanner,useAnnouncer,useTranslation,useTheme}.ts`.

**Two regressions this caused were caught and fixed.** Deleting `Header.vue` silently took
away (a) the navigator's theme toggle and (b) its **link to the marketplace** — which is a
*mandatory base requirement*, slide 25 "Accesso al marketplace". Both now live in a utility
row at the top of `Biglietteria.vue`: a `Marketplace` link (origin derived from
`mediaOrigin()`, since the server serves the marketplace at its root — no hardcoded port)
and a theme toggle wired to `useTheme`. They sit on the selection screen rather than in a
persistent header because during a visit every pixel belongs to the map.

### ~~3.6 Wire the sheet's `inert`~~ — **DONE**
`Visita.vue` tracks the sheet's `snap` and marks `<Stage>` inert only when the sheet is
full-screen **and** the viewport is below `lg` — above that the sheet is a side column, not
a modal, so nothing should be inert there. `matchMedia` listener, no resize handler.
Type-checks clean.

### ~~3.7 Build~~ — **DONE, both apps green**
```bash
cd navigator   && npx vue-tsc --noEmit -p tsconfig.app.json    # exit 0
cd navigator   && npx vite build --outDir <tmp> --emptyOutDir   # exit 0, 108 modules
cd marketplace && npm run build                                 # exit 0
cd server      && npx tsc --noEmit    # NOT re-run since the §2.3 server edits
```
Only three type errors surfaced in the whole navigator rewrite, all from
`querySelector("title")` typing as HTML inside an SVG (`Stage.vue`) — fixed with a cast.

`navigator/dist/` is still the root-owned June artifact, so a plain `vite build` fails in
`prepare-out-dir`. `sudo rm -rf navigator/dist` once and it stops mattering; `npm run dev`
never touches it.

---

## 4. Then: the remaining prelude items

1. ~~**`server/src/scripts/testers.ts`**~~ — **WRITTEN AND RUN** against your live Mongo.
   `tutto` reported: **130 items + 6 visits** retoned, **9 visits renamed**, **1 visit's
   logistics** given positions. `stato` now shows no vocabulary warnings.
   - `Principiante → Semplice`, `Intermedio → Medio` (1:1 and lossless, so reversible by
     inverting the map in `MAPPA_TONI` if you disagree with the naming).
   - Visit names went from `"Visita Principiante · 15s per opera"` to
     `"Percorso introduttivo · 13 tappe · 3 min"`.
   - **`Infantile` has no content yet** — the old seed only produced three levels. The next
     full seed will produce four (see §4.2).
   - Item `@id`s still embed the *old* tone (`…-Intermedio-60`) by design: they're opaque
     keys referenced by `Visit.itemListElement` and `User.collezione`. New items get the new
     tone in their id. Both work; ids are not descriptions.
   - New command **`account`** (also part of `tutto`): upserts the four accounts the slides
     require (`autore1`, `autore2`, `visitatore1`, `visitatore2` / `12345678`).
     **They did not exist in your DB** — I created them. Unlike `seedUsers.ts` this deletes
     nothing; it only *reports* documents without a role.

   ⚠️ **Three accounts in your DB have no `role` field** (`a`, `b`, `docente`) — leftovers
   from the old "single account" model. They can no longer log in *by design* (see below),
   and I left them alone: deleting accounts is your call. `seedUsers.ts` would remove them.
   Small CLI, idempotent, `npx ts-node src/scripts/testers.ts <comando>`:
   - `stato` — report: counts, which tones/levels are actually in the DB vs expected, and it
     *tells you which migration to run*. **Run this first.**
   - `toni` — `Principiante→Semplice`, `Intermedio→Medio`, plus lowercase→capitalised, on
     `Item.educationalLevel` **and** `Visit.level`. **Owed by the 4-tone decision** — until
     it runs, the new filters and the existing ~310 items speak different languages.
     Deliberately does **not** rewrite `@id`s: the tone is baked into the id
     (`Q123-autore-Intermedio-60`) but ids are referenced by `Visit.itemListElement` and
     `User.collezione`, so renaming them would break every visit and every library.
   - `nomi` — `"Visita Principiante · 15s per opera"` → `"Percorso introduttivo · 13 tappe ·
     20 min"`. Only touches auto-generated names, never human-written ones.
   - `logistica` — old `string[]` notes → `{after: null, text}`. Position can't be guessed
     retroactively, so they become opening notes: correct and visible rather than lost.
   - `tutto` — all three, then `stato`.
   Server `tsc --noEmit` after this: **only the pre-existing `@google/genai` `.d.ts` error**,
   nothing in project code.
2. ~~**`seed.ts`** — `seedMuseums()` commented out~~ — **FIXED**: uncommented and moved
   first in `completeSeed()`. A freshly seeded DB used to end up with **no museums** —
   empty museum panel, no navigator config, no wayfinding — with nothing on screen
   explaining why (`state.md` §9.5).
   ⚠️ Note the seed is now **slower**: 4 tones × 2 durations = **8 LLM items per artwork**
   instead of 6, at ~5s each. ~39 artworks ⇒ roughly 45–60 min for a full run. Unchanged
   otherwise.
3. ~~**M19 handoff panel**~~ — **DONE**. New `GET /api/qr?text=…` returns an SVG QR
   (reuses the `qrcode` module already there for the printable sheet; server-side because
   the marketplace has no bundler). The visit page now shows **"Portala sul telefono"** with
   the QR of the navigator link plus an "oppure aprila qui" fallback. The marketplace is a
   desk app and the navigator a museum app *by requirement* — the product had never once
   acknowledged that the person has to change device.
4. **N13 UI translation** — `labelForCommand` exists and ids are decoupled, but there is no
   per-language label map yet.
5. ~~**Update `state.md`**~~ — **DONE**. §4 and §5 rewritten against the new structure;
   §0.1 added: a table of **which §7–§9 entries the restyle closed** (14 of them) and which
   are still open. §1, §2 and §2.1 corrected (four tones, `LogisticNote`, local Alpine,
   the two shared CSS files). The header no longer points at the deleted `spec.md` /
   `stylespec*.md`.

6. **Housekeeping done in passing** — `state.md` §8.1/§8.2/§8.3 are now closed:
   - **Dead endpoints removed** (verified no caller first): `GET /artworks/:qid/items`,
     `POST /items/batch`, `GET /museums/:qid`.
   - **Dead imports removed**: `ItemModel` + `insertArtwork` from `services/llm.ts` (which
     also breaks the pointless `llm ↔ dbActions` import cycle), and `fetchArtwork` +
     `createDescription` + `downloadImage` from `dbActions.ts`.
   - **Dead code removed**: `testArtworks` (18 QIDs) and `printStored()` in `seed.ts`;
     `audioUrl` in `useVoce.ts`, which was minting an object URL per recording for a
     playback UI that never existed.
   - **Vestigial files removed**: both 0-byte `tailwind.config.js` (v4 configures in CSS —
     verified both apps still build without them), stale `server/dist/`, and the
     `<div id="dropDown">` in `navigator/index.html`.
   All three parts re-verified green after each removal.

---

## 5. Traps found the hard way

- **An SVG in `<img>` is parsed as XML, in the DOM as HTML.** A valueless attribute
  (`<line data-edge>`) works everywhere in the app and fails *only* on the `<img>`/canvas
  path, silently, via `onerror`. If a map "doesn't load" but looks fine in the navigator,
  this is why. Keep `server/public/maps/*.svg` well-formed XML.
- **Alpine proxies plain objects and arrays, but not typed arrays.** Reading `obj.field` in a
  per-pixel loop costs a Proxy trap each time; a `Float32Array` costs nothing. Hoist out of
  hot loops. This was a 3× difference on the whole backdrop.
- **Headless chromium reports `prefers-reduced-motion: reduce` by default** — screenshots
  silently capture the still branch. Force it with `Emulation.setEmulatedMedia`.
- **`navigator/dist/` is root-owned** → `vite build` dies with EACCES in `prepare-out-dir`.
  Either `sudo rm -rf` it or build with `--outDir` elsewhere.
- **`navigator/` and `server/` `node_modules` are root-owned** → `npm install` fails. No new
  dependencies can be added to those two. The restyle needs none.
- `marketplace/dist` is only rebuilt by `npm run build --prefix marketplace`. Run it after
  every marketplace change or you debug week-old JS (`state.md` §9.12).
- `x-show` + `lg:!block` is how the editor's two panes work — `!block` beats the inline
  `display:none`, so no resize listener is needed. Don't "fix" it with `window.innerWidth`.
- `getBBox()` returns zeros in a hidden subtree — that's why `Stage.vue` re-runs `ridisegna()`
  on `vistaStage` change to place the map numerals.
- Alpine renders every view stacked before it boots; `[x-cloak]` + the root `x-cloak`
  attribute is what prevents the flash. Keep both.
- **`x-model` on a radio gives you back a STRING.** `:value="false"` sets the attribute to
  `"false"`, and `getInputValue` returns `target.value` verbatim — so the model becomes the
  string `"false"`, which is **truthy**. Every `if (draft.x)` then takes the wrong branch,
  silently and forever. Use `x-model.boolean` (Alpine 3 converts, and also compares
  correctly when writing `checked` back). This cost a whole feature: a visit could be turned
  into a guided one but never back.
- **A "chase" is not a transition.** `p += (target - p) * k` has its maximum speed at the
  first instant. Easing the *rate* cannot fix that — the first step is still the biggest.
  If you want something to start from rest, interpolate the **position** between two fixed
  endpoints with an easing that has zero derivative at both ends (smootherstep), don't scale
  a chase.
- **Recompute `elapsed` after changing phase.** Any `elapsed = now - phaseAt` read *before* a
  phase switch is stale for the phase you're about to run, and a stale one is usually
  *larger* than the whole new phase — i.e. progress 1 on frame 1. Cost: a visible jerk at
  every figure change in the backdrop, for weeks.
- **Il segnalino di posizione si mangiava il tocco sul nodo sotto di lui.** E' disegnato per
  ultimo, e un `<circle>` SVG raccoglie gli eventi come qualunque forma: dopo ogni
  ancoraggio a un'opera (QR, codice, teletrasporto) **quella tappa era l'unica che non si
  riusciva piu' ad aprire**. `pointer-events: none` sul gruppo, che e' gia' `aria-hidden`.
  Nessun errore in console: si vede solo toccando, con `document.elementFromPoint`.
- **`GET /visits/:id` is a student-facing route.** The navigator loads a guided visit through
  it, so anything on the document reaches the class — the quiz `correct` indices did. It now
  `select("-quiz")`s. The author's editor reads the quiz from the *list* route instead.

---

## 6. Uncommitted work

**Nothing is committed.** Two passes are stacked in the working tree: the restyle
(2026-07-27, §0–§5) and the feedback pass (2026-07-28, §8). All three parts compile
(`vue-tsc`, both `tsc`), the marketplace `dist` is rebuilt, the server has been restarted and
probed live.

`git status` at the end of the second pass: **20 modified, 3 untracked**
(`navigator/src/components/visita/Pannello.vue`, `server/src/data/quiz.ts`,
`server/src/data/soglia.json`). The restyle's own new assets —
`shared/{theme,components}.css`, `navigator/public/{config.json,fonts/}`,
`marketplace/public/{fonts,vendor}/`, `server/src/types/` — are already tracked as of that
listing; if a `git add -A` is done, check they are in. `.gitignore` covers `dist/`, so build
output stays out — correct.

Worth **two** commits, since they are two jobs:
*"restyle: struttura, flussi e informazione (prelude.md)"* and
*"correzioni d'uso, pannello comandi, quiz nel navigator"*.

---

## 7. What is genuinely left

**Deferred by you, untouched:** the **teleport module** (`prelude.md` §7.1) — now the single
blocker for 18-33 — and the compatibility defects in `state.md` §10 (iOS voice capture; the
QR/blind fallback is half-done, the printed code is legible and the navigator accepts it
typed; the CDN one is closed).

**Not started, from `prelude.md`:**
- **N13** — UI-string translation. `labelForCommand()` exists and ids are decoupled from
  labels, so the mechanism is ready; there is no per-language label map yet.
- **§7.7** — honour `stepStartAt` so a guided visit's audio starts together on every device
  (needs the iOS gesture-arming from `state.md` §10 first, or it silently won't play).
- **§7.8** — order custom-visit stops spatially (BFS from the entrance on the room graph)
  so a generated visit doesn't zig-zag.

**Known open, small:**
- `Infantile` has no content in the DB (the old seed made three levels). A full re-seed
  makes four — see §4.2 for the new cost.
- Three role-less accounts (`a`, `b`, `docente`) can't log in. Give them a role or delete.
- `state.md` §9.11 (naming: `intertMuseum`, `"markeplace"`, `transcrtiption`) — cosmetic,
  untouched. The wrong keys in `museumContent.ts` are closed: the file is gone.

**The real next step is still to open both apps in a browser — but the marketplace has now
been opened, and it was worth it.** Only the *soglia* was driven for real (chromium via CDP,
see §0-bis): it immediately produced one dead feature (`$watch('vista')`, the sales table
never loading), one silently-broken asset path (the map SVGs rejected as malformed XML), and
a backdrop running at 12 fps. All three were invisible to the compiler, to the static Alpine
check, and to HTTP probes.

**§8 is the confirmation.** Six of the twelve items in that pass were defects, and *every one
of them* was found by a person using the app, not by a tool: the editor that refused to
publish a text that was there, the visit that looped between two descriptions of the same
painting, the visit that never ended, the guided flag that could not be unset. All compiled.
All type-checked. None was reachable from an HTTP probe.

**Still never driven in a browser:** the whole navigator — including everything §8 added to
it (command panel, end-of-visit screen, both quiz screens). The quiz was verified
**end-to-end against the running server** with two simulated students (marks 3/3 and 2/3, the
board, the close, the graceful `terminata`), so the protocol is known good; what is unproven
is the rendering. The likeliest bugs remain the bottom sheet's snap behaviour and the hash
router's guards.

---

## 8. Passata del 28/07 — dodici correzioni d'uso

Nata da una lista di dieci richieste dell'utente, piu' due di rifinitura. Sei erano difetti
veri. Il dettaglio con le cause sta in `state.md` §0.2; qui restano le cose che servono a chi
prosegue.

**I difetti, in una riga ciascuno.** Textarea legata a `draft.raw`, campo inesistente →
"Manca ancora: il testo" su un testo che c'era. Radio booleano con `x-model` → la stringa
`"false"`, e una visita guidata non tornava piu' in vetrina. Tappa corrente cercata per
**opera** invece che per **item** → con due descrizioni sulla stessa opera la visita si
bloccava fra le due (e sulla mappa i due nodi si sovrascrivevano etichetta, numero e
ascoltatori). La visita non finiva mai. Il fondale strappava a ogni cambio figura. Il quiz
non si poteva fare.

**Cose nuove.** `Pannello.vue` — il vocabolario controllato a bottoni, montato **due volte**
(dentro la scheda e dietro il pulsante `Chiedi` della barra): e' un componente solo, quindi i
due elenchi non possono divergere. Schermata di fine visita. Le due schermate del quiz in
`GuidedGate.vue`. `server/src/data/quiz.ts` — genera il quiz della visita guidata **dalle
opere della visita stessa**: nessuna domanda scritta a mano, nessun qid nel codice, vale per
qualunque museo.

**Cose tolte dal server, per correttezza.** `GET /visits/:id` non restituisce piu' `quiz`:
e' la rotta con cui il navigator carica una visita guidata, quindi consegnava agli studenti
l'indice della risposta giusta. E `POST /:id/end` non cancella piu' la sessione all'istante —
la lascia 30 s in stato `terminata`, cosi' una chiusura **voluta** non arriva ai client come
un 410, cioe' come un guasto.

**Una cosa fatta e poi disfatta: la persistenza della sessione.** "Torna alla home" a fine
visita attraversa un'origine, quindi e' un caricamento di pagina e il marketplace mostrava la
soglia invece della home del visitatore. La sessione ripresa da `localStorage` risolveva
quello e rompeva di peggio: **la soglia diventava irraggiungibile**, ogni apertura di `/`
rientrava nell'ultimo account. Nemmeno la versione con il cancello (riprendere solo per un
indirizzo che richiede di essere entrati) e' stata voluta. `state.ts` e' pulito,
`marketplace/src/frontend/api.ts` e `server/src/routes/users.ts` sono tornati **identici a
HEAD**. Non riaggiungerla.

⚠️ **`seedSpecialVisits()` oggi non fa niente e non lo dice forte.** Cerca
`educationalLevels[0]` + `secPerArt[0]` = *Infantile / 15s*; nel database ci sono solo
`Semplice`, `Medio`, `Avanzato` a 15/30/60. Trova zero item, stampa "esegui prima seed()" e
torna — quindi **il quiz generato non e' ancora nel database**. E' la coda della migrazione
dei toni (§4.1): o si rifa' il seed completo, o si riallineano prima i livelli.

---

## 9. Teletrasporto: toccare la pianta, o sceglierla da un elenco

Discusso il 2026-07-30, **prima** di implementare la variante «tocchi la pianta e ci finisci».
Quel che esiste gia' e' l'altra forma: la quarta scheda di `Posizione.vue`, un elenco delle
tappe, si tocca una e la posizione ci va. Le due non sono alternative ovvie — hanno costi
diversi e coprono requisiti diversi — e questa sezione serve a non rifare il ragionamento.

### Cosa guadagna toccare la pianta

**L'unica cosa che l'elenco non puo' dare: un punto qualunque.** Dall'elenco si atterra sempre
*su* un'opera, e li' la localizzazione vince sempre — misurato sulle tre piante vere,
**39 casi su 39**, il peggiore al 98%. Cioe' il ramo interessante dell'equazione — quello in
cui nessuna opera vince e compare il pannello di scelta, che e' meta' del modulo della slide
33 — **dall'elenco non si raggiunge mai**. Toccando il pavimento fra due quadri si', ed e'
l'unico modo di mostrarlo al chiuso.

In piu' il ritorno visivo e' gratis: `drawPosition()` (`Stage.vue:166`) disegna gia' segnalino
e cono da `stima`, e c'e' gia' un `watch([stima, bussola])` che ridisegna. Un `reanchor(x, y)`
e il pallino si sposta dove hai toccato, senza una riga di disegno in piu'.

### Le quattro tensioni

**1. La slide dice «posizione predeterminata».** Slide 34 chiede un modulo che porti a una
*posizione predeterminata vicino a ciascun oggetto della visita*. Un tocco libero e'
esattamente il contrario di predeterminato: **e' l'elenco a seguire la lettera del requisito**,
non la pianta. Conta, perche' in questo progetto l'aderenza alla specifica batte la comodita'.
Non e' un motivo per rinunciare al tocco, e' un motivo per non buttare l'elenco.

**2. Chi non vede non puo' toccare un punto.** Indicare una coordinata su una mappa e' il
gesto che un cieco non compie, in un'app fatta per parlargli — lo stesso ragionamento per cui
il codice digitato esiste accanto al QR (§10.3 di `state.md`). Quindi il tocco **non puo'
essere l'unico modo**: gli serve un equivalente non spaziale, e quell'equivalente e' l'elenco
gia' scritto. Non e' un compromesso, e' il modello che il progetto usa gia': un atto, due
modi di darlo — fotocamera e tastiera per il QR, pianta ed elenco per il teletrasporto.

**3. I nodi si mangiano gia' il clic.** Ogni opera sulla pianta ha un `click` e un `keydown`
che aprono la tappa (`Stage.vue:127-138`). Toccare la pianta per spostarsi entra in collisione
con quello. Due uscite: ascoltare solo il pavimento vuoto — **da scartare**, perche' nessuno
scopre un comando invisibile e un tocco distratto sposterebbe in silenzio una posizione su cui
poi si ragiona; oppure una **modalita'**.

**4. Una modalita' e' una cosa in cui si resta intrappolati.** Meglio *armata a colpo singolo*:
si preme «Teletrasporto», il tocco successivo colloca, e la modalita' si spegne da sola (piu'
Escape per annullare). Ha un'affordance e un'etichetta sue, quindi resta visibilmente un
*modulo* come chiede `state.md` §7.1, senza diventare uno stato in cui ci si dimentica di
essere.

C'e' un effetto collaterale gradito: quando e' armata, il gestore del nodo esce subito e il
tocco arriva all'`<svg>` — cosi' **toccare un'opera colloca sull'opera** (la posizione
predeterminata della slide) e **toccare il pavimento colloca dove capita**. Una meccanica
sola copre tutt'e due le letture del requisito.

### Dettagli che decidono se funziona

- **Da pixel a unita' dell'SVG**: `svg.createSVGPoint()` + `getScreenCTM().inverse()`, sei
  righe, esatto qualunque sia il `viewBox` e qualunque sia la lettera del `preserveAspectRatio`.
  La matematica a mano su `getBoundingClientRect` sbaglia appena la pianta viene incorniciata.
- **Cosa annunciare.** Su un punto libero non c'e' un nome da dire: si annuncia «posizione
  aggiornata» e basta. Dire li' quale opera e' la piu' vicina rimetterebbe insieme le due
  meta' che teniamo separate apposta — il teletrasporto *sposta*, «Trovami» *risponde*.
- **Nascondere il bottone se `localizzabile` e' falso.** Senza `data-width-m` la pianta non sa
  quanti metri e' larga: il segnalino si disegnerebbe lo stesso, ma «Trovami» non puo' fare i
  conti. Un comando che colloca un punto che nessuno sa leggere e' peggio di un comando assente.

### Costo

~80 righe: la modalita' armata, il gestore sull'`<svg>`, la conversione, l'uscita anticipata
nei nodi e l'Escape stanno in `Stage.vue`; ~10 righe in `Visita.vue` per `reanchor` e
l'annuncio; 6 di CSS per il cursore. **L'elenco gia' scritto resta dov'e'** e non si tocca: le
due strade chiamano lo stesso gestore.

### Come si racconta all'esame

Il teletrasporto e' un modulo con **due ingressi per lo stesso atto**: la pianta per chi
guarda, l'elenco per chi ascolta. Nessuno dei due misura niente — dichiarano soltanto — e
la misura vera resta a «Trovami», che da li' in poi lavora sui numeri veri. E' anche la
risposta alla domanda scomoda «non e' solo un collegamento?»: toccare una tappa nell'elenco
delle tappe **apre** e non sposta; il teletrasporto **sposta** e non apre.

### ✅ Fatto il 2026-07-31

Come sopra, meno l'elenco dedicato: armata la modalita' sono le tappe che gia' ci sono —
nodo o riga — a collocare invece di aprire, quindi un secondo elenco non serviva. Stato in
`Visita.vue`, `Stage.vue` emette `teleportPoint`/`teleportStop`, `Posizione.vue` arma e si
chiude.

**Verificato pilotando chromium via CDP**, 18 controlli nei due temi, zero errori in
console: il punto toccato riconvertito a mano coincide col segnalino a **0,000 unita'**.
Due trappole *della prova*, non del codice: `.click()` lascia `clientX/clientY` a zero (ci
vuole `Input.dispatchMouseEvent`), e la striscia armata sposta la pianta di ~50 px, quindi
ogni misura va presa nell'istante del tocco. Il difetto vero trovato cosi' sta in §5.

---

## 10. La nota d'apertura che finiva a fine visita (2026-07-31)

Una nota logistica messa **prima della prima opera** si salvava giusta (`{after: null}`) e
poi si spostava da sola: bastava riaprire la visita in editor e risalvarla senza cambiare
niente. Nel navigator la conseguenza era visibile all'estremo opposto della visita —
l'accoglienza all'ingresso spariva e il testo ricompariva sulla schermata di fine visita.

**La causa e' l'ordine di due cicli.** Il server non riceve la posizione di una nota: la
ricava percorrendo `percorso` e legandola alla tappa che la precede (`routes/visits.ts`,
`ultimoItem`). `rebuildStops()` in `marketplace/src/frontend/state.ts` ricostruiva pero' il
percorso mettendo le opere **prima** delle note senza ancora, quindi al salvataggio
successivo `ultimoItem` non era piu' `null` ma l'ultima tappa. Ora il ciclo sulle note
d'apertura viene per primo. Il metodo si chiama `openingNotes` come nel navigator:
`unplacedNotes` diceva che quelle note non hanno una posizione, e invece ce l'hanno.

Nella pagina della visita le stesse note stavano in coda sotto «Indicazioni generali»,
cioe' il marketplace mostrava un ordine che il navigator non suona: ora aprono il percorso.

**Verificato contro il server vivo** con `AppState` compilato — non una copia della logica —
su una visita usa e getta: tre salvataggi di fila che non cambiano niente lasciano gli
ancoraggi identici. La prova e' stata rifatta con l'ordine vecchio per accertarsi che
fallisse: 4 controlli su 6 rossi, con la nota d'apertura riancorata all'ultima tappa.

---

## 11. La visita su misura arriva nel marketplace (2026-07-31)

Comporre una visita descrivendola a parole («mi piace il giallo») esisteva **solo** nella
biglietteria del navigator. Siccome la biglietteria un giorno sparira', l'ingresso doveva
stare nel marketplace: nuova schermata `#/sumisura`, quarta porta sulla home del visitatore.

**Il server non e' stato toccato.** `POST /visits/custom` funziona ed era gia' completo; il
buco era solo nell'ingresso.

**La decisione che ha dato forma alla schermata:** una visita su misura non viene scritta nel
database — e' una scelta di progetto (`dbActions.ts`: «le visite su misura vivono solo nel
client»), e le due applicazioni stanno su **due origini diverse**, quindi non c'e' nessun modo
di passarsi la visita gia' composta. Quindi il marketplace porta al navigator la **frase**, e
a comporre e' chi poi la esegue. Le alternative sono state scartate cosi':

- *generare nel marketplace e mostrare un'anteprima* — il navigator dovrebbe rigenerare, e il
  modello non risponde due volte allo stesso modo: si guarderebbe un percorso e se ne
  suonerebbe un altro;
- *salvare gli item generati per poterla tenere in libreria* — scartata dall'utente: la visita
  resta effimera. Da sapere se un giorno si cambia idea: `POST /visits` scrive
  `itemListElement` **cosi' com'e'**, senza controllare che gli id esistano, quindi salvare
  una visita con item non persistiti darebbe tappe che non si risolvono e che spariscono in
  silenzio (§3.1 di `state.md` avverte proprio di questo).

**Raggiungibile da due parti**, su richiesta: la porta sulla home e una striscia in cima al
compositore manuale, cosi' la strada a parole si vede *prima* di mettersi a scegliere le
tappe a una a una. L'invito e' nascosto quando si sta modificando una visita — manderebbe
via da un lavoro aperto. Il senso opposto e' collegato pure lui: la riga che avverte che la
visita non si salva porta al compositore.

**Verificato in un browser vero, non solo compilato** (chromium via CDP, gli script sono nello
scratchpad). Marketplace: 13 controlli — accesso, museo, la porta sulla home, la schermata, il
bottone inerte finche' il campo e' vuoto, l'esempio che riempie il campo, l'indirizzo che ne
esce — zero errori in console. Navigator: aperto sull'indirizzo generato, mostra «Stiamo
componendo la tua visita…», e dopo la chiamata all'LLM parte davvero la visita («Percorso
Dorato», 3 tappe, mappa disegnata), zero errori in console. I due sensi del collegamento col
compositore: altri 7 controlli, percorsi cliccando davvero, zero errori.

⚠️ Una trappola *della prova*: `document.body.innerText` non vede le viste nascoste da
`x-show`, ma `querySelectorAll` **si'**. Un controllo fatto con il secondo passa anche quando
la schermata non e' affatto aperta — i primi due «OK» di quella tornata erano falsi.

---

## 12. Colore: accendere quel che era gia' dichiarato (2026-07-31)

Tre richieste in una passata: togliere «intelligenza artificiale» dallo schermo, dare piu'
colore all'app, e dare un segno multicolore alla visita generata.

**La seconda si e' risolta da se' guardando i numeri.** `--brass`, `--slate` e `--tint`
erano definiti, documentati e usati **zero volte** in tutte e due le app; il navigator non
usava **nessuna** delle quattro tinte semantiche. Quindi non serviva inventare colori:
bastava accendere i ruoli che `theme.css` gia' descriveva. Tono, livello, «Privato»,
«Opzionale» e la parola chiave sono passati all'ardesia; i prezzi all'ottone.

⚠️ **Accendendoli e' saltato fuori un difetto vero di contrasto**, che prima non mordeva
perche' la pastiglia ardesia si vedeva in cinque punti soli: al buio `--slate` faceva
**4,44:1** dentro una pastiglia (corpo caption su `surface-2`), cioe' sotto AA. Alzata la
sola luminosita' a `oklch(… 0.8 …)` — tinta e croma intatte, quindi l'ardesia non scivola
nelle famiglie dell'oro o del rosso, che e' la regola 2 della sorgente.

**L'iride** (`--iride` in `theme.css`) e' i quattro semantici in fila, per la sola visita
generata. Due cose imparate mettendolo:
1. **L'ordine conta piu' di quali colori sono.** Con ardesia e verderame adiacenti — tinte
   vicine — meta' gradiente sembrava una tinta sola dentro una tessera di 40 px. Riordinato
   per distanza di tinta (oro → verde → verderame → ardesia, ~60° a gradino) si legge come
   multicolore a qualunque dimensione. Visto in uno scatto, non dedotto.
2. **`border-image` non convive col raggio della lastra** — squadra l'angolo. Il filo e'
   disegnato con uno `::before` di 3 px.

**Verificato dipingendo i token su un canvas e leggendone i byte** (`getComputedStyle`
restituisce `oklab(…)` per i `color-mix`: leggerne i numeri come RGB da' nero, ed e' il modo
perfetto per credere che sia tutto rotto quando non lo e'). 16 rapporti, due temi: il testo
del bottone iride sta fra 5,74:1 e 7,88:1 su **tutte e quattro** le fermate del gradiente.

**Il copy non nomina la macchina.** Dice cosa succede, non chi lo fa. Vale solo per lo
schermo: qui e all'esame si chiama col suo nome.

---

## 13. La vetrina: visite e opere in un posto solo (2026-07-31)

`visite` e `opere` erano due schermate con due ricerche e due serie di filtri. Ora sono una,
`#/vetrina`, con due sezioni intitolate. Il binario del visitatore passa da quattro voci a
tre, che sotto `lg` e' una barra in basso e si sente.

**Il raggruppamento delle descrizioni per opera resta com'era** — funziona, e con 104
descrizioni per museo e' l'unica cosa che rende sfogliabile il catalogo.

**La durata si calcola prima di scrivere, ed e' la somma delle tappe vere.** Lo era gia' in
teoria, ma due punti la tradivano su una visita a tappe di lunghezza diversa: `POST /visits`
faceva `payload.duration ?? somma` — si fidava di un totale mandato dal client — e
`/visits/custom` sommava la durata **pianificata** invece di quella dell'item trovato, mentre
`resolveOrGenerateItem` ripiega su un item di qualunque lunghezza quando quella voluta non
esiste. Provato contro il server riavviato: 15+60+15 fa 90, e un client che ne dichiara 99999
viene ignorato.

**I filtri non filtravano, e non era un'opinione.** Misurato sul database prima di toccare
niente:

- le fasce di durata (`< 30` / `30-60` / `> 60` min) prendevano **tutte e 9 le visite nella
  prima**: due opzioni su tre restituivano zero, la terza tutto. Non era sbagliato il filtro
  ma le soglie: `Visit.duration` somma minuti di **lettura**, non di visita, quindi 13 tappe
  da 15s fanno 3 minuti. Ora le soglie sono 5 e 15, in **una tabella sola** con etichetta e
  predicato nella stessa riga, e il confronto e' `banda.test(min)`. Una prima versione
  ricavava le fasce dai dati, ~25 righe: buttata, un filtro dev'essere un `if`;
- `availableLevels()` accodava qualunque valore trovato, quindi **`Personalizzata` compariva
  come quinto livello** — `state.md` §7.3 lo aveva previsto anni fa;
- il livello confrontava `Visit.level`, che e' **un campo solo**: una visita che mescola i
  toni non si trovava sotto nessuno di essi. Ora si guardano i toni delle tappe, con la voce
  **`Misto`** in piu'.

⚠️ **`Misto` non aveva dati con cui provarsi**: nessuna visita del seed mescola i toni (0 su
9). Provato fabbricandone una via API con una tappa `Infantile` e una `Avanzato`: la vetrina
legge due toni, la etichetta `Misto` invece di `Personalizzata`, la trova sotto `Misto` e
sotto ciascuno dei due toni, e **non** sotto un terzo. Poi buttata. Un filtro che nessun dato
esercita e' un filtro non provato.

**Trappola del provare, non del codice.** Filtrando per `Medio` restano **tutte e 13** le
opere, e sembra che il filtro non morda: e' giusto invece: ogni opera ha descrizioni in tutti
e quattro i toni, quindi a stringersi sono le descrizioni DENTRO ciascuna carta — 104 → 26.
Il controllo va fatto su quelle, non sul numero di opere.

I vecchi `#/visite` e `#/opere` continuano a rispondere e arrivano con la specie gia' scelta.

---

## 14. Contenuti a pagamento e biglietto di rientro (2026-07-31)

**Il paywall non teneva.** `GET /items` restituiva i documenti interi — testo compreso —
filtrando solo `visibility`, e `collezione` non veniva consultata da nessuna parte prima di
servire un testo. Con dei prezzi veri sarebbe bastato aprire la risposta (o la console: il
testo stava gia' in `marketItems`) per leggere quel che era in vendita. Ora la regola sta in
`server/src/access.ts`, una sola, usata dalle tre rotte che servono testi (`/items`,
`/visits/:id/items`, `/artworks/:qid/preview`): si legge se e' gratuito, se l'hai scritto o
se l'hai comprato; il resto del documento resta pubblico, perche' quello e' il catalogo.

⚠️ **E' autorizzazione, non autenticazione.** Il nome utente arriva dalla richiesta e nessuno
verifica che sia tuo: difende dal vedere per sbaglio, non da chi scrive un altro nome. La
riga da dire all'esame e' questa, non «e' sicuro».

**Il rientro dal navigator.** Il problema non era il formato del token ma il *trasporto*:
altra origine, quindi o memoria del browser (la persistenza rifiutata) o indirizzo. JWT non
crea un terzo canale, e qui sarebbe pure sbagliato — la verifica senza stato non serve a un
processo solo, non si revoca senza una lista, e `jsonwebtoken` non si installa (`node_modules`
di root). Quindi: biglietto monouso `crypto.randomUUID()`, **coniato dentro `POST /login`**
perche' e' l'unico punto dove la password si verifica davvero.

Verificato: 8 controlli sul server (password sbagliata → niente biglietto; monouso, il
secondo tentativo 404; inventato 404; due accessi due biglietti) e 9 in browser (sta in
memoria e non in `localStorage`, il collegamento diretto lo porta e **il QR no**, rientrando
si e' sulla home, sparisce dall'indirizzo, riusarlo torna alla soglia, e `/` a mani nude
mostra ancora la soglia).

⚠️ **Trappola della prova, non del codice:** il metodo si chiama `visitQrUrl`, non `qrUrl`;
il primo giro falliva dentro lo script e sembrava un difetto dell'app.
