# `pulizia.md` — passata di pulizia, 2026-08-08

Giro file per file su `server/src`, `navigator/src`, `shared/` e `marketplace/src`.
Due meta': **quello che ho gia' fatto** (convenzioni, e nient'altro che tocchi il
comportamento) e **quello che ho trovato e NON ho toccato**, che e' la parte da
discutere.

Verifiche: `tsc` verde su server e marketplace, `vue-tsc` verde sul navigator,
`vite build` del navigator riuscito, `dist/` del marketplace ricostruito e il
`tsc` **letto**, non solo eseguito. Le tre correzioni della Parte 2 sono state
provate contro un server vero sulla **8100** — sulla 8000 gira il tuo, che vede
il codice vecchio finche' non lo riavvii, ed e' quello che ha fatto da "prima".

---

## Parte 1 — quello che ho fatto

### 1.1 Le convenzioni di `guidelines.md`

- **Spiegazioni dal corpo del file alla testa.** Circa 120 blocchi. I commenti a
  meta' file sono spariti e il loro contenuto e' salito nell'intestazione, ridotto.
- **Contratti delle rotte.** Erano l'eccezione della regola 2 ma mancavano in
  molte: aggiunti a **19 rotte** che non ne avevano (tutte e 13 di
  `guidedSessions.ts`, 5 fra `visits.ts`/`museums.ts`/`artworks.ts`, `/speech/tts`).
- **Due contratti indicavano la rotta sbagliata**: `POST /app/llm/newInfo` e
  `POST /app/speech` — sono sotto `/api`, non `/app`.
- **Campi delle interfacce**: commento sulla stessa riga, come mi hai chiesto.
  Fatto su `shared/types.ts`, `shared/constants.ts`, `svgGraph`, `wayfinding`,
  `llm`, `pricing`, `museumConfigs`, `guidedSessions`, `localization`, `guided`.
- **Emoji via**: 37 `⚠️` tolte da 11 file (`guidelines.md` lo vieta in fondo, e
  `missing.txt` dice «rimuovere bullshit e caratteri strani»).
- **Spazi in fondo alle righe**: 34 righe in 5 file.
- **Commenti in inglese** (regola 3): tolti da `models/artwork.ts`,
  `models/museum.ts`, `models/visit.ts` («Interface representing the… document
  in Mongoose», che oltretutto ripeteva il nome del tipo).

### 1.2 Commenti che erano orfani, doppi o falsi

Questi non erano questione di stile: dicevano il falso.

| dove | cos'era |
| --- | --- |
| `routes/artworks.ts:177` | due `/** */` impilati sopra `eliminaVisiteCitanti`, e il primo descriveva `impattoOpera`, che sta piu' sotto e ha gia' il suo |
| `routes/visits.ts:48` | contratto doppio di `GET /visits`, con dentro un «(quella ufficiali)» |
| `routes/visits.ts:101` | il blocco sul quiz stava sopra `nascostaA` invece che sopra `GET /:id`, che e' la rotta che fa `.select("-quiz")` |
| `routes/items.ts:228` | il contratto di `POST /api/items` stava sopra `freeItemId`, e la rotta vera non ne aveva nessuno |
| `services/wikidata.ts:64` | un commento in minuscolo, senza destinatario, che descriveva `fetchArtwork` ma stava sopra `valoreOMai` |
| `scripts/seedUsers.ts` | due intestazioni, una dopo gli import |
| `scripts/seed.ts:391` | dichiara **due** visite dimostrative; il codice ne scrive **una** e cancella l'altra |
| `scripts/testers.ts:8` | elenco dei comandi ricopiato a mano e gia' derivato: mancavano `licenze` e `account`. Ora rimanda a `COMMANDS`, che `main()` stampa gia' da se' |
| `services/svgGraph.ts:14` | il contratto della pianta **non elencava `data-poi="entrance"`**, che e' obbligatorio: 8 occorrenze sui 4 SVG, e senza di lui il pathfinding non sa da dove partire |

### 1.3 Ritocchi al codice, tutti minimi e a comportamento invariato

- Via gli ultimi **`??`** del progetto (`items.ts`, `visits.ts`,
  `guidedSessions.ts` ×2, `navigator/api.ts`) → `if`/`else` espliciti, come da
  memoria `code-style-explicit-c-like`. Ora `grep '??'` sul sorgente non torna nulla.
