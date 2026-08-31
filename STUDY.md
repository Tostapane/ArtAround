# `STUDY.md` — il sistema, in sei sezioni

Documento di studio: **fatti**, non esercizi. Serve a chi dovra' spiegare questo progetto ad
alta voce senza l'autore accanto, quindi ogni affermazione porta il file (e dove serve la riga)
da cui e' stata verificata.

**Come si rapporta agli altri documenti.** `state.md` racconta *cosa e' successo* al progetto e
resta autorevole sulle motivazioni; `left.md` e' il diario cronologico. Nessuno dei due si legge
per sapere *com'e' adesso*: sono scritti nel tempo e invecchiano. Questo file e' stato compilato
**leggendo il codice**, e dove il codice contraddice `state.md` lo dice.

> ⚠️ **Tre cose che `state.md` dice e che il codice smentisce.** Sono verificate, e vale la pena
> saperle perche' sono gli errori in cui si cade rileggendo la documentazione vecchia:
>
> | `state.md` dice | il codice dice |
> | --- | --- |
> | `secPerArt = [15, 60]` (§2.1) | `[15, 30, 60, 120, 180]` — **cinque** durate (`shared/constants.ts:83`). Quindi **20 item per opera**, non 8 |
> | `GET /museums/:qid/visits?user=` (§0.1) | nessuna rotta legge `req.query.user`: l'identita' e' solo la sessione |
> | l'inventario rotte elenca `GET /museums/:qid` e `POST /items/batch` (§3.1) | **non esistono piu'** in `server/src/routes/` |

---

## 1. Le idee

### 1.1 Cos'e' il prodotto

Un sistema di **visite museali generico**: un catalogo di opere alimentato da Wikidata, sopra il
quale autori e visitatori scrivono descrizioni e compongono percorsi, che poi si eseguono dentro
il museo con mappa, voce e localizzazione. Il museo non e' cablato da nessuna parte: e' un file
di configurazione piu' una pianta disegnata.

Il compito (`slides.pdf`, corso Tecnologie Web, Bologna) definisce tre bande di voto:

| banda | cosa aggiunge |
| --- | --- |
| 18-24 (obbligatoria) | marketplace + editor, navigator con selezione ed esecuzione della visita, mappa, sintesi vocale, testo a schermo, comandi vocali a vocabolario controllato **con bottoni equivalenti** |
| Modulo I (18-27) | visita sincronizzata col docente + quiz finale |
| Modulo II (18-33) | localizzazione QR, modulo di teletrasporto, integrazione profonda del modello linguistico |

Due criteri sono pesati oltre alle funzioni: la **genericita'** (slide 19) e la **presentazione
delle informazioni** (slide 36 — rapporto fra dimensione della maschera e del dato, corretta
differenziazione fra tipi di dato e annotazioni). Una funzione obbligatoria mancante rende il
progetto inaccettabile: la correttezza-alle-slide viene prima della rifinitura.

### 1.2 Due applicazioni, e perche' sono due

Slide 37 lo impone come vincolo hard — una parte **senza** framework, una **con** — ma la
divisione ha anche una ragione di prodotto: al banco si legge, si confronta e si compra con
calma; dentro il museo si cammina, si ha una mano sola e spesso una cuffia. Da li' viene la
proprieta' piu' vincolante del navigator: **il guscio e' alto esattamente uno schermo e non
scorre** (`navigator/src/App.vue`, `h-[100dvh] overflow-hidden`); cio' che deve scorrere scorre
dentro se stesso.

### 1.3 I tre ruoli, e l'identita' come username

`UserRole = "autore" | "visitatore" | "curatore"` (`shared/types.ts`). L'identita' e'
**l'username**, con indice unico su quello solo (`server/src/models/user.ts:38`): un nome vale
per un account solo, quindi un autore e un visitatore omonimi non possono esistere.

⚠️ **Fino al 2026-08-31 l'identita' era la coppia `(username, role)`**, e vale la pena saper
dire perche' e' cambiata, perche' e' un difetto di modello e non una preferenza. `Item.author` e
`Visit.author` sono **un nome nudo**: il ruolo non e' mai stato scritto sul contenuto. Tutte le
guardie erano quindi confronti fra stringhe (`item.author !== chi.username`), e con due account
omonimi bastava entrare con l'altro profilo per **cancellare le descrizioni del primo** e per
**leggerne le private** attraverso `GET /items/author/:nome`. La stessa ambiguita' era risolta in
tre modi diversi in tre punti: confronto di stringhe, `findOne({username})` (che sceglieva un
account a caso) e `find({username})` (che univa le collezioni).

Delle due strade — scrivere il ruolo accanto all'autore su ogni contenuto, oppure rendere unico
l'username — si e' presa la seconda: la prima voleva un campo nuovo su due modelli, quindici
guardie riscritte lato server e cinquantacinque riferimenti lato client, **e una migrazione
impossibile** (per assegnare un ruolo ai contenuti gia' scritti si guarda il ruolo dell'autore,
che e' esattamente cio' che nel caso ambiguo non si sa). La seconda ha tolto codice: e' sparita
la risposta **300 `{scelta, ruoli}`** del login, con la schermata «Quale profilo apriamo?» e i
due aiutanti che la riempivano.

| ruolo | ha | non ha | da dove viene l'account |
| --- | --- | --- | --- |
| visitatore | `wallet`, `collezione` | — | registrazione libera |
| autore | `collezione` | `wallet` — **quindi non compra**, e non e' un difetto | registrazione libera |
| curatore | poteri sul catalogo del museo | `wallet`, `collezione` | `testers.ts account`; non si auto-registra, e **non e' richiesto dalle slide** |

Le slide chiedono quattro account: due autori e due visitatori (`seedUsers.ts`: `autore1`,
`autore2`, `visitatore1`, `visitatore2`, password `12345678`).

### 1.4 E' una single page application?

**Si', tutte e due, con due meccaniche diverse. Nessuna delle due usa una libreria di routing**
— ma le due assenze non sono la stessa cosa.

| | marketplace | navigator |
| --- | --- | --- |
| tecnologia | Alpine.js + TS compilato da `tsc`, **nessun bundler** | Vue 3 `<script setup>` + Vite |
| documento | un solo `public/index.html`, 2202 righe | `index.html` + `App.vue` |
| navigazione | **un router scritto a mano**: `parsePath` / `pushState` / `popstate` / `interceptClicks` | **nessun router**, e non serve: c'e' un indirizzo solo |
| indirizzi | veri: `/vetrina`, `/opera/Q12418` | `/navigator/?museum=…`, piu' parametri d'avvio |
| stato | un singleton, `export const state = new AppState()` (`state.ts:3412`) | `ref` globali in `state.ts`; nessuna libreria di store |

⚠️ **Dire "il marketplace non ha router" e' sbagliato.** Ne ha uno, di una cinquantina di righe,
che fa esattamente le tre cose che fa Vue Router: interpretare l'indirizzo, cambiarlo senza
ricaricare, e reagire ad avanti/indietro. Le librerie sono involucri intorno a `pushState` +
`popstate` + intercettazione dei click, cioe' proprio le chiamate che qui si vedono in chiaro.

Il **navigator** invece non ha davvero niente da instradare: un router mappa molti indirizzi su
molte schermate, e qui l'indirizzo e' uno. I parametri di query sono un **protocollo d'avvio**,
letti una volta in `App.vue` e non piu'.

Il **server non genera HTML e non ha template**: serve file statici e risponde JSON sotto `/api`.
L'unica pagina che compone e' il foglio dei QR (`museums.ts`, stringa HTML).

### 1.5 Frammento contro indirizzo vero

Fino al 2026-08-08 gli indirizzi erano `/#/vetrina`. La parte dopo `#` e' il **frammento**, e il
browser **non la manda al server**: con quella forma il server vedeva sempre e solo `/`.

Passare a `/vetrina` significa che l'indirizzo **arriva al server**, che quindi deve saperlo
riconoscere. Costo pagato in tre punti:

1. il server risponde col guscio agli indirizzi delle schermate (`server/src/index.ts:223`),
   riconoscendo **solo** i nomi di `marketplaceViews` — cosi' un file davvero mancante resta 404;
2. `pushState` **non emette nessun evento**: la rotta va applicata a mano subito dopo;
3. senza `interceptClicks()` ogni collegamento interno diventa una navigazione vera e
   l'applicazione riparte da zero, catalogo compreso.

Cio' che si compra: indirizzi che si possono copiare, mettere fra i preferiti e ricaricare.

### 1.6 La genericita'

Un museo sono **tre file omonimi** in `server/public/allestimento/`:

```
<Nome>.json    la configurazione     obbligatorio
<Nome>.svg     la pianta annotata    obbligatorio
<Nome>.jpg     la copertina          FACOLTATIVO
```

