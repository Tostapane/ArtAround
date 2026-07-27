# `left.md` — handoff, restyle in corso

**Written 2026-07-27, mid-session (quota ran out).** Task: implement `prelude.md` end to end.

> ## ✅ STATUS — both apps build green
> - **Marketplace**: `npm run build` → exit 0.
> - **Navigator**: `vue-tsc --noEmit` → **exit 0**, `vite build` → **exit 0** (108 modules).
>   Shared tokens, Bricolage and the shared component classes all verified present in the
>   emitted CSS of *both* apps.
> - **Server**: edited, `tsc --noEmit` not re-run since the edits (§2.3).
>
> Nothing is committed — `git status` is the whole diff. **This is a good point to commit.**
>
> What remains is in §3.6 (one polish detail) and §4 (the genuinely unfinished work:
> `testers.ts`, the tone migration, the QR sheet, `state.md` refresh).
>
> ⚠️ **Never run yet:** neither app has been opened in a browser (no Mongo, no docker here).
> Everything is "compiles and type-checks", not "seen working". The first run will find real
> bugs — most likely in the hash router and the bottom sheet's snap behaviour.
>
> **The server WAS run and probed live** (Mongo is up on your machine). Verified working:
> `GET /api/config`, the new `GET /api/qr` (returns real SVG), the ownership-filtered
> `GET /museums/:qid/visits` (12 of 14 visits — the guided one correctly excluded), the
> three deleted routes returning 404, and role-resolving login (an account with a role logs
> in and gets its role back; a role-less legacy document is rejected 401).
>
> ⚠️ **You have a stale server running on :8000** from before this work — it has no
> `/api/config`. Restart it to pick up the changes. I did not kill it.
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

## 0-bis. La soglia: marchio e fondale (2026-07-28)

**Il fondale "La Pianta" è stato sostituito.** Al suo posto un **automa cellulare ciclico**
disegnato su canvas (`automaton()` in `marketplace/src/frontend/app.ts`): ogni cella avanza
di stato appena una vicina le è un passo avanti, e da rumore casuale la regola si
auto-organizza in fronti d'onda che si rincorrono senza fermarsi mai.

**Terza passata (28/07): da automa a SCIAME che compone figure.**
L'automa cellulare è stato sostituito da una nuvola di punti che si raduna a formare, una
dopo l'altra, le **piante dei musei** e i **contorni di alcune opere**, poi si sfalda in una
tempesta e si ricompone nella successiva (`swarm()` in `app.ts`). Le sorgenti sono le stesse
mappe annotate da cui il server ricava il grafo delle sale e le stesse immagini delle opere
in vendita: il fondale cambia da solo quando si aggiunge un museo.

Come si ricava una figura: la sorgente si disegna piccola fuori schermo, se ne misura il
**contrasto locale** e si tengono i punti dove cambia di più. Vale sia per le mappe (al
tratto) sia per i dipinti (fotografie): restano i contorni, mai una macchia piena.

**Quarta passata: via il rimbalzo, e sfumatura ai bordi.**
- **Tolta del tutto la fase di dispersione.** I punti ora sono *sempre* attratti da un
  bersaglio e passano da una figura all'altra scivolando. La dispersione rimbalzava, e il
  riavvolgimento ai bordi che l'accompagnava faceva sparire i punti da un lato per farli
  ricomparire dall'altro. Restano due fasi: `morph` e `hold`.
- Ogni punto parte con un **piccolo ritardo suo**, così la figura si compone a ondate invece
  che tutta in una volta; a figura ferma resta un respiro appena percettibile.
- **Sfumatura ai bordi**: l'opacità dei punti cala avvicinandosi al margine (`EDGE`), così la
  nuvola sfuma nel buio invece di finire tagliata di netto. Sopra, un **velo radiale**
  (`.sciame-velo`) scurisce i bordi e stacca il titolo dal fondale.