- `!!v.hasQuiz` → `Boolean(v.hasQuiz)`.
- `let` → `const` dove non si riassegna (`users.ts`, `museums.ts`).
- **Import doppi dallo stesso modulo** uniti: `items.ts` e `visits.ts`
  importavano `shared/constants` due volte di fila.
- **Numeri nudi con un nome**: `LARGHEZZA_ORIGINALE` (era `800` in mezzo al
  codice), `PRESENZA_TTL_MS` (era `TTL_MS`, che non diceva di che),
  `PASSO_INTERROGAZIONE_MS` (era `1500`).
- `visits.ts`: il titolo era ricalcolato (`payload.titolo || payload.name`) al
  salvataggio invece di riusare quello **gia' validato**; stessa cosa per
  `ofMuseum`, che aveva gia' `museoUri`.
- `navigator/api.ts`: due `catch {}` **vuoti e muti**, ora dicono perche' tacciono.
- `navigator/api.ts`: `gsBase()` chiamava `apiBase()` mentre tutto il resto passa
  da `base()`.

---

## Parte 2 — trovato e NON toccato: da decidere insieme

Ordinati per quanto costano se restano.

### 2.1 ✅ RISOLTO — `pota` cancellava sette messaggi vivi del navigator

**Il difetto.** 514 chiavi, tutte tradotte in dodici lingue, e 14 orfane per
lingua. Ma sette di quelle quattordici erano le frasi d'avvio del navigator, che
**funzionavano**: stanno in un `ref` e si traducono nel legame (`t(erroreAvvio)`),
che e' la correzione giusta del 2026-08-07. L'estrattore pero' cerca `t("…")` nel
sorgente e li' non le vedeva: risultavano orfane, e `pota` — che `left.md` mette
in coda — le avrebbe cancellate **in dodici lingue**, in silenzio.

**La cura, su due piani.**

1. *La causa.* `navigator/src/i18n.ts` esporta ora `tKey(frase)`, che a tempo
   d'esecuzione non fa niente e serve a dichiarare «questa e' una CHIAVE, la
   traduce qualcun altro». Le sette frasi di `App.vue` ci sono avvolte, e
   l'estrattore raccoglie da `t(...)` **e** da `tKey(...)`.
2. *La classe.* `pota` da solo non cancella piu': elenca e si ferma. Serve
   `--conferma`. «Orfana» vuol dire soltanto «l'estrattore non la trova», che non
   e' «nessuno la mostra piu'», e le due si assomigliano troppo per distinguerle
   dopo.

**Misurato, prima → dopo:**

| | prima | dopo |
| --- | --- | --- |
| chiavi viste dall'estrattore | 514 | **521** |
| orfane per lingua | 14 | **0** |
| frasi italiane fuori catalogo | 10 | **3** (ART, AROUND, ArtAround: il marchio) |

Le sette orfane rimaste erano morte davvero — `Togli dal catalogo` e compagnia,
sostituite da `Rimuovi` — verificate a zero occorrenze nel sorgente e **potate**:
84 traduzioni tolte, i cataloghi ora dicono 521/521 senza orfane. I sette
messaggi d'avvio sono stati riletti da `en.json` **dopo** la potatura e ci sono
tutti: e' esattamente la prova che prima sarebbe fallita.

### 2.2 ✅ RISOLTO — due rotte mandavano il testo a pagamento a chiunque

Tutto `access.ts` esiste per non far viaggiare il testo di una descrizione a chi
non l'ha comprata. Due rotte lo aggiravano.

**Provato contro un server vero** (il vecchio codice gira ancora sulla 8000, il
nuovo sulla 8100), con `visitatore1`:

| | prima (`:8000`) | ora (`:8100`) |
| --- | --- | --- |
| `/api/items/author/Museo` | **200 — 4359 descrizioni, 2179 a pagamento, col testo** | **403** |
| `/api/museums/Q51252/items` | **200 — 2380 righe, 1190 a pagamento, col testo** | **403** |
| `/api/museums/Q51252/overview` | 200 | **403** |
| `/api/museums/Q51252/items` da curatore | 200, col testo | 200, **senza testo** |
| `/api/items/author/autore1` da autore1 | 200 | 200, invariato |