piu' un seed. Nessuna modifica al codice. `loadMuseumConfigs` rilegge la cartella a ogni
chiamata, quindi un museo nuovo compare **senza riavviare il server**, e un errore di sintassi
ferma quel file invece di far sparire tutti i musei.

⚠️ **La cartella non puo' chiamarsi `musei`**: `musei` e' anche il nome di una schermata, e il
server manda il guscio agli indirizzi delle schermate. Misurato prima di rinominare: un
`/musei/<Nome>.jpg` mancante rispondeva **200 con 143 KB di `index.html`**. Regola generale:
nessuna cartella sotto `server/public/` puo' portare il nome di una schermata.

### 1.7 I non-obiettivi, dichiarati

- **Sicurezza non valutata**: le password stanno in chiaro, ed e' scritto.
- **Nessuna suite di test.** Si verifica eseguendo. `guidelines.md` chiude su tre difetti che
  **compilavano tutti e tre**.
- **Niente WebSocket**: le visite guidate sono polling REST a 1,5 s (`guided.ts:89`).
- **Niente libreria di stato** in nessuna delle due applicazioni.
- **Il modello linguistico non e' mai una chat**: ogni suo ingresso e' un modulo (slide 31).

---

## 2. L'architettura

### 2.1 Le quattro cartelle

```
shared/        types.ts, constants.ts, access.ts, theme.css, components.css, i18n/
server/  :8000 Node + Express + Mongoose, avviato da ts-node. Serve anche il marketplace.
navigator/:5173 Vue 3 + Vite + Tailwind. Server di sviluppo proprio.
marketplace/   Alpine + TS compilato da tsc + Tailwind CLI. Servito dal server.
```

Tutti importano `shared/`; `shared/` non importa nessuno. E' la ragione per cui i nomi dei campi
dello scambio (`tipo`, `percorso`, `stato`, `collezione`) sono in italiano e si cambiano in una
passata sola: un rename in `types.ts` tocca modelli, navigator e marketplace insieme.

Peso, contato: server 8131 righe (di cui ~2180 sono script che nessuno importa), navigator 6344,
marketplace 7162 (di cui `state.ts` 3412 e `index.html` 2202), shared 2019.

### 2.2 Le tre catene di compilazione

| parte | come si esegue | uscita |
| --- | --- | --- |
| **server** | `ts-node src/index.ts` — **non si compila mai**, ne' in sviluppo ne' in laboratorio | niente su disco |
| **marketplace** | `tsc` + `tailwindcss` | `marketplace/dist/` |
| **navigator** | `vite` (sviluppo, con HMR) oppure `vite build` (consegna) | `navigator/dist/` |

Il server non ha build in nessun ambiente: `index.js` alla radice registra `ts-node` e fa
`require` di un `.ts`. E' per questo che `ts-node` e `typescript` stanno fra le **`dependencies`**
del server e non fra le devDependencies — con `NODE_ENV=production` verrebbero saltate e il
server non partirebbe.

**HMR** (Hot Module Replacement) e' la sostituzione del singolo modulo nell'applicazione gia' in
esecuzione, senza ricaricare la pagina e senza perdere lo stato. Ce l'ha **solo** il navigator, e
solo in sviluppo. Il server non ce l'ha: ogni modifica sotto `server/src` o `shared/` vuole
`docker compose restart node_app`.

`docker-compose up` fa: tre `npm install`, **una** build del marketplace, poi un watcher sul
marketplace, il server di sviluppo del navigator, e infine il server. Il navigator in sviluppo
**non viene mai compilato**.

⚠️ **`tsc` scrive `dist/` anche quando fallisce**: una build va letta, non guardata scorrere.

⚠️ **`base: '/navigator/'` si applica solo in `build`** (`vite.config.ts:15`). Un errore di
percorso base e' quindi strutturalmente invisibile in sviluppo e si manifesta solo in laboratorio.

### 2.3 Chi sta parlando: le sessioni

L'identita' e' un **biglietto opaco** (`randomUUID`) coniato in `POST /users/login` e `register`,
gli unici due punti in cui si verifica una password. Viaggia in `Authorization: Bearer`, mai in
un parametro. Sta in `sessionStorage`, in tutte e due le applicazioni.

| pezzo | dove | cosa fa |
| --- | --- | --- |
| `SessionModel` | `models/session.ts` | `{token, username, role, kind, expiresAt}`, con indice TTL su `expiresAt` |
| `resolveSession` | `session.ts:99` | montata su **tutto** `/api` (`index.ts:103`). Legge il biglietto e attacca `req.sessionUser`. **Non rifiuta mai** |
| `requireSession` | `session.ts:122` | **401** se `resolveSession` non ha attaccato niente |
| `sessionUser` | `session.ts:54` | lancia se usata su una rotta senza `requireSession`: l'errore e' del programmatore, non dell'utente |

**Perche' in Mongo e non in una `Map`**: il processo riparte a ogni modifica (`ts-node`), e in
memoria ogni riavvio obbligherebbe tutti a rientrare.

**Perche' non JWT**: il suo vantaggio e' verificare senza stato condiviso, che serve con piu'
server. Qui il processo e' uno, quindi non compra niente; in cambio non si revoca. E quasi ogni
rotta legge comunque il documento utente per `collezione` e `wallet`.

**Perche' non un cookie** — e non per il motivo che sembra: le porte non fanno parte del "sito"
ai fini di `SameSite`, quindi `:5173` e `:8000` ci passerebbero. La ragione e' la **durata**: un
cookie di sessione e' di tutto il browser, `sessionStorage` e' di **una scheda**.

⚠️ **`Session.kind` distingue due specie.** `sessione` e `handoff`: il secondo e' il biglietto di
passaggio verso il navigator, vale dieci minuti e `POST /users/redeem` lo consuma. Il filtro in
`resolveSession` e' `kind: {$ne: "handoff"}` e **non** `=== "sessione"`, perche' le righe scritte
prima che il campo esistesse sono sessioni vere.

**Le rotte senza sessione** sono quattro, e nessuna per dimenticanza: `/api/config`,
`/api/users/{login,register,redeem}`, `/api/health`, e `/api/museums/:qid/qrcodes` — quest'ultima
perche' si apre come pagina, quindi a chiederla e' il browser, e **a una navigazione non si puo'
attaccare un'intestazione**.

### 2.4 Una richiesta, strato per strato

`GET /api/museums/Q51252/visits` — l'elenco che la biglietteria del navigator mostra
(`routes/museums.ts:199`):

| # | dove | cosa succede |
| --- | --- | --- |
| 1 | `index.ts:103` | `resolveSession` su tutto `/api`: legge il biglietto, attacca `req.sessionUser`, non rifiuta |
| 2 | `museums.ts:199` | `requireSession` sulla rotta: **401** se non c'e' |
| 3 | `museums.ts:203` | `sessionUser(req).username` — il nome non arriva **mai** dal client |
| 4 | `museums.ts:204` | una `find` indicizzata su `ofMuseum`, con la privatezza dentro la query: `$or: [visibility != "privato", author: username]` |
| 5 | `museums.ts:211` | il possesso: **una** query su `users`, `Set` costruito in memoria — non una query per visita |
| 6 | `museums.ts:217` | la regola: guidata (`accessKey`) mai; gratuita sempre; a pagamento solo se posseduta o propria |
| 7 | | `res.json(visible)` |

⚠️ `mancanti`, `costoMancanti` e `totale` **non li calcola questa rotta**: stanno in
`server/src/pricing.ts` e li attacca `GET /visits`. Sono due domande diverse — «quanto mi costa
completarla» contro «quale posso percorrere».

⚠️ Il passo 5 fa `UserModel.find({username})` al **plurale**, che quando l'identita' era la
coppia `(username, role)` univa le collezioni di tutti gli account omonimi. Da quando l'username
e' unico (§1.3) quella `find` restituisce sempre una riga sola, quindi il codice e' corretto —
ma il plurale resta li' a raccontare un mondo che non c'e' piu'.

### 2.5 I servizi esterni, e cosa cade senza

| servizio | dove | usato per |
| --- | --- | --- |
| Wikidata | `services/wikidata.ts` | il seed, una volta per opera |
| Gemini `gemini-3.1-flash-lite` | `services/llm.ts:45` | i quattro usi della slide 31 |
| Google STT / TTS / Translation | `services/{stt,tts,translate}.ts` | voce e traduzione dei contenuti; quota **separata** da Gemini |

Senza Gemini cadono: descrizioni generate, mappatura dei comandi liberi, risposte alle domande
sull'opera, visite su misura. **Restano in piedi**: mappa, sintesi vocale, riconoscimento vocale,
traduzione, QR, teletrasporto, visite guidate, quiz e tutto il marketplace.

