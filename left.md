# `left.md` — handoff

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