- **`GET /api/items/author/:authorName`**: il nome nell'indirizzo deve coincidere
  con quello della sessione, altrimenti 403. Resta l'unica rotta che manda i
  testi senza passare da `readableItems`, ed e' lecito perche' risponde a chi
  quei contenuti li ha scritti: `isReadable` da' comunque per letto all'autore
  quel che e' suo, quindi la regola non e' sospesa, e' gia' soddisfatta.
- **`GET /api/museums/:qid/items`**: guardia sul ruolo curatore, **piu' `-text`**.
  Non e' una restrizione in piu': quella schermata mostra tono, durata, prezzo e
  licenza, e il testo non lo legge nessuno (verificato sui tre punti di
  `state.ts` che scorrono `curatedItems`). E' la stessa scelta di
  `GET /items/metadata`, e su duemila descrizioni e' anche la differenza fra una
  risposta leggera e una che porta tutto il museo.
- **`GET /api/museums/:qid/overview`**: guardia sul ruolo, per coerenza — il
  file la dichiara «lettura del curatore» accanto all'altra, e lasciarne una
  aperta avrebbe fatto mentire di nuovo l'intestazione. Non perdeva testo, solo
  conteggi.

### 2.3 `GET /artworks/:qid/preview` scrive un tono che non esiste

`routes/artworks.ts`: quando l'opera non ha nessuna descrizione, ne genera una con

```ts
let usedLevel = "Intermedio";
```

`"Intermedio"` **non e' fra gli `educationalLevels`** (Infantile, Semplice, Medio,
Avanzato). Anzi: `testers.ts` ha una migrazione, `TONE_MAP`, che serve proprio a
riportare `Intermedio → Medio` — quindi questa rotta ricrea a mano quel che un
comando esiste per ripulire. Il documento generato finisce nel database con un
tono fuori vocabolario, e `testers.ts stato` lo segnalera'.

Va deciso quale sia il ripiego (`educationalLevels[0]`? `"Medio"`?) — e' una
scelta di prodotto, per questo non l'ho fatta io. Vale anche la memoria
`no-hardcoded-enumerations`: la stringa non dovrebbe essere scritta a mano.

### 2.4 ✅ RISOLTO — la pausa del seed, che non serve piu'

Le chiamate al modello sono su un piano a pagamento, quindi la pausa contro i
limiti di frequenza non ha piu' motivo di esistere. Tolta:

- `seed.ts`: via `PAUSA_LLM_MS` e le due `delay()` nel ciclo degli item e in
  quello dei soggetti. Via anche `oreAlPeggio`, la stima che con pausa zero
  diceva sempre `0.0h`.
- `languages.ts`: via le due pause da 6 s, fra una lingua e l'altra e fra un
  blocco e l'altro. Erano dodici lingue x 6 s piu' una pausa ogni 40 chiavi. Il
  taglio in blocchi **resta**, perche' quello non e' per frequenza ma per
  DIMENSIONE della risposta: chiedendo tutto in un colpo il JSON torna troncato.
- Corretti i tre punti che promettevano la pausa: l'intestazione di `seed.ts`,
  quella di `languages.ts`, e `CLAUDE.md` («~8 LLM calls per artwork with a 6s
  pause» → 20 chiamate per opera, di fila).

Resta `PAUSA_IMMAGINE_MS`, che e' verso **Wikimedia** e i suoi limiti li fa
ancora rispettare: e' quella che evita il 429 documentato nella ripresa del 7
agosto.

### 2.5 Quattro funzioni morte che dicono il falso

`dbActions.ts` esporta `deleteArtwork`, `deleteItem`, `deleteVisit`,
`deleteMuseum`: **zero chiamanti**, verificato su tutto il sorgente. Non sono
neutre — sono la trappola che due file avvertono di non toccare:

- `guidelines.md` §1 le usa come esempio: *«non usare `dbActions.deleteItem` per
  gli item: salta la cascata»*;
- `routes/artworks.ts` apre con *«NON usare `dbActions.deleteArtwork`…»*.

Regola 5: il codice morto mente su cosa e' vivo. Togliendole spariscono anche i
due avvertimenti, che diventano inutili — ed e' il verso giusto. Ma
`guidelines.md` perde il suo esempio, quindi la decisione e' tua.

