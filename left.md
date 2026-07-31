# `left.md` — handoff

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
- 🐞 **Le note logistiche d'apertura migrano in fondo a ogni modifica.** Una nota messa
  prima della prima opera si salva come `{after: null}` — giusto — ma `rebuildStops()` in
  `marketplace/src/frontend/state.ts` accoda le note senza ancora **dopo** il ciclo sulle
  opere. Riaprendo la visita in editor la nota compare in fondo, e un salvataggio che non
  cambia nulla la riancora all'ultima tappa: nel navigator smette di accogliere il
  visitatore all'ingresso e finisce sulla schermata di fine visita. Verificato con un giro
  completo su una visita usa e getta. **Rimedio: spostare il ciclo su `unplacedNotes` PRIMA
  di quello su `itemListElement`** — così `ultimoItem` è ancora `null` quando il server le
  incontra. Tutto il resto del giro (nota fra due opere) è corretto.
- ⚠️ **nel database non c'è nessuna visita guidata** (0 con `accessKey`, 0 con quiz, 0 con
  tappe opzionali): il modulo I non è dimostrabile. `seedSpecialVisits()` non è mai stato
  eseguito e *oggi funzionerebbe*. Vedi `state.md` §3.5. È il rimedio più economico che c'è.
- **teleport** — l'unico buco di specifica (`state.md` §7.1).
- passata sui commenti di `server/src` e `navigator/src` (non fatta, non urgente).

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
| DB helper scripts | Must all live in **one file: `server/src/testers.ts`** (user's instruction, verbatim) |
| Quiz | ~~Deferred~~ → **built 2026-07-28** (§8). Teleport is still deferred and is now the *only* thing missing for 18-33 |
| Session persistence | **Never.** Asked for and then removed the same day: *"i do not want any session restorage"*. Opening `/` must always show the soglia (§8) |
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

1. ~~**`server/src/testers.ts`**~~ — **WRITTEN AND RUN** against your live Mongo.
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
   Small CLI, idempotent, `npx ts-node src/testers.ts <comando>`:
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
- `state.md` §9.11 (naming: `intertMuseum`, `"markeplace"`, `transcrtiption`, the wrong keys
  in `museumContent.ts`) — cosmetic, untouched.

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