### 2.6 Le decisioni di scala, misurate

| decisione | numero |
| --- | --- |
| filtro `?museum=` su artworks/items/visits | accesso da **453 KB a 153 KB** |
| indici aggiunti dove esiste una query vera | `explain()`: COLLSCAN 312 documenti esaminati per 104 → IXSCAN 104 per 104 |
| N+1 tolto dal resoconto vendite | **654 ms → 67 ms**, query da 314 a 3 fisse |
| catalogo diviso in metadati e testi (§3.1-bis) | Louvre **138 KB → 36 KB** all'accesso, +6 KB per opera aperta |
| cataloghi di lingua caricati pigramente | navigator **260 KB → 114 KB** compressi |

Nota dichiarata: la cache delle traduzioni (`services/translate.ts`) e' una `Map` **senza tetto
ne' sfratto**. Scelta giusta per la dimostrazione, cresce in modo monotono finche' il processo vive.

### 2.7 Il sistema grafico condiviso

`shared/theme.css` non contiene due elenchi di colori (chiaro e scuro) da tenere allineati:
contiene **nove sorgenti** — tre neutri (`--lastra`, `--muro`, `--inchiostro`), `--struttura`
(«dove sei») e `--accento` («dove puoi andare»), piu' quattro semantici (`--valore`,
`--categoria`, `--acquisito`, `--allarme`) — e una derivazione che ne ricava tutti i token dei
due temi, con `color-mix` per i neutri e `oklch(from …)` per le tinte.

La regola con cui la sorgente e' stata scelta: **ogni ruolo e' il colore piu' saturo della sua
tinta che regge 4,6:1 come testo sul muro.** La luminosita' e' la conseguenza, non un dato
d'ingresso.

⚠️ Il blocco `oklch` sta dentro un `@supports` perche' **un valore non capito dentro una
proprieta' personalizzata non ricade sulla dichiarazione precedente**: diventa invalido, e chi lo
usa come fondo resta senza fondo.

---

## 3. Il marketplace

Tre file sorgente: `state.ts` (3412 righe, una classe con 159 metodi), `app.ts` (818),
`api.ts` (352), piu' `index.html` (2202) e `i18n.ts` (110).

### 3.1 Che cosa comporta non avere un framework

Alpine e' un **attributo**, non un componente: `x-data`, `x-show`, `x-model` sono stringhe
valutate a runtime. Non esiste un compilatore che le controlli.

⚠️ **E' la classe di difetto che questo progetto ha pagato piu' spesso.** Un rename lascio'
indietro un `$watch('vista', …)`: Alpine lanciava, il watcher non si registrava mai, e la tabella
delle vendite resto' vuota **per settimane, in silenzio**. Da li' la regola: binding banali,
logica in un metodo.

Alpine e i suoi due plugin sono serviti **localmente** da `public/vendor/`
(`alpine-3.15.0.min.js`, `alpine-collapse`, `alpine-focus`, piu' `i18next-26.3.6.min.js`): zero
richieste esterne a runtime.

### 3.2 Il singleton

```ts
export class AppState { … }            // state.ts:197
export const state = new AppState();   // state.ts:3412
```

Un solo oggetto, consegnato ad Alpine da `appData()` (`app.ts:15`), quindi ogni `x-data` della
pagina legge e scrive la stessa memoria: non esiste una seconda copia che possa dissentire.

### 3.3 Il router, scritto a mano

| funzione | riga | cosa fa |
| --- | --- | --- |
| `parsePath(percorso)` | `state.ts:363` | indirizzo → `{view, param, tipo}`, oppure **`null`** se non e' una schermata nostra |
| `knownRoute` | `389` | e' `parsePath(...) !== null`, e serve a chi intercetta i click |
| `applyRoute` | `394` | legge `location.pathname` e disegna; ripiega su `soglia` |
| `navigate(percorso, sostituendo)` | `470` | `pushState` oppure `replaceState` |
| `redirectTo(view)` | `492` | correzione di rotta: **sostituisce**, non impila |
| `interceptClicks` | `637` | un ascoltatore solo sul documento |
| `popstate` | `661` | avanti/indietro del browser |

Quattro dettagli che rendono questo codice competente e non un espediente:

- **`parsePath` torna `null`** invece di indovinare. E' quel `null` a lasciare al browser
  `/api/…`, il foglio dei QR, le immagini.
- **Il tipo `View` si ricava dall'array**: `"avvio" | (typeof marketplaceViews)[number]`. Togliere
  una schermata dall'elenco accende un errore di compilazione, invece di lasciare un indirizzo
  irraggiungibile.
- **Le correzioni di rotta usano `replaceState`.** Impilandole, "indietro" tornerebbe
  all'indirizzo appena rifiutato, che rimanda di nuovo avanti: si resta in trappola.
- **`decodeURIComponent` sta in un `try`**: un `%` isolato lancia, e si perderebbe la pagina
  invece del solo parametro.

`interceptClicks` e' quasi tutto eccezioni: tasti speciali e tasto centrale (o "apri in una nuova
scheda" smette di funzionare), `target`, `download`, i frammenti veri (`#contenuto`, `#binario` e
i 27 richiami alle icone SVG), e ogni indirizzo che non sia una schermata.

⚠️ **L'elenco delle schermate sta in `shared/constants.ts:526` perche' lo leggono in due**: il
router, per sapere cosa disegnare, e il server, per sapere che `/vetrina` non e' un file mancante.
Se divergessero non uscirebbe un errore, ma un indirizzo che funziona cliccandolo e da' 404
ricaricandolo.

### 3.4 Le sedici schermate

`marketplaceViews` (`shared/constants.ts:526`), piu' lo stato d'avvio:

| schermata | chi | cos'e' |
| --- | --- | --- |
| `soglia` | tutti | la porta. `ART AROUND.` sopra **lo sciame**: 6–13k particelle che compongono una dopo l'altra le opere in vendita, prese da `/api/config` (`soglia.json`) — **nessun qid nel codice del marketplace** |
| `accedi` · `registrati` | tutti | i due soli punti in cui si verifica una password |
| `musei` | tutti | la scelta del museo |
| `home` | per ruolo | la casa |
| `vetrina` | tutti | opere e visite **nello stesso posto**, con i filtri incollati in alto |
| `opera/<qid>` · `visita/<id>` | tutti | pagine, non finestre modali |
| `libreria` | visitatore | quel che possiede |
| `lavori` | autore | quel che ha scritto |
| `nuovo` | autore, visitatore | l'editor di una descrizione |
| `componi` | autore, visitatore | il compositore di una visita |
| `sumisura` | **solo visitatore** | la frase da cui nasce una visita |
| `vendite` | autore | adozioni e ricavo |
| `gestione` · `catalogo` | curatore | il museo e il suo catalogo |

`view` parte da `"avvio"`, che non e' nessuna schermata: finche' `start()` non ha speso il
biglietto non si sa se si e' dentro o fuori, e partire da `soglia` faceva lampeggiare la porta
d'ingresso a ogni ricaricamento.

### 3.5 I tre modi di far nascere un contenuto

| schermata | produce | vincolo |
| --- | --- | --- |
| `nuovo` | un item: soggetto, tono, durata, testo, prezzo, licenza | unicita' per **(soggetto, autore, tono)**, imposta lato client (i toni usati si disabilitano) e lato server (**409**) |
| `componi` | una visita: tappe in ordine, note logistiche ancorate, opzionali, quiz, parola chiave | il visitatore ha un tetto di **5** itinerari per museo (`MAX_VISITE_VISITATORE`, `shared/constants.ts:491`), contato sulla **creazione** e non sull'aggiornamento, o al quinto non si potrebbe piu' correggere |
| `sumisura` | **una frase**, non una visita | la inoltra al navigator via `?custom=`, perche' una visita su misura non viene mai scritta su Mongo e quindi non puo' attraversare due origini |

### 3.6 Il curatore

Due assi nel catalogo, perche' sono due domande diverse (prima erano schiacciati in uno, e
"Opere" elencava le **descrizioni** che parlano di un'opera):

| asse | valori | domanda |
| --- | --- | --- |
| **Tipo** | Tutto · Opere · Descrizioni · Visite | che cosa e' la riga |
| **Soggetto** | Tutti · Opere · Autori e stili | di che cosa parla la descrizione (`Item.kind`) |

Il soggetto compare solo dove in tabella ci sono descrizioni: un filtro che non filtra niente e'
un filtro che mente. Contato sugli Uffizi: Tutto 2248 righe, Opere 105, Descrizioni 2120, Visite 23.