Altri due morti, nel marketplace (cercati anche in `index.html`, per la trappola
dei legami Alpine):

- **`state.ts:3235 visitsLeft()`** — avanzo del tetto di ieri. La pagina scrive
  «Itinerari tuoi in questo museo: {n} di {max}» con `composedVisitCount()` e
  `maxVisiteVisitatore`; `visitsLeft` non la chiama nessuno.
- **`state.ts:3360 periodFilter`** — campo dichiarato e mai letto. Corrisponde a
  una voce di `missing.txt` («filtrare le vendite per periodi»): o e' l'inizio di
  quella funzione, o va tolto.

Il resto e' pulito: 158 metodi su 159 di `AppState` sono raggiunti, 28 su 28 di
`ArtAPI`, tutte le funzioni di `app.ts`.

### 2.6 Il navigator non chiede mai la sincronia che il server offre

`POST /guided-sessions/:id/step` accetta `ritardoMs`, e serve a far partire
l'audio insieme su tutti i dispositivi — e' **il** punto del modulo 18-27.
`navigator/api.ts postGuidedStep` manda solo `{ index }`, quindi il ritardo e'
sempre 0 e ogni telefono parte quando gli arriva la sua risposta.

O il parametro serve e il client deve passarlo, o non serve e va tolto dal server.
Non l'ho deciso perche' va provato con due dispositivi veri.

### 2.6-bis ✅ RISOLTO — dove finivano davvero i millisecondi

Misurato, non dedotto: server di prova sulla **8100** col codice nuovo, il tuo
sulla **8000** col vecchio, stesso database (4 364 item, 210 opere, 85 visite;
gli Uffizi da soli sono 2 380 item).

**Il database non c'entrava.** Ogni interrogazione e' gia' un `IXSCAN` — gli
indici messi a suo tempo fanno il loro lavoro — e Mongo risponde in 0-16 ms:

```
items {ofMuseum, visibility:$ne privato}   IXSCAN   esaminati 2380 -> resi 2380   16ms
items {about}                              IXSCAN   esaminati   20 -> resi   20    0ms
visits {$or visibility/author}             IXSCAN   esaminati   21 -> resi   21    0ms
artworks {ofMuseum}                        IXSCAN   esaminati  117 -> resi  117    0ms
```

**Nemmeno la rete.** `compression` fa il suo: il catalogo va da 946 KB in chiaro
a **35 KB** compressi, quello del curatore da 2 232 a 50 KB.

**Erano i documenti Mongoose.** Per ogni riga il driver costruisce un oggetto con
getter, setter e tracciamento delle modifiche — roba che serve a chi poi fa
`.save()`. Queste rotte leggono e basta: serializzano in JSON e buttano via
tutto. Su 2 380 righe la costruzione costa piu' della query, del trasporto e
della serializzazione messi insieme:

| stessa interrogazione | documenti | `.lean()` (+ `.select()`) |
| --- | --- | --- |
| il catalogo del museo | 167 ms | **83 ms** |
| le tappe per il conto delle visite | 177 ms | **52 ms** |
| gli item per il quadro d'insieme | 179 ms | **28 ms** |
| il catalogo del curatore | 178 ms | **51 ms** |

**Applicato `.lean()` alle rotte di sola lettura, e nient'altro.** E i due
`countDocuments` per museo di `GET /museums` sono diventati due aggregazioni:
prima erano due interrogazioni **per museo**, cioe' l'unica cosa che questo
progetto e' fatto per far crescere.

Nessun `.select()` di velocita': ne avevo messi quattro e li ho **tolti tutti**,
per la ragione scritta in §2.6-quater. Restano solo i `select` che gia' c'erano e
quelli che **escludono** un campo per non spedirlo (`-text`, `-quiz`), che sono
un'altra cosa: li' il campo si toglie perche' non deve viaggiare, non perche'
costa.

**Da capo a capo, prima → dopo:**

| rotta | prima | dopo | |
| --- | --- | --- | --- |
| `GET /museums/:qid/items` | 413 ms | **201 ms** | −51% |
| `GET /items/metadata?museum=` | 270 ms | **134 ms** | −50% |
| `GET /museums/:qid/overview` | 226 ms | **120 ms** | −47% |
| `GET /artworks?museum=` | 47 ms | **27 ms** | −43% |
| `GET /items?museum=` | 374 ms | **217 ms** | −42% |
| `GET /visits?museum=` | 201 ms | **126 ms** | −37% |
| `GET /museums` | 49 ms | **32 ms** | −35% |
| `GET /museums/:qid/topics` | 32 ms | **21 ms** | −34% |
| `GET /visits/:id/items` | 76 ms | **46 ms** | −39% |