**Quinta passata: la figura non si leggeva.** La sfumatura ai bordi, appena introdotta,
**stava cancellando proprio la figura**: il disegno veniva inquadrato all'82% dell'altezza,
lasciando 97 px di margine, mentre la fascia di sfumatura era larga 238 px. I muri
orizzontali in alto e in basso — la parte che più definisce una pianta — finivano sotto il
10% di opacità, e restavano solo due striature verticali. Correzioni:
- inquadratura della figura **0.82 → 0.62**, fascia di sfumatura **0.22 → 0.10**: la figura
  ora sta tutta fuori dalla zona smorzata (bordo superiore a 205 px contro una fascia di
  108 px);
- caselle di campionamento **3 → 2** e soglia **0.14 → 0.12**: da 788 a **1220 punti**;
- particelle **4000 → ~2300**: prima erano sei per bersaglio e il disegno si impastava, ora
  sono circa una o due.
Le tre piante danno 1220, 1232 e 1414 punti, **tutti pienamente visibili, nessuno smorzato**.

Il difetto è stato trovato simulando la pipeline **intera** fuori dal browser — rasterizzare
la mappa, estrarre i contorni, calcolare i bersagli, applicare la sfumatura e stampare il
risultato in ASCII. Le prove precedenti verificavano un pezzo per volta e passavano tutte:
il guasto stava nella *combinazione* fra inquadratura e sfumatura, che nessuna prova isolata
poteva vedere. Vale la pena rifarlo così se si ritocca `margin`, `EDGE` o `SAMPLE_W`.

*(Nota: un test precedente sembrava dire che le piante rendessero solo il perimetro. Era il
rasterizzatore di prova a non ereditare gli attributi dai `<g>`, e i muri stanno dentro
`<g stroke="#333" stroke-width="4">`. Il browser li disegna: la mappa vera ha più struttura
di quanto quella prova mostrasse.)*

Tre difetti trovati nel proprio codice quando la resa è risultata "lampeggiante e rumorosa":
1. **il riavvolgimento ai bordi valeva anche mentre i punti raggiungevano un bersaglio** —
   qualunque punto tirato attraverso il riquadro spariva e ricompariva altrove: era quello a
   far lampeggiare tutto;
2. **i bersagli erano assegnati a caso**, quindi metà sciame attraversava il riquadro e la
   figura si componeva in un groviglio — ora punti e particelle si ordinano per angolo
   attorno al centro e ognuna riceve un bersaglio dalla propria parte;
3. **i contorni erano scelti mescolando e tagliando**, il che su una fotografia teneva la
   grana sparsa ovunque — ora si divide il campione in caselle e in ognuna si tiene il
   contorno più netto, così i punti seguono la struttura e restano distribuiti.

Verificato senza poter guardare lo schermo:
- la matematica dei contorni, su un campo sintetico: traccia i bordi e trova **zero** punti
  dentro le campiture — che era il rischio vero;
- l'iniezione di `width`/`height` nelle mappe, che hanno solo il `viewBox` e altrimenti
  verrebbero disegnate larghe zero;
- che le tre sorgenti siano davvero servite (`/api/museums`, `/maps/*.svg`,
  `/images/artworks/*.jpg`, tutte 200 col tipo giusto e tutte di pari origine, quindi il
  canvas non si "sporca" e i pixel si possono rileggere).

Due difetti trovati rileggendo il proprio codice e corretti: le figure normalizzavano x e y
separatamente e venivano disegnate in un 4:3 fisso (**un dipinto verticale sarebbe stato
schiacciato** — ora ogni figura porta con sé le proporzioni), e i punti venivano scelti per
intensità del contorno, il che avrebbe tenuto solo i tratti più spessi facendo sparire
l'interno delle piante (ora si mescola e poi si taglia).

⚠️ La soglia ora carica fino a sei sorgenti (tre mappe, tre immagini). Arrivano in modo
asincrono e la prima figura si compone appena è pronta, ma è traffico in più sulla pagina
d'ingresso: se dà fastidio, si riduce `slice(0, 3)` sulle opere in `loadShapes`.