**La cascata accorcia, non distrugge.** Togliere un'opera faceva sparire *tutte* le visite che la
contenevano: agli Uffizi una sola rimozione portava via ventidue percorsi, compresi quelli scritti
da altri e gia' comprati. Ora `dbActions.rimuoviTappeDalleVisite` toglie la tappa e rimette a
posto quello che a quella tappa era appeso:

| cosa | perche' |
| --- | --- |
| `optionalItems` | le facoltative sono un sottoinsieme delle tappe |
| `logistics` | le note sono **ancorate**: quelle appese a una tappa che se ne va scendono alla tappa valida precedente, e se non ce n'e' diventano note d'apertura |
| `duration` | e' la somma dei tempi delle tappe |
| `quiz` | le domande nominano un'opera per esteso: se quell'opera non si vede piu', la domanda chiede di una cosa che la classe non ha visto |

Una visita che resterebbe **senza tappe** sparisce comunque. La scelta e' del curatore:
`DELETE /api/artworks/:qid?visite=accorcia|elimina`, e `GET .../impact` dice in anticipo quante
visite si accorcerebbero e quante resterebbero vuote. ⚠️ `?visite=elimina` e' del **solo
curatore**: butta via percorsi altrui per una tappa su cento. L'autore accorcia e basta.

### 3.7 L'economia

- **Il gratuito non si compra.** La regola di lettura era scritta **cinque volte** e le copie non
  erano d'accordo; da li' veniva il difetto per cui il marketplace chiedeva di sbloccare a **€ 0,00**.
  Ora sta una volta sola in `shared/access.ts`.
- **Comprare una visita compra le sue tappe**, in **una** transazione. Prima erano due acquisti
  distinti e il prodotto non lo diceva: una visita da € 2,50 con dentro € 14 di descrizioni si
  comprava e poi chiedeva altri 14 euro. Il conto e' la somma dei prezzi veri, quindi ogni autore
  incassa la sua adozione. **Non si compra a rate**: credito insufficiente vuol dire acquisto non
  fatto — verificato con € 5 su € 16,50, rifiuto e collezione intatta.
- **«Completare» non e' «comprare»**: la visita ce l'hai gia', si comprano le descrizioni che le
  mancano. Le due strade passano per la stessa richiesta perche' quella prende **sempre e soltanto
  quel che non hai**.
- Il conto lo fa il server (`pricing.ts`), ed e' **la stessa funzione** che mostra il totale e che
  addebita: quando lo calcolava anche il client, la cifra sul bottone e quella addebitata erano
  due conti distinti che nessuno confrontava.

### 3.8 Le lingue

Tredici (`shared/constants.ts:214`): italiano, inglese, francese, spagnolo, tedesco, portoghese,
cinese, giapponese, coreano, russo, olandese, polacco, turco. Ognuna porta tre codici — uno per la
traduzione, uno per la sintesi, uno per il riconoscimento — perche' non coincidono (il cinese e'
`zh-CN` / `cmn-CN` / `cmn-Hans-CN`).

I cataloghi stanno in `shared/i18n/` e sono **dodici**: l'italiano e' la lingua sorgente
(`SOURCE_LANG`), e le chiavi *sono* le frasi italiane, quindi non gli serve un catalogo.

Il marketplace usa `i18next` servito da `public/vendor/` e scarica **un** catalogo da
`/i18n/<codice>.json` (`i18n.ts:84`) — il server monta `shared/i18n` su `/i18n`
(`index.ts:122`).

⚠️ La lingua valeva solo dentro il caricamento in cui la si sceglieva: **ogni ricaricamento del
marketplace tornava all'italiano**. Ora `lingua` parte dall'italiano e la vera si assegna dopo
aver aspettato il catalogo; e' l'assegnazione a ridisegnare.

### 3.9 La forma della pagina

- **Nessuna intestazione in alto.** A sinistra un **binario** (`bg-structure`) col marchio, il
  selettore del museo, 3–4 destinazioni con `aria-current`, il portafoglio, l'utente e il tema.
  Sotto `lg` diventa una barra in basso piu' una striscia sottile in alto.
- ⚠️ Sotto `lg` le voci sono colonne affiancate: un'etichetta che va a capo alzerebbe la sua
  icona. Sono ancorate in cima (`justify-start`) — a 390 px due voci su quattro stavano 8,4 px
  piu' in alto — e in tredici lingue non si puo' sapere quale parola andra' a capo.
- **Due salti d'accessibilita'** (`#contenuto`, `#binario`), che compaiono **solo dove c'e' un
  binario da scavalcare**: su soglia, accesso e registrazione puntavano dentro un sottoalbero
  `display:none`, si prendevano il primo Tab della pagina e non portavano da nessuna parte.
- **Restano due soli sovrapposti**: la conferma e il messaggio effimero. Tutto cio' che era una
  finestra modale e' diventato una pagina.
- **La barra dei filtri e' incollata in alto.** Segnalato come «la ricerca fa una cosa strana
  mentre scrivo»: filtrando il documento si accorcia, il browser riaggancia lo scorrimento in
  fondo, e **il campo in cui si sta scrivendo esce dallo schermo** (misurato: scorrimento
  1200 → 139, il campo a −13 px).

---

## 4. Il navigator

6344 righe. Tre file pesano meta' del totale: `Visita.vue` (864), `Stage.vue` (706),
`GuidedGate.vue` (691).

### 4.1 Lo scheletro

Nessun router, nessuna libreria di stato: `state.ts` (295 righe) espone dei `ref` globali —
`visit`, `museum`, `map`, `matchedContent`, `museumArtworks`, `language`, `stageView` — e delle
funzioni che li muovono (`setVisit`, `clearVisit`, `setCustomVisit`, `loadMuseum`, `loadMap`,
`buildStops`). `api.ts` (368) e' l'unico posto che parla col server.

### 4.2 L'ingresso: cinque diramazioni

`App.vue` legge prima `public/config.json` — il file di configurazione delle slide 25/33:

```json
{ "museumQid": "Q6373", "museumTitle": "", "apiBase": "" }
```

`apiBase` vuoto vuol dire stessa origine; in sviluppo ripiega sull'host della pagina, porta 8000.
Questo file ha eliminato l'ultimo `Q6373` cablato e ogni `localhost` letterale.

Poi si dirama in cinque: **studente** (`role=studente&guidedSession=`), **docente**
(`role=docente&guidedVisit=`), **collegamento diretto** (`?visit=`), **visita su misura**
(`?custom=<frase>`), **ingresso normale** (biglietteria).

⚠️ **Solo `handoff` viene tolto dall'indirizzo** (`App.vue:97-106`, `replaceState`): la credenziale
non resta nella cronologia. Gli altri parametri sopravvivono, quindi `?visit=X` regge un
ricaricamento — ma `?custom=` fa **ricomporre la visita da capo**, cioe' una chiamata al
pianificatore piu' una per ogni opera con un `twist`.