`.lean()` non cambia il CONTENUTO della risposta, e non e' un'opinione: le
risposte delle due porte sono state confrontate una per una. **Tutte identiche
per contenuto**, `populate` compreso (`about` resta un oggetto). L'unica diversa
e' `/museums/:qid/items`, che ha un campo in meno — `text` — ed e' la correzione
voluta del §2.2.

Una differenza c'e' pero', ed e' bene saperla: **cambia l'ORDINE delle chiavi**
dentro l'oggetto espanso da `populate`. Un documento Mongoose mette per primi i
sotto-documenti (`author`, `style`), `lean` conserva l'ordine con cui il dato sta
su disco (`_id`, `@id`, `@context`, …). Le chiavi sono le stesse e i valori pure
— verificato ordinandole: identici. Per un client che fa `JSON.parse` e legge
`about.name` non cambia niente, e qui non c'e' nessuno che confronti risposte
grezze, ne' ETag, ne' istantanee di prova. Va detto lo stesso, perche' «identica»
e «identica byte per byte» non sono la stessa affermazione e la seconda sarebbe
falsa.

Chi apre gli Uffizi da visitatore fa quattro richieste in parallelo
(`loadCatalogue`): la piu' lenta delle quattro passa da ~245 a ~146 ms, quindi
l'attesa a schermo si accorcia di circa **cento millisecondi**, e il compositore —
che `left.md` misurava a 1 049 ms di compito lungo — resta il costo dominante.

### 2.6-quater I rischi di `.lean()`, controllati uno per uno

`.lean()` salta la costruzione del documento Mongoose, quindi si perde tutto cio'
che il documento aggiunge. Ogni cosa che si perde e' stata cercata nel progetto:

| cosa si perde | c'e' in questo progetto? |
| --- | --- |
| `virtual`, getter, setter, `toJSON`/`toObject` con `transform` | **nessuno**, in nessuno dei sei schemi |
| `.save()`, `.markModified()` | due soli usi, `items.ts:299` e `visits.ts:129`, **su query che non ho reso lean** |
| valori di scorta applicati in lettura | non ce ne sono: sono tutti scritti sul documento |
| `populate` | **funziona lo stesso**: `about` resta un oggetto |
| `populate` che non risolve | rende `null` in tutti e due i modi (provato) |
| serializzazione JSON | stessi campi, `_id` e `__v` compresi (provato su 50 item) |

**`.lean()` e `.select()` non sono la stessa scommessa**, e li ho separati
misurandoli invece che a occhio:

| | documenti | `.lean()` | `.lean()` + `.select()` |
| --- | --- | --- | --- |
| 2 380 item del museo | 183 ms | 83 ms | 42 ms |
| 2 080 tappe per il conto | 170 ms | 83 ms | 45 ms |
| 117 opere | 18 ms | 11 ms | 7 ms |
| 21 visite | 13 ms | 11 ms | 6 ms |

`.lean()` da' meta' del guadagno e **non costa niente in manutenzione**: non
cambia quali campi esistono, quindi non c'e' niente da tenere allineato e non
impedisce di leggere domani un campo che oggi nessuno legge.

`.select()` dimezza di nuovo quel che resta, ma e' un VINCOLO: chi aggiunge una
lettura deve aggiungerla anche li', e chi se ne dimentica non prende un errore,
prende `undefined`. E' la stessa famiglia di guasto silenzioso che questo progetto
paga piu' spesso — la tappa che non si risolve e non compare, il legame Alpine
rinominato che smette di scattare.

**Tolti tutti e quattro.** Un'ottimizzazione che si paga in vincoli va giudicata
sul suo prezzo, e qui il prezzo era di tenere a mente una lista di campi in due
posti per sempre. Restano circa 40 ms su due rotte, ed e' un cambio accettato
sapendolo: `GET /visits` passa da 92 a 126 ms e il quadro d'insieme da 123 a
120 ms — comunque meta' del punto di partenza, che era 201 e 226. Il guadagno
grosso non veniva da li'.