**Seconda passata (28/07): punti più piccoli, più fitti, e moto continuo.**
- `CELL 13 → 10`, `DOT 0.30 → 0.24`: diametro massimo da 7,8 a **4,8 px**, e circa il doppio
  delle celle. `PERIOD 260 → 150`.
- **Il moto non è più a scatti.** L'automa avanza a passi discreti ma il disegno interpola
  fra il passo precedente e quello nuovo a ogni fotogramma, con raccordo morbido. Si
  interpola l'*intensità*, non lo stato, così il salto da N-1 a 0 non produce uno strappo.
- **Si disegna sui pixel, non con i tracciati.** Con punti così piccoli le celle sono oltre
  ventimila: altrettante chiamate di tracciato per fotogramma non reggerebbero. Si scrive in
  un `ImageData` e lo si riversa in un colpo solo, con il bordo sfumato nell'ultimo mezzo
  pixel (senza, punti da 4 px risultano seghettati).
- **Il canvas resta a un pixel per pixel CSS**, non alla densità dello schermo: misurato,
  raddoppiare costa 10,6 ms per fotogramma contro 4,6 — e su punti sfumati e quasi
  trasparenti non si vedrebbe. Costo verificato anche a 2560×1440: 9 ms, dentro i 60 fps.

Scelte fatte, per non rifarle a caso:
- **Solo una fascia stretta di stati è accesa** (`PEAK` ± `BAND`). Con la prima versione si
  illuminavano zone larghe e il fondale faceva concorrenza al titolo; ora si vedono linee
  sottili che attraversano il campo. Verificato simulando la regola fuori dal browser e
  stampandola in ASCII — a regime sopravvivono tutti e 14 gli stati, non collassa.
- Punti molto tenui (alfa massima 0.3 su fondo Notte), colori letti dai token.
- **`prefers-reduced-motion`**: l'automa compie 60 passi e si ferma, lasciando una
  composizione ferma invece di uno sfondo vuoto.
- **`ResizeObserver`** invece di un listener sul ridimensionamento: la soglia può essere
  nascosta all'avvio (si entra da un'altra rotta) e in quel caso il canvas non ha ancora
  dimensioni. L'osservatore aspetta che le abbia, ricostruisce la griglia quando cambiano e
  **ferma il moto mentre la sezione non si vede**; il moto si sospende anche a scheda in
  secondo piano.

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
| Quiz + teleport | **Deferred.** "we will implement the missing features such as the quiz, the teleport etc later" — do not build them now |
| Compatibility defects | **Deferred**, parked in `state.md` §10 (voice broken on iOS, CDN, QR/blind). Do not chase them |

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

The quiz *screens* remain deferred as instructed — only the missing **state** was added,
because representing it wrongly was showing users a false screen.

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

---

## 6. Uncommitted work

**Nothing is committed. 62 paths touched.** This is a good, verified point to commit:
all three parts compile, the server boots, and the DB is consistent.

- **26 modified**, **13 new files**, **13 deleted**, **2 renames**
  (`map/speech/useTTS.ts` → `visita/useTTS.ts`, `useMediaRecorder.ts` → `visita/useVoce.ts`).
- New untracked assets that **must** be committed or the apps break:
  `shared/{theme,components}.css`, `navigator/public/{config.json,fonts/}`,
  `marketplace/public/{fonts,vendor}/`, `server/src/types/`.
- `.gitignore` covers `dist/`, so build output stays out — correct.

Suggested message: *"restyle: struttura, flussi e informazione (prelude.md)"*.

---

## 7. What is genuinely left

**Deferred by you, untouched:** the quiz UI and the teleport module (`prelude.md` §7.1),
and the three compatibility defects in `state.md` §10 (iOS voice capture, the QR/blind
fallback is now half-done — the printed code is legible, the navigator accepts it typed).

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

**The real next step is to open both apps in a browser.** Everything here is verified by
compiler, static analysis and live HTTP probes; **no screen has been looked at.** Expect the
first run to find layout and interaction bugs, particularly in the bottom sheet's snap
behaviour and the hash router's guards.