⚠️ **Senza biglietto non c'e' sessione, quindi oggi il navigator non si apre da solo.** Viene dal
giro d'irrobustimento delle sessioni, non dalle slide, e sta scomodo accanto alla slide 34
(«il curatore puo' fare una versione specifica del navigator per il suo museo»). E' una questione
aperta, non un difetto.

### 4.3 La biglietteria

Un **elenco** di visite (nome, `N tappe · N min · livello`), con livello e durata **degradati a
filtri** che non possono piu' produrre un vicolo cieco — prima erano un selettore a incrocio
livello×durata, e certe combinazioni non davano niente. L'elenco conosce il possesso: le guidate
non compaiono mai, le a pagamento solo se comprate. Sotto una riga, il blocco della visita su
misura con delle frasi d'esempio.

### 4.4 L'esecuzione della visita

- **Barra di avanzamento**: `Esci`, nome, **`Tappa 3 di 13`** (contando solo le tappe che
  `Prossimo` raggiungera' davvero) e una linea di 2 px. Ogni cambio si annuncia.
- **`Stage`**: `Mappa` ed `Elenco` sono **pari grado**, con un controllo segmentato, e la scelta
  si ricorda.
- **`Scheda`**: un pannello **permanente** — mai un dialogo, mai congedabile. Una colonna di
  `26rem` accanto alla pianta da `lg`, una fascia di `55dvh` sotto sul telefono. Dall'alto in
  basso, nell'ordine in cui si usa: lingua · opera · la barra (voce, ascolto, avanti/indietro) ·
  Chiedi / Orientati. Lingua e barra stanno ai due estremi e non si muovono mai; opera e comandi
  si dividono il resto in `3:2`, che diventa `2:3` mentre una risposta e' aperta.
- **`Pannello`**: il vocabolario controllato come bottoni, diviso **Chiedi** (domande sull'opera →
  modello) e **Orientati** (domande sull'edificio → grafo delle sale). **Un solo montaggio**, in
  fondo alla scheda: chiedere e' un comando come *Prossimo*, non una schermata da aprire — ed e'
  quel che soddisfa la slide 28.
- **Le note logistiche** sono un **passo di transizione**: premendo `Prossimo`, se l'autore ha
  lasciato una nota per quel passaggio, la si vede prima della tappa successiva.
- ⚠️ **La tappa si individua per id dell'ITEM, non dell'opera.** Con due item sulla stessa opera
  la visita rimbalzava fra i due e non avanzava mai — e le slide chiedono esplicitamente piu' item
  per oggetto. Sulla pianta i due condividono un unico disco numerato invece di sovrascriversi.

### 4.5 La pianta

I dischi numerati si disegnano sull'SVG con `getBBox`, rifatto quando la mappa torna visibile.
Ogni nodo e' un bersaglio di tastiera con `aria-label` **e** un `<title>` SVG. Anche i servizi
sono bersagli: ogni `[data-poi]` e' un bottone — un'opera si apre, un servizio risponde *come ci
si arriva* — quindi un museo la cui pianta ha un guardaroba ottiene un guardaroba raggiungibile
senza una riga di codice.

**I piani non sono una dimensione nuova**: il vano scale e' una sala su ciascun piano, le due sono
unite da un `data-edge` come due sale confinanti, e la ricerca del cammino sale e scende senza
sapere che i piani esistono. Non c'e' nessun ramo "cambio piano".

⚠️ I piani stanno nello **stesso** disegno, impilati, e il navigator ne **inquadra** uno spostando
il `viewBox` — non nascondendo gli altri, perche' un sottoalbero nascosto non ha piu' un
`getBBox()` e i numeri delle tappe si disegnano proprio con quello.

⚠️ **A che piano si e' lo dice il selettore, non un sensore**, ed e' una risposta e non una
rinuncia: il GPS da' due coordinate, non tre. Il piano e' **dichiarato**, come la posizione col QR
e col teletrasporto.

### 4.6 Dove sono io

Quattro strade, una sola stima (`localization.ts`): **QR**, **codice digitato** (la scheda si
disabilita fuori da un contesto sicuro, dicendo perche'), **`Trovami`**, **teletrasporto**.

Il costo di ogni opera e' una sola equazione, senza un ramo per piattaforma
(`localization.ts:255`):

```
costo = (metri / σ_d)²  [+ (scarto angolare / σ_θ)²]
```

`σ_d` e' l'accuratezza che **il dispositivo stesso dichiara**; `σ_θ` e' 30 gradi
(`SIGMA_ANGOLO`). Dove non c'e' bussola — ogni desktop, che non ha magnetometro — il termine
angolare **non e' nella somma**: l'orientamento non viene sostituito da un valore finto, e'
*assente*, le probabilita' si appiattiscono e compare il selettore. La formula gia' dice che cosa
significa non saperlo.

Misurato sulle mappe vere: atterrando su un nodo, `Trovami` sceglie quella stessa opera con
abbastanza sicurezza da aprirla direttamente in **39/39** casi, caso peggiore 98%. A 2 m da
un'opera con la bussola addosso, 93%. A meta' strada fra due, nessun vincitore. Una bussola con
una posizione a 300 m resta al 15%: **una bussola da sola non fabbrica sicurezza.**

Le miniature del selettore sono **sfocate** (`blur-[3px]`), e la ragione e' di prodotto: una
miniatura nitida ti mostra l'opera, una sfocata ti aiuta soltanto a dire davanti a quale sei.

**Il teletrasporto sposta la posizione e non fa altro**: non apre nessuna scheda e non fa avanzare
la visita, perche' dichiarare dove si sta e scegliere cosa leggere sono due atti diversi. Si salta
**toccando la pianta**: un bottone **arma** la modalita' e chiude il pannello (che coprirebbe la
cosa da toccare), una striscia la dichiara finche' il tocco non arriva o non si annulla. E' a
colpo singolo e si annuncia: una modalita' invisibile lascerebbe che un tocco distratto sposti in
silenzio la posizione da cui tutto il resto ragiona.

⚠️ **Perche' e' stato scritto:** un punto libero e' l'**unico** modo di raggiungere il ramo
ambiguo al chiuso. Da un nodo `Trovami` vince sempre (39/39), quindi il selettore — meta' del
modulo della slide 33 — non si sarebbe mai potuto mostrare.

⚠️ **La posizione e la tappa aperta sono due nozioni separate**: aprire una scheda non sposta mai
la posizione, e solo un atto dichiarato la riancora.

### 4.7 La voce

Catena: registrazione → `POST /speech` → Google STT → `mapRequest` (`llm.ts:304`) → **un id del
vocabolario controllato** → il gestore. `options` in `shared/constants.ts` e' la sorgente unica
dei bottoni **e** della mappatura vocale, quindi le due liste non possono divergere — ed e' cosi'
che si soddisfa «bottoni equivalenti ai comandi vocali».

`id` ed `label` sono **disaccoppiati**: l'`id` e' il token canonico su cui `mapRequest` mappa e su
cui i gestori confrontano, la `label` e' testo libero — per questo le etichette possono essere
italiano corretto, accenti e apostrofi compresi. `surface` dice dove sta il bottone equivalente:
`chiedi`, `orientati`, `scheda`.

⚠️ **Tre esiti distinti, e devono restarlo.** Comando riconosciuto; niente da riconoscere (la
frase va al modello come domanda libera); servizio giu' (**503**). I primi due chiedono all'utente
cose opposte — riprovare, oppure smettere di riprovare. Prima il `catch` di `mapRequest` non aveva
`return`: tornava `undefined`, che `JSON.stringify` toglie dall'oggetto, e **un guasto arrivava al
client con la stessa forma di «ho capito, e non era niente»**.

⚠️ Il fallimento si annunciava alla regione viva ma non si scriveva: chi guardava lo schermo
vedeva solo l'etichetta tornare a «Parla». Ora compare anche scritto, **senza** `role="alert"`,
perche' due regioni vive leggerebbero la stessa frase due volte.

### 4.8 La visita guidata, lato client

`guided.ts` (290 righe) piu' `GuidedGate.vue` (691). Polling ogni **1500 ms**
(`PASSO_INTERROGAZIONE_MS`), che deve restare sotto la soglia di presenza del server.

Docente: `startAsTeacher` → sala d'attesa → `teacherStart` → `teacherGoToStep` (spinge il passo a
tutti) → `teacherStartQuiz(durata)` → `teacherEndQuiz` → `teacherEnd`.
Studente: `attachAsStudent` → attesa → segue → `studentSubmitQuiz` (una volta sola) → voto.

Il punteggio arriva dal server: `guidedQuizPunteggio` porta il commento «qui non si corregge
niente».

### 4.9 Lingua e accessibilita'

`i18n.ts` usa `import.meta.glob` **senza `eager`**: Vite spezza ogni catalogo in un pezzo suo e
`setLocale` carica solo quello chiesto. Prima erano murati dentro il programma tutti e dodici —
437 KB, **piu' della meta' del navigator compilato**, di cui un visitatore ne legge uno.

| | prima | dopo |
| --- | --- | --- |
| programma | 745 KB / **260 KB compressi** | 327 KB / **114 KB compressi** |
| un visitatore in russo | 260 KB | 114 + 14 = **128 KB** |
| un visitatore in italiano | 260 KB | **114 KB**, e nessuna richiesta di catalogo |

⚠️ **Le chiavi del glob restano note anche senza `eager`**: il controllo che segnala all'avvio una
lingua offerta senza catalogo funziona ancora. Se fosse servita una richiesta di rete per
accorgersene, il controllo sarebbe morto.

⚠️ **La regola generale che ne e' uscita**: `t` non e' reattivo di per se', lo diventa dentro un
legame o un `computed`. Chi lo chiama una volta e ne memorizza la stringa **congela la lingua di
quell'istante**. Quindi: *un messaggio che vive in un `ref` ci sta come chiave, non come frase
gia' tradotta.*

---

## 5. Il server

8131 righe, di cui ~2180 sono script che nessuno importa.

### 5.1 L'avvio, e l'ordine dei montaggi

`index.ts`, nell'ordine (l'ordine e' la cosa da sapere):

```
cors, compression, express.json
app.use("/api", resolveSession)                     — legge il biglietto, non rifiuta
express.static  public/images  ·  public  ·  marketplace/public
              /dist → marketplace/dist  ·  /navigator → navigator/dist  ·  /i18n → shared/i18n
app.use("/api/<risorsa>", requireSession, rotte)    — otto risorse su dieci
app.use("/api/museums", museumRoutes)               — SENZA guardia al montaggio
app.use("/api/users",  userRoutes)                  — SENZA guardia al montaggio
app.get("/api/health") · app.get("/api/config")
app.use(...)  IL GUSCIO, in fondo a tutto           — solo i nomi di marketplaceViews
app.listen(PORT)                                    — process.env.PORT, ripiego 8000
```

`museums` e `users` non hanno la guardia al montaggio perche' contengono le rotte che devono
restare aperte (`qrcodes`, `login`, `register`, `redeem`): la mettono per rotta.

⚠️ **`ts-node` non carica i `.d.ts` ambientali da `include` del tsconfig.** La riga
`/// <reference>` in `src/env.ts` **non e' un commento**: toglierla lascia `tsc` verde e fa
smettere di partire `npm run start`.

### 5.2 I modelli e gli indici

Sei modelli: `artwork`, `item`, `museum`, `session`, `user`, `visit`. Gli indici corrispondono a
forme di query che esistono davvero nel codice:

| modello | indici |
| --- | --- |
| `item` | `@id` (unico), `about`, `ofMuseum`, `author` |
| `visit` | `@id` (unico), `ofMuseum`, `author`, `itemListElement` |
| `artwork` | `qid`, `ofMuseum` |
| `user` | **`username` unico**, `collezione` |
| `session` | `expiresAt` con `expireAfterSeconds: 0` (TTL) |

### 5.3 Le rotte, come sono davvero

Verificate leggendo `server/src/routes/`.

**`/api/artworks`** — `GET /` · `GET /:qid/items` (i testi delle descrizioni di un'opera) ·
`GET /:qid/preview` (Match per un'opera fuori dalla visita corrente; ripiega livello+durata →
livello → qualunque, e **genera e salva** un item se non ne esiste nessuno) · `GET /:qid/impact` ·
`DELETE /:qid` · `POST /`

**`/api/items`** — `GET /` (la primitiva completa, **oggi non la chiama nessuno**: tenuta perche'
una seconda strada non dovrebbe togliere la prima) · `GET /metadata` (gli stessi item **senza
`text`**, `about` come id nudo) · `GET /author/:authorName` · `GET /:id/text` · `POST /image` ·
`POST /` · `GET /:id/impact` · `DELETE /:id`

**`/api/visits`** — `GET /` (con i campi calcolati di `pricing.ts`) · `GET /:id` ·
`GET /:id/items` · `POST /custom` · `POST /` · `DELETE /:id`

**`/api/museums`** — `GET /` · `GET /:qid/config` · `/artworks` · `/topics` · `/visits` ·
`/qrcodes` · `/overview` · `/items` · `DELETE /:qid/contents`

**`/api/users`** — `POST /register` · `/login` · `/logout` · `/handoff` · `/redeem` · `/buy` ·
`GET /me` · `GET /sales`

**`/api/guided-sessions`** — `POST /` · `/join` · `/:id/leave` · `/:id/ask` · `/:id/start` ·
`/:id/step` · `/:id/quiz/{start,answer,end}` · `/:id/end` · `GET /:id` · `/:id/state` · `/:id/items`

**Altre** — `POST /api/llm/newInfo` · `POST /api/speech` e `/tts` · `POST /api/translate` ·
`POST /api/wayfinding` · `GET /api/health` · `GET /api/config`

⚠️ `POST /users/buy` **non porta il nome nel percorso**. Prima era `/users/:username/buy`, e
riscrivere quel nome spendeva il portafoglio di un altro.

Il **catalogo in due meta'** e' la decisione di forma piu' importante di questo elenco: il
marketplace scaricava ogni descrizione col suo testo, e il testo e' il **74%** del peso di una
risposta che serve a una schermata sola. Ora `/items/metadata` all'ingresso, `/artworks/:qid/items`
quando qualcuno apre un'opera.

⚠️ **Testo assente e testo negato sono due stati diversi.** `withoutText` manda `text: ""` con
`locked: true` a chi non ha comprato; `/items/metadata` **omette** la proprieta'. Confonderli
farebbe sembrare sotto chiave ogni descrizione gratuita. Il client distingue con `'text' in item`.

### 5.4 La regola di lettura

`shared/access.ts` — `isReadable(contenuto, utente, posseduto)`: si legge se e' gratuito, se lo si
e' scritto, o se lo si e' comprato. Era scritta **cinque volte** (`server/access.ts`, il controllo
delle guidate in `routes/visits.ts`, e nel marketplace `availableNow()`, `allowedInGuided()` — la
stessa cosa con gli operandi scambiati — piu' una copia in linea dentro `editorLibrary()`).

Il **possesso** resta di chi chiama: un `Set` per richiesta sul server (`purchasedBy`,
`server/access.ts:25`), un array gia' in memoria sul client. Qui c'e' la regola, li' la ricerca.

E' **autorizzazione e non autenticazione**: da' per buono il nome che riceve. Di chi sia davvero
lo stabilisce la sessione, prima.

### 5.5 I servizi

| file | cosa c'e' da sapere |
| --- | --- |
| `wikidata.ts` | `fetchArtwork`, `fetchMuseum`. ⚠️ **Un'opera senza immagine `P18` viene saltata**: il qid si scrive nel config, non da' nessun errore, e semplicemente non compare mai nel database |
| `llm.ts` | `createDescription`, `createTwistedDescription`, `createSubjectDescription`, `planVisit`, `additionalDescription`, `directionsFromRoute`, `mapRequest`. Modello unico `gemini-3.1-flash-lite` |
| `svgGraph.ts` | `getMuseumGraph`, `parseSvg`, `flowOrder`, `sortByFlow`. Il **contratto della pianta** sta nella sua intestazione |
| `wayfinding.ts` | il cammino fra sale; risposta semplice (nome della sala) o verbalizzata dal modello |
| `stt.ts` `tts.ts` `translate.ts` | Google Cloud. La cache delle traduzioni e' una `Map` senza tetto, dichiarata |
| `imageDownloader.ts` `retry.ts` | le copie locali delle immagini; l'immagine si scarica **subito dopo la sua opera** e non in una passata finale, cosi' un'interruzione lascia opere complete invece di opere senza faccia |

### 5.6 La pianta come sorgente spaziale

`svgGraph.ts` legge un SVG annotato. Il curatore annota la pianta che disegna comunque:

| annotazione | su cosa | significato |
| --- | --- | --- |
| `data-room="Nome"` | circle/rect/polygon | **area** di una sala. La sala di un nodo e' l'area che lo **contiene** (punto-in-regione, ordine del documento, vince la prima) — quindi i muri contano, non la vicinanza |
| `data-qid="Qxxx"` | qualunque forma | nodo opera; il centro e' la posizione. `data-label` e' il titolo |
| `data-poi="exit\|emergency_exit\|toilet\|bar\|shop\|elevator\|stairs\|entrance"` | | servizio |
| `data-obstacle="steps\|door\|chairs\|object"` + `data-desc` | | ostacolo |
| `<line data-edge>` | | collega le due sale che contengono i suoi estremi |
| `data-flow="3"` | una sala | **l'ordine in cui il curatore vuole che il museo si percorra** |
| `<g data-floor="1" data-floor-label="Primo piano">` | | tutto cio' che sta su quel piano |
| `data-width-m` | la radice `<svg>` | quanti metri veri copre la larghezza del viewBox. Letto dal **navigator**, non dal parser |

La connettivita' e' **solo dichiarata**: nessuna adiacenza si deduce dalla geometria, quindi ogni
spazio percorribile — corridoi compresi — dev'essere una `data-room`.

⚠️ **Il `data-qid` lo scrive il curatore, e non c'e' niente che lo generi.** `locationId` nel
database e' l'`id` dell'elemento SVG, trovato **cercando per qid** (`manager.ts:54`). Prima era
`art-<posizione nell'elenco del config>`, cioe' due elenchi da tenere allineati a mano: inserirne
uno in mezzo spostava ogni opera successiva sul nodo sbagliato, in silenzio.

⚠️ **Un qid non puo' comparire due volte sulla pianta**: si prende il primo nodo trovato, quindi un
doppione sposta l'opera nella sala sbagliata senza dire niente. E' successo davvero.

⚠️ **`data-flow` dichiara un CAMMINO, e crescere non basta.** Che i numeri salgano dice solo che
nessuna sala si visita due volte; se la 25 sta dall'altra parte dell'edificio rispetto alla 24 il
percorso e' comunque sbagliato. Il controllo giusto e' sulla **distanza nel grafo** fra due numeri
consecutivi: una sala (porta in comune) o due (si passa dal corridoio). Alla prima stesura delle
piante nuove i salti erano 2 sul British, 2 sugli Uffizi, 5 al Louvre e 5 al Metropolitan; ora
sono zero su tutte e quattro.

**Non si calcola l'ordine, si dichiara.** La tentazione era dedurlo con una BFS dall'ingresso o un
giro goloso sulle distanze. Ma il giro che un museo consiglia non e' una proprieta' geometrica —
che Botticelli venga prima di Leonardo e' una ragione che sulla pianta non si vede — e il curatore
quel giro lo conosce gia': e' un numero per sala.

I quattro musei, e cosa mette alla prova ciascuno:

| museo | qid | sale / nodi / POI / archi / ostacoli | mette alla prova |
| --- | --- | --- | --- |
| British Museum | Q6373 | 22 / 20 / 12 / 30 / 5, due piani | l'area **dentro** un'altra: la Reading Room e' un `circle` dichiarato prima del Great Court che la circonda, e vince perche' viene prima |
| Metropolitan | Q160236 | 24 / 50 / 12 / 35 / 5, due piani | il museo **senza corridoi**: ogni `data-edge` sta su un muro in comune |
| Museo del Louvre | Q19675 | 27 / 25 / 15 / 34 / 6, tre piani | il perimetro che **cambia da un piano all'altro** |
| Galleria degli Uffizi | Q51252 | 60 / 129 / 19 / 60 / 7, tre piani | il **senso unico**: due scale distinte, atrio e bookshop non collegati fra loro |

### 5.7 La configurazione come ingresso

`MuseumConfig` (`data/museumConfigs.ts`): `qid`, `name`, `location`, `created`, `mapPath`,
`imagePath?`, `visitImages?`, `logistics?`, `activeArtworks[]`.

- **`name` batte Wikidata**, che si interroga solo per i campi lasciati in bianco: per gli Uffizi
  l'etichetta italiana e' «Palazzo degli Uffizi», che e' l'edificio, non la galleria. Il nome e'
  una scelta di curatela.
- **`logistics` appartiene al MUSEO**, non alla singola visita — l'esempio della slide 21 e'
  «l'entrata e' da via Garibaldi 2, il biglietto costa 15 €, c'e' un guardaroba gratuito». Il
  navigator le legge dalla configurazione, quindi valgono per **ogni** visita di quel museo.
- **`mapPath` e `imagePath` sono dichiarati, non dedotti** dal nome del file, e valgono a un tempo
  come indirizzo HTTP e come percorso su disco. E' per questo che spostare tutto in
  `allestimento/` e' costato **una riga**: nessuno dei trenta lettori di `mapPath` aveva `/maps/`
  scritto dentro.
- ⚠️ **`mapPath` si copia nel documento al seed e poi non si rilegge piu'**: spostare i file non
  basta, il database continua a chiedere la pianta all'indirizzo vecchio. Riallinea
  `testers.ts musei`.
- **`visitImages` e' tagliato per TONO** e non per visita, perche' le visite di catalogo di un
  museo contengono le stesse opere: cambiano tono e durata, e delle due e' il tono a cambiare a chi
  la visita parla.

### 5.8 Gli script

`seed.ts` (525) — un piccolo CLI sopra i file di configurazione, **un museo alla volta**:

```
seed.ts                 elenca i musei configurati
seed.ts Q51252          semina quel museo
seed.ts Q51252 --force  rigenera anche gli item gia' scritti
seed.ts tutti           tutti
seed.ts speciali        le visite dimostrative e gli account
```

Due proprieta' decidono la forma del file, e le ha imposte il quarto museo:

- **Additivo.** Il vecchio `seed()` apriva con `deleteMany({})` su opere, item *e* visite. Con gli
  Uffizi nella cartella, aggiungere un museo avrebbe voluto dire rigenerare tutto e portarsi via
  ogni acquisto e ogni visita composta a mano che puntasse ai vecchi id.
- **Ripartibile.** `itemsPerArtwork = educationalLevels.length * secPerArt.length` = **4 × 5 = 20**
  (`seed.ts:115`). Per la Galleria degli Uffizi, 129 opere × 20 = **2580 chiamate al modello**.
  Qualcosa interrompe un lavoro di quelle dimensioni: un'opera gia' salvata non si riscarica, un
  item gia' scritto non si rigenera. E' per questo che gli `insert*` di `dbActions` sono **upsert**
  e non `create()`.

⚠️ **`state.md` §2.1 dice ancora `secPerArt = [15, 60]` e parla di 832 chiamate.** Sono due durate
e otto item per opera: il codice ne ha cinque e venti.

`seed.ts speciali` aggiunge, su **ogni** museo configurato, la visita guidata più gli account
`docente1` e `studente1..3`. ⚠️ **La parola chiave porta il qid** (`Fenice rossa Q6373`): `POST
/visits` rifiuta con 409 due guidate che condividano la parola, e le sale aperte stanno in una
mappa indicizzata proprio su quella — con una parola sola per quattro musei l'ultima sala aperta
si prenderebbe gli studenti delle altre. Il qid e' l'unico campo unico **per costruzione** fra
quelli che il curatore scrive.

`testers.ts` (1021) — quindici comandi, che **riallineano invece di rigenerare** (rifare il seed
costerebbe ore di chiamate al modello per rifare testi che vanno benissimo):

```
toni  nomi  logistica  generi  buchi  licenze  account  mappe
musei  griglia  private  autore  prezzi  percorso  miniature
```

⚠️ **`mappe` non tocca il database e non gliene serve**, quindi si esegue su una copia appena
scaricata, prima del seed — cioe' quando aggiungere un museo costa ancora zero. Guarda sette cose,
e ognuna e' un modo di sbagliare che non da' errore: nodo fuori da ogni sala, ostacolo fuori da
ogni sala, ingresso mancante, sala irraggiungibile, `data-flow` doppio, sala con opere ma senza
`data-flow`, e il salto fra due tappe consecutive.

⚠️ **`autore` va eseguito prima di qualunque seed successivo**: il seed riconosce quel che ha gia'
scritto cercando l'autore, e con il nome vecchio nel database non trova niente e **rigenera tutto
da capo**.

### 5.9 Le visite guidate, lato server

`routes/guidedSessions.ts` (527) tiene una `Map<sessionId, Sessione>` piu' un indice
`accessKey → id`. **Nessuna scrittura su Mongo**: quando il docente chiude, o il server riparte,
non resta traccia. Trasporto: polling REST, niente WebSocket.

- **Presenza per battito.** Il poll dello studente su `GET /:id/state` **e'** il segnale «ci sono»
  (`lastSeen`, `PRESENZA_TTL_MS = 5000`, `guidedSessions.ts:97`). Il docente vede solo chi e' connesso adesso, senza traffico
  aggiuntivo. Trenta studenti fanno circa 20 richieste al secondo.
- **Tre risposte distinte all'ingresso**: 404 se la parola non esiste, 409 se la visita esiste ma
  nessuna sala e' aperta, 409 se si arriva dal museo sbagliato.
- **Le domande sono una coda di consegna, non un registro**: `POST /:id/ask` accoda, il poll del
  docente la **svuota**. La cronologia la accumula il client del docente.
- **La correzione del quiz e' del server.** Gli studenti ricevono le domande **senza `correct`**;
  le risposte mancanti contano sbagliate; il reinvio e' bloccato.
- ⚠️ **La chiusura indugia 30 secondi in stato `terminata`.** Prima `POST /:id/end` cancellava la
  sessione all'istante, quindi una chiusura **pianificata** arrivava a ogni studente come un 410,
  cioe' «la sessione e' svanita».

### 5.10 Il modello linguistico

I quattro usi della slide 31:

1. **Creare item** per oggetti non descritti o per un tono/durata mancante — `createDescription` →
   `createTwistedDescription`. Il budget di parole si ricava dalla durata (~100 parole al minuto).
2. **Comandi vocali a vocabolario libero** mappati sull'insieme controllato — `mapRequest`.
3. **Traduzione in tempo reale** — Google Translation per i contenuti del database; le risposte del
   modello sono invece **generate direttamente** nella lingua di destinazione.
4. **Visita su misura da vincoli** — `POST /visits/custom`.

**La divisione pianificatore/risolutore**, che e' la cosa da saper dire:

1. si carica il catalogo del museo (`qid`, `name`, `author`, `style`);
2. `planVisit` risponde con **JSON forzato da un `responseSchema`**:
   `{name, artworks:[{qid, tone, durationSec, twist}]}`, dove `tone` e `durationSec` sono **enum**
   di `educationalLevels` e `secPerArt` — quindi il risolutore sa sempre gestirli;
3. l'ordine **non si chiede al modello**: `sortByFlow` riordina la risposta secondo il `data-flow`
   della pianta. Metterlo nel prompt sarebbe sperare che obbedisca;
4. per ogni opera, `resolveOrGenerateItem`: il `twist` **e' anche l'interruttore di riuso** — vuoto
   ⇒ si riusa un item del database (livello+durata → livello → qualunque), non vuoto ⇒ si genera
   sempre;
5. si risponde `{visit, content}` con `level: "Su misura"`, `author: "AI"`. **Niente viene scritto
   su Mongo**, quindi una visita su misura non puo' finire nel marketplace o nel selettore.

Il codice deterministico possiede la **correttezza**, il modello l'**interpretazione**. Prezzo da
sapere: se il modello avesse scelto un ordine narrativo, il riordino spaziale lo cancella.

⚠️ Il ciclo del passo 4 e' **sequenziale** (`await` dentro un `for`) e limitato a
`MAX_CUSTOM_ARTWORKS = 30`: il tetto e' sul numero, non sul tempo. Caso migliore una chiamata
sola, caso peggiore 31 in fila.

**Il quiz e' generato, non scritto** (`data/quiz.ts`): dalle opere della visita stessa, in tre
forme — autore di X, stile di X, quale opera e' di X — ognuna con tre distrattori presi dallo
stesso museo, `Unknown` escluso da risposte e distrattori. Una forma che non trova tre distrattori
distinti viene **saltata invece che imbottita**. Nessuna domanda, opera o museo compare nel codice,
quindi il quiz sopravvive a un cambio di museo.

---

## 6. I componenti condivisi

2019 righe in tutto, e sono il centro: qui vive ogni cosa su cui client e server devono restare
d'accordo.

### 6.1 `types.ts` — il modello dei dati

Segue **Schema.org**: un `Item` e' un `CreativeWork`, una `Visit` una `ItemList`. I campi con la
chiocciola vengono da li' e non si rinominano: sono il contratto con cui i dati sono serializzati.

I campi non ovvi:

| campo | cos'e' |
| --- | --- |
| `imageUri` / `imagePath` | l'indirizzo remoto e la copia scaricata |
| `locationId` | il nodo sulla pianta SVG: e' cio' che lega un'opera al suo posto |
| `Item["@id"]` | opaco, perche' lo referenziano visite e collezioni |
| `timeRequired` | secondi nudi **in stringa** (`"15"`) |
| `Visit.duration` | il **totale**, non il per-opera |
| `accessKey` | marca una visita come guidata: gratuita e fuori dal catalogo |
| `Item.kind` | di che cosa parla. `"opera"` ⇒ c'e' `about` e non c'e' `subject`; ogni altro valore ⇒ `subject` e `imagePath`, e `about` assente |

Tre campi hanno un perche' che non sta in una riga:

- **`Visit.visibility` si SCRIVE alla creazione** e non si ricava dal ruolo a ogni lettura. Le
  visite di un visitatore sono private perche' compone un itinerario per se', mentre vendere e' il
  mestiere dell'autore. Ricavarla dal ruolo vorrebbe dire che chi diventasse autore domani si
  ritroverebbe pubblicati gli itinerari scritti per se'.
- **`Museum.opere` e `Museum.visite` li conta il server**, perche' il client scarica il catalogo di
  UN museo alla volta e quindi non potrebbe piu' contare quelli che non ha scaricato.
- **`mancanti`, `costoMancanti`, `totale` non stanno su Mongo**: sono il conto per chi sta
  chiedendo, cambiano da persona a persona, e li allega `GET /visits`.

**`Match.anchor`** esiste perche' un contenuto su uno stile non ha un posto sulla pianta, ma chi lo
ascolta ce l'ha: e' la prossima opera del percorso.

**Le guardie** (`isVisit`, `isItem`, `isAboutArtwork`, `isArtwork`) distinguono per un **campo
obbligatorio** di ciascuna meta' e non per `@type`, che non fa parte di questi tipi — esiste solo
come valore di scorta dello schema Mongoose, quindi un documento inserito per altra via ne sarebbe
privo. ⚠️ Il campo obbligatorio dell'item e' **`kind`**, non `about`: cercare `about` farebbe
sparire dagli elenchi ogni contenuto che non parla di un'opera.

### 6.2 `constants.ts` — i vocabolari

| costante | valore / nota |
| --- | --- |
| `educationalLevels` | i **quattro toni** della slide 22: Infantile, Semplice, Medio, Avanzato. Ricavati da `Object.keys(educationalLevelHints)`, quindi etichetta e spiegazione non possono divergere |
| `educationalLevelHints` | una riga per tono, mostrata a chi sceglie: la scelta si fa sulla conseguenza, non sull'etichetta |
| `secPerArt` | **`[15, 30, 60, 120, 180]`** — cinque durate |
| `itemKinds` | i sei soggetti possibili: opera, stile, movimento, artista, periodo, evento — l'elenco della slide 21. Ognuno porta **due** testi: `label` risponde alla domanda dell'editor, `name` e' il genere mostrato da solo su una pastiglia |
| `licenses` | **otto**: In Copyright, CC0 1.0 e le sei combinazioni Creative Commons |
| `SOURCE_LANG` | `"it"` |
| `languages` | tredici, ognuna con tre codici (translate / tts / stt) |
| `options` | il **vocabolario controllato**: sorgente unica dei bottoni a schermo e della mappatura vocale |
| `marketplaceViews` | sedici schermate; da qui si **ricava** il tipo `View` |
| `MAX_VISITE_VISITATORE` | 5 |
| `formatDurata` | impone una regola di prodotto: i secondi nudi non si mostrano mai |
| `pickLanguage` | una regola sola per le due applicazioni |

### 6.3 `access.ts` — una regola, due sponde

36 righe. Sta accanto ai tipi e per lo stesso motivo: e' un accordo fra client e server, e **un
accordo scritto in due posti si rompe da solo senza che niente lo segnali**.

### 6.4 `theme.css` e `components.css`

Il vocabolario di classi e' in italiano e **grafico, non semantico** — `.lastra`, `.pastiglia`,
`.dissolvenza`, `.filo-accento`, `.riga-figurata`, `.figura-sfumata` — ed e' deliberato
(`guidelines.md` regola 3).

**La dissolvenza e' una lingua con tre forme**, e la riga che le divide e' *se sopra la figura ci
passa del testo*:

| | dove | testo sopra? |
| --- | --- | --- |
| `.dissolvenza` | la tessera del catalogo | **si'**, quindi le fermate della maschera sono un vincolo di contrasto e si misurano |
| `.riga-figurata` | le righe d'elenco | **no**: la sfumatura arriva a zero prima della colonna di testo |
| `.figura-sfumata` | la scheda del navigator sul telefono | **no**, e da `lg` la maschera si toglie |

⚠️ Che il testo non ci passi sopra **e' quel che rende la riga sicura**: senza testo
sull'immagine non esiste nessun rapporto di contrasto che dipenda da quale quadro sia capitato in
quella riga. La tessera della vetrina paga invece quel prezzo, ed e' l'unica delle tre che ha una
misura da rifare quando la si tocca.

⚠️ **Un difetto di contrasto vecchio che non aveva mai visto nessuno**, e per cui la passata
grafica e' stata **misurata** invece che guardata: il binario e' scuro in tutt'e due i temi, ma
l'ottone si schiarisce **solo** al buio — quindi al chiaro il credito era ottone scuro su Notte,
**1,87:1**. Stessa forma del difetto gia' pagato col `<select>`: un token che segue il tema, messo
su una superficie che il tema non cambia.

### 6.5 `shared/i18n/`

Dodici cataloghi (`de es fr ja ko nl pl pt ru tr zh-CN en`), letti da tutte e due le applicazioni
ma **caricati in modo diverso**: il marketplace ne scarica uno da `/i18n/<codice>.json`, il
navigator ne importa uno pigramente attraverso Vite. Le chiavi sono le frasi italiane, quindi
l'italiano non ha catalogo.

---

## Appendice — i tre difetti che hanno prodotto `guidelines.md`

Vale la pena saperli a memoria, perche' hanno una cosa in comune: **compilavano tutti e tre.**

1. **I binding di Alpine sono stringhe che nessun compilatore controlla.** Un rename lascio'
   indietro `$watch('vista', …)`; Alpine lancio', il watcher non si registro' mai, e la tabella
   delle vendite resto' vuota per settimane in silenzio.
2. **`role === "autore" ? … : …`** ingoiava il terzo ruolo: il selettore di profilo mostrava
   «Visitatore» sopra la descrizione del curatore. Un ternario binario non e' piu' semplice, e'
   solo piu' corto — e mente quando il mondo cresce di un caso.
3. **`ts-node` ignora i `.d.ts` ambientali dal tsconfig.** Una `/// <reference>` tolta teneva
   `tsc` verde e faceva smettere di partire `npm run start`.

Da cui la regola che li copre tutti: **verificare eseguendo la cosa, non leggendola.**