Due casi limite che il confronto fra le due porte **non** copriva, perche' i dati
non li contengono, provati a parte:

- **un museo con zero opere o zero visite**: `countDocuments` dava 0, la mappa
  dell'aggregazione con `|| 0` da' 0. Uguali. E sui quattro musei veri i due
  metodi concordano su tutti e quattro.
- **un `about` che punta a un'opera cancellata**: nel database non ce n'e'
  nessuno, quindi il caso e' stato costruito a mano — `null` in tutti e due i modi.

L'aggregazione conserva la semantica del filtro, e i dati la esercitano davvero:
80 visite non hanno **affatto** il campo `accessKey` e `$in: [null, ""]` le
prende comunque, 4 sono guidate e 1 e' privata.

### 2.6-ter `GET /api/items` non la chiama nessuno

E' la rotta piu' pesante del progetto — documenti interi, testi compresi, 423 ms
e 2,2 MB prima delle correzioni qui sopra — e **nessun client la chiama**.
Cercata in tutto il sorgente: il marketplace usa `/items/metadata`,
`/items/:id/text`, `/items/author/:nome`, `/items/:id/impact` e le due di
scrittura; il navigator non la nomina. L'unico `'/api/items'` che si trova e' la
**POST** che pubblica un contenuto.

L'intestazione la chiama «la primitiva completa», il che era vero quando il
client scaricava tutto in un colpo; da quando il catalogo si prende in metadati e
i testi si chiedono per opera, e' rimasta li'. Va tolta o va detto chi la usa —
oggi e' superficie che nessuno esercita e che, il giorno che qualcuno la
chiamasse per sbaglio, spedisce l'intero museo.

### 2.7 Cose piu' piccole, in fila

**Corrette da valutare**

- `services/stt.ts:31` — `result.alternatives?.[0].transcript`: il `?.` protegge
  `alternatives` ma non il `[0]`. Con un array vuoto (che Google rende) esplode.
- `state.ts loadMuseum` (navigator) — se la chiami con un museo **diverso**
  mentre un caricamento e' in corso, ti restituisce la promessa di quello vecchio.
  Oggi non capita, perche' il museo e' uno solo per sessione.
- `POST /users/buy` con un `itemId` che non esiste: `conto()` riceve un finto
  `{price: 0}`, costo 0, e l'id **entra in `collezione`**. Compra il nulla.
- `routes/visits.ts` — la durata si somma sugli item **trovati**, e `find({$in})`
  non ripete i duplicati: una visita che passa due volte dalla stessa descrizione
  la conta una volta sola.
- `services/wikidata.ts fetchMuseum` dichiara `Promise<MuseumMetadata>` e poi fa
  `return null as any`. Il tipo mente a chi chiama.
- `GET /visits` **non toglie il quiz** (`GET /:id` si'). Le risposte corrette
  viaggiano nell'elenco. E' scritto che l'editor dell'autore le legge da li',
  quindi e' voluto — ma quell'elenco lo chiede anche chi autore non e'.
- `GET /guided-sessions/:id` (vista docente) **non controlla che chi chiede sia
  il docente**: chi ha l'id svuota la coda delle domande.

**Prestazioni** (le voci risolte stanno in §2.6-bis; queste restano aperte)

- `svgGraph.getMuseumGraph` tiene la pianta **in cache per sempre**, mentre
  `loadMuseumConfigs` si rilegge apposta a ogni chiamata «cosi' cambiare un file
  non obbliga a riavviare il server». Le due meta' dello stesso museo hanno regole
  opposte: correggere un SVG richiede un riavvio, e non e' scritto da nessuna parte.
- `sortByFlow` ricostruisce `flowOrder` (filtro + ordinamento su tutti i nodi) a
  **ogni chiamata**, e la chiamano tre rotte. Il risultato dipende solo dalla
  mappa, che e' gia' in cache.
- `translate.ts` — `missingTxt` puo' contenere **duplicati**: lo stesso testo
  ripetuto nell'elenco viene mandato a Google due volte e pagato due volte.
- `pricing.ts conto()` — `daPrendere.includes(id)` dentro il ciclo sulle tappe:
  quadratico. Su 104 tappe × 86 visite si sente appena, ma un `Set` costa una riga.
- **`catalogo` nel marketplace**: `left.md` lo lascia aperto e lo confermo —
  2 110 elementi montati all'apertura anche per chi quella rotta non puo' aprirla.
  E' lo stesso difetto del compositore, un piano piu' su, e si chiude nello stesso
  modo (`x-if` invece di `x-show`).

**Duplicazione**

- `services/wikidata.ts` ripete **tre volte** lo stesso blocco `fetch` +
  intestazioni + `conTentativi` (12 righe l'una). Tre call site sono oltre la
  soglia della regola 4: un `interroga(query, etichetta)` toglierebbe 24 righe
  senza inventare nessuna astrazione.
- `data/quiz.ts costruisciQuiz` — tre cicli quasi identici, ognuno con `if
  (quiz.length >= N) break`. Funziona, ma il terzo ricalcola `altre` a ogni giro
  e non filtra i nomi non validi come fanno gli altri due.
- `scripts/languages.ts` sceglie il comando con una catena di
  `if (command === "…") return`, mentre il fratello `testers.ts` usa una tabella
  `COMMANDS`. Due script vicini, due modi.

**Coerenza**

- `navigator/state.ts stopName()` rende `"Contenuto"` **non tradotto**, in
  un'applicazione che parla tredici lingue.
- `navigator/api.ts` solleva messaggi in **inglese** (`Failed to fetch visit: …`)
  in un progetto in cui il testo utente e' italiano. Alcuni finiscono a schermo.
- Le chiavi di memoria del navigator (`artaround-stage`, `artaround-posizione`,
  `artaround-sessione`, `artaround-theme`) sono scritte a mano nei file, mentre
  `LANG_KEY` sta in `shared/constants.ts` proprio perche' «scritta in due file,
  prima o poi ne diventa due».
- `seedUsers.ts` crea quattro account e **nessun curatore**; il curatore lo crea
  solo `testers.ts account`. Chi segue il `README` non ha modo di entrare come
  curatore.
- 19 errori di `eslint` sul navigator, tutti preesistenti e di due sole famiglie:
  10 `no-explicit-any` e **9 `vue/multi-word-component-names`**. I nove
  contraddicono `guidelines.md` §3, che dichiara i nomi dei componenti
  deliberatamente italiani e singoli: quella regola va spenta nella
  configurazione, o il lint restera' rosso per sempre e nessuno lo guardera' piu'.
- `README.md` rimanda a **`spec.md`**, che non esiste piu' (`CLAUDE.md` lo dice).

---

## Parte 3 — una decisione di metodo che ho lasciato a te

`guidelines.md` §2 dice «dentro il file, solo separatori», con **una** eccezione:
i contratti delle rotte, «perche' e' quel che vai a cercare quando apri un file di
rotte».

Tre file hanno esattamente quella forma senza essere rotte, e li ho **lasciati
com'erano**, aggiungendo una riga in testa che dichiara la scelta:

- `scripts/testers.ts` — 16 comandi indipendenti, ognuno col suo «cosa riallinea
  e perche'». Portarli tutti in testa farebbe un'intestazione di 300 righe.
- `scripts/languages.ts` — stessa forma, 5 comandi.
- `marketplace/src/frontend/state.ts` (3 412 righe) e `app.ts` — **240 commenti a
  corpo di file** fra i due, e un'intestazione che ne assorbisse anche solo meta'
  ne conterebbe 600. Qui la regola 1 e la regola 4 tirano in direzioni opposte.

La stessa domanda vale per i quattro `.vue` grossi del navigator: ho spostato in
testa i commenti `//` a corpo di file (che erano la violazione netta) e lasciato i
`/** */` sopra i gestori, che sono contratti come quelli delle rotte.

**La mia proposta**: scrivere in `guidelines.md` che l'eccezione della regola 2
non e' «le rotte» ma «i punti d'ingresso» — una rotta, un comando di uno script,
un gestore chiamato da un legame Alpine o da un `@click`. E' la stessa
motivazione gia' scritta li' («e' quel che vai a cercare»), detta in modo che
copra i casi che esistono davvero nel progetto. Se invece vuoi la lettura stretta,
lo faccio, ma su `state.ts` e' mezza giornata e il risultato e' un'intestazione
che nessuno leggera'.
