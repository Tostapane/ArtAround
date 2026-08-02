# ArtAround — `state.md`

**Complete state of the system as of 2026-07-28.**

> Purpose. This document is the *starting point for the restyle*. It therefore has to be
> exhaustive about **what screens exist, in what states, reachable from where** — not just
> about architecture. Sections 1–6 describe the system as built; sections 7–9 are the
> analysis requested: **Improvements**, **Useless things**, **Odd parts**.
>
> **Updated 2026-07-27 after the restyle.** §4 and §5 were rewritten against the new
> structure; §7–§9 still describe the *pre-restyle* analysis and several of their entries
> are now closed — each is marked where that is the case.
>
> Relationship to the other docs:
> - `slides.pdf` — the assignment. Authoritative for *requirements*.
> - `prelude.md` — the redesign brief the restyle implements (§7 marketplace, §8 navigator).
>   Authoritative for *intent*: what each screen should be and why.
> - `left.md` — running handoff: what is done, what is verified, what is still open.
> - `missing.txt` — the team's running to-do / open questions between the two developers.
> - `spec.md`, `stylespec.md`, `stylespec-v2.md` — **deleted**; superseded by the above.

---

## 0. Executive summary

| Band | Requirement | State |
| --- | --- | --- |
| 18–24 (base, mandatory) | marketplace+editor, navigator with visit selection/execution, map, TTS, on-screen text, controlled-vocabulary voice commands + equivalent buttons | **Complete.** Logistics now shown (§0.1), the visit now *ends* and the controlled vocabulary has a panel of its own (§0.2) |
| Module I (18–27) | teacher-synchronized visit + end-of-visit quiz | Sync: **complete end-to-end**. Quiz: **complete end-to-end** since 2026-07-28 (§0.2) |
| Module II (18–33) | QR localization, **teleport module**, deep LLM integration | QR: done. LLM (4 uses): done. Advanced localization (device + orientation): done 2026-07-30 (§5.3). **Teleport: done 2026-07-30** (§5.3) |

One blocker left for the declared 18-33 target:

1. ~~the **teleport module does not exist**~~ — **CLOSED 2026-07-30**, fourth tab of
   `Posizione.vue` (§5.3);
2. **the database contains no guided visit** — 0 with `accessKey`, 0 with a quiz, 0 with
   optional stops (§3.5). Module I is implemented and was proved against the running server,
   but a demo today has nothing to run it on. `seedSpecialVisits()` was never executed; it
   *would* work now. This is the cheaper of the two to fix by a wide margin.

Everything else is in place and type-checks cleanly (`vue-tsc` and `tsc` both pass on all
three parts).

### 0.1 What the 2026-07 restyle closed

Implementing `prelude.md` resolved a number of the items listed below. They are kept in
§7–§9 for the reasoning, but **these are done**:

| Was | Now |
| --- | --- |
| §7.2 logistics never shown in the navigator | shown as a transition step between stops; notes are position-anchored (`LogisticNote`) |
| §7.3 level×duration cross-product selector | `Biglietteria`: a list of visits, the two menus demoted to filters that can't dead-end |
| §7.4 navigator plays any visit, guided ones included | `GET /museums/:qid/visits?user=` — guided never listed, paid only if owned |
| §7.5 no progress indicator | `Tappa N di M` + progress line, announced on every change |
| §7.9 QR sheet reachable only by typing the URL | `Stampa i QR delle opere` in the author area; codes now legible |
| §8.1 three endpoints nobody called | `GET /artworks/:qid/items`, `POST /items/batch`, `GET /museums/:qid` — removed |
| §8.2 dead build artifacts / 0-byte configs | `marketplace/dist/{backend,frontend}`, `server/dist`, both `tailwind.config.js`, the `#dropDown` div — all removed |
| §8.3 dead imports and functions | `llm.ts` (also breaking the `llm ↔ dbActions` cycle), `dbActions.ts`, `seed.ts`'s `testArtworks`/`printStored`, `useVoce.ts`'s leaking `audioUrl` — all removed |
| §8.4 tokens duplicated, theme toggle ×3 | `shared/theme.css` + `shared/components.css`; one toggle component |
| §9.2 stylespec targets non-existent screens | those files deleted; `prelude.md` replaces them |
| §9.4 two tone vocabularies | one vocabulary, the slides' four tones; **DB migrated** (130 items + 6 visits) via `testers.ts` |
| §9.10 server TypeScript unchecked | `strict: true` + `skipLibCheck` + `shared/` in the program — `tsc --noEmit` now exits 0. Enabling it surfaced **6 real defects**, all fixed |
| §9.5 `seedMuseums()` commented out | uncommented and moved first in `completeSeed()` |
| §9.6 logistics lose their position | anchored `{after, text}`, round-trip preserved — **fully** only since 2026-07-31: the anchoring was right on the way out but `rebuildStops()` put the opening notes last on the way back in, so re-saving an untouched visit moved them to the final stop (`left.md` §10) |
| §9.7 `Map.vue` shipped with a `TODO TEMP` | toggle appears only when there are optional stops |
| §9.8 hardcoded `localhost` / `Q6373` | `navigator/public/config.json` + `GET /api/config` |
| §9.9 `visitaUtilizzabile` treats unknown items as owned | unresolvable ids now count as **missing**, not owned |

Still open from those sections: §7.1 (teleport), §7.6 (UI translation), §7.7
(`stepStartAt` sync), §7.8 (spatial ordering of custom visits), §9.11 (naming), and all
of §10.

### 0.2 What the 2026-07-28 pass closed

Twelve items of feedback, seven of them defects found by using the thing:

| Was | Now |
| --- | --- |
| the description editor's textarea was bound to `draft.raw`, a field that does not exist — publishing always answered "Manca ancora: il testo" | bound to `draft.testo`; the estimator and the validator finally see the same string |
| `x-model` on a radio with `:value="false"` returns the **string** `"false"`, which is truthy: once a visit was marked guided it could never go back to the catalogue | `x-model.boolean` with literal `value="true"/"false"`; the type is no longer frozen while editing, and importing a path no longer forces "guided" |
| the navigator located the current stop by **artwork** id, so a visit with two items on the same object looped between them and never advanced (§9.3 said the slides *want* multiple items per object) | located by **item** id — in `indexInVisit`, in `currentPosition`, in the list `:key`, and on the map, where the two stops now share one numbered node instead of overwriting each other |
| the visit never ended: "Prossimo" on the last stop did nothing | end-of-visit screen with the closing logistics and **Torna alla home** |
| the controlled vocabulary was reachable only by opening the artwork sheet to full height | **Chiedi** button in the visit bar → panel with both families (`Pannello.vue`, shared with the sheet, so the two lists cannot diverge) |
| the sheet's "Apri la scheda" was grey caption text under the title — the typography of a description, not of a control | a bordered pill with a chevron that rotates on open, accented on hover |
| the backdrop **jerked** at every figure change: `tick()` reused the *previous* phase's `elapsed`, so the first frame of a morph ran at `progress = 1` — one frame covering **8% of the whole journey**, the next covering 0.001% | `elapsed` reset on the phase change; and the motion is now an eased **interpolation** (smootherstep, zero velocity at both ends) along a **bowed** path, instead of a chase whose speed is maximal at the first instant. Peak per-frame displacement 8.00% → 1.04% |
| quiz: server + authoring done, **no navigator UI** | teacher starts it, watches submissions land and grades in real time, closes it; student answers, submits once, sees the score. Correction stays server-side, and `GET /visits/:id` no longer ships `correct` to the students' browsers |
| `POST /:id/end` deleted the session instantly, so a **planned** close reached every student as a 410, i.e. "the session vanished" | the session lingers 30s in state `terminata`; the clients read it and say "La visita è finita" |
| the seeded guided visit had **no quiz**, so slide 33's "test sensato di competenza" was unmet by a fresh seed | `server/src/data/quiz.ts` builds one **from the visit's own artworks** — author, style, "which of these is by X", distractors drawn from the same museum, `Unknown` filtered out. No hand-written question, so it holds for any museum |
| "Il banco" | "Home" (route `#/home`), plus the soglia and the login lost the university strapline, the dead theme toggle and the profile line |

### Il biglietto di rientro *(2026-07-31)*

Tornando dal navigator la pagina si ricarica su **un'altra origine**, quindi il marketplace
non sa piu' chi sei e mostrava la soglia. I canali per attraversare sono due soli — la
memoria del browser (che e' la persistenza rifiutata) e l'indirizzo — e nessun formato di
token ne crea un terzo: **JWT non c'entra**, e qui non servirebbe comunque (verifica senza
stato non serve a un processo solo, non si revoca senza una lista lato server, e
`jsonwebtoken` non si installa perche' `server/node_modules` e' di root).

Quello che attraversa e' un **biglietto monouso**: `crypto.randomUUID()` coniato **dentro
`POST /login`**, che e' l'unico punto in cui la password viene verificata — un endpoint che
lo conia per un nome qualsiasi sarebbe falsificabile come il nome stesso. Sta in una `Map`
in memoria con le sale guidate, vale 6 ore, e si cancella **prima** di guardare se e'
scaduto. Il marketplace lo tiene in memoria (mai in `localStorage`), lo mette sui
collegamenti dello stesso dispositivo e **mai nel QR** — una credenziale stampata vale
quanto la carta su cui sta. Al rientro lo spende e lo toglie dall'indirizzo, cosi' un
ricaricamento non lo rigioca.

Cosi' la soglia resta raggiungibile aprendo `/` a mani nude, che era la proprieta' la cui
perdita aveva fatto togliere la persistenza.

**One change was made and then removed at the user's instruction: marketplace session
persistence.** "Torna alla home" at the end of a visit crosses an origin, so it is a page
load and the marketplace showed the soglia instead of the visitor's home; restoring the
session from `localStorage` fixed that and broke something worse — **the soglia became
unreachable**, since every load of `/` resumed the last account. The gated version (resume
only for an address that requires being logged in) was not wanted either: *"i do not want
any session restorage"*. `state.ts`, `marketplace/src/frontend/api.ts` and
`server/src/routes/users.ts` are back to their previous behaviour, the last two byte-identical
to HEAD. **Do not re-add it.** The end-of-visit button still points at the marketplace home
and lands on the soglia when logged out, which is the normal behaviour for a logged-out
visitor.

The six defects `strict` surfaced on the server, for the record: `req.file` used without
its own guard; a transcript that could be `undefined` passed to `mapRequest`; `user.wallet`
treated as a number on a schema that gives it no default (a visitor document without one
would have thrown at purchase); `fetchArtwork` typed as never returning `null` while
returning it; plus the `dotenv` types. Note **`ts-node` does not load ambient `.d.ts` from
tsconfig `include`** — `src/env.ts` needs its `/// <reference>` line or `npm run start`
stops compiling.

---

## 1. Architecture and hard constraints

Three independently built parts over one shared type layer. All constraints from slide 37
("Vincoli hard") are respected:

```
shared/                types.ts (Artwork, Item, Visit, Museum, User, Match, QuizQuestion,
                       Contenuto, UserRole) + constants.ts (levels, durations, licenses,
                       languages, controlled-vocabulary options)
server/    :8000       Node + Express + Mongoose + ts-node. Also serves the marketplace
                       statically ("/" → marketplace/public, "/dist" → marketplace/dist).
navigator/ :5173       Vue 3 + Vite + TS + Tailwind v4. Own dev server.
                       public/config.json = the curator's configuration file.
marketplace/           Alpine.js (served LOCALLY from public/vendor/) + vanilla TS compiled
                       by `tsc` + Tailwind CLI. No bundler. Served by the server.
shared/theme.css       design tokens + fonts, imported by BOTH apps
shared/components.css  component vocabulary, imported by BOTH apps
```

- **No framework** in the marketplace ✔ (Alpine + vanilla TS, one `index.html`).
- **A framework** in the navigator ✔ (Vue 3, `<script setup>`, no router, no store library).
- **Node-only server** ✔; MongoDB only ✔; two docker containers (`mongo:7.0` + `node:22`) ✔.
- **Genericity** ✔: no museum-specific code anywhere. A museum = a DB document + a JSON
  config in `server/src/data/museums/` + an annotated SVG in `server/public/maps/`.

### 1.1 The genericity mechanism (the heavily-weighted criterion)

Four museums are configured, each with a real Wikidata QID, a hand-written JSON config and a
hand-annotated SVG floor map:

| Config file | qid | rooms / artwork nodes / POIs / edges / obstacles in the SVG |
| --- | --- | --- |
| `British Museum.json` | `Q6373` | 5 / 13 / 5 / 4 / 2 |
| `Metropolitan Museum of Art.json` | `Q160236` | 10 / 13 / 12 / 11 / 4 — **su due piani** (§1.1-ter) |
| `Museo del Louvre.json` | `Q19675` | 6 / 13 / 6 / 5 / 3 |
| `Galleria degli Uffizi.json` | `Q51252` | 21 / **104** / 10 / 20 / 4 |

**The config file is an INPUT, and only since 2026-07-31.** Before that the list of museums was
a TypeScript module (`data/museumContent.ts`) and these JSON files were *written* by the seed
from Wikidata: adding a museum meant editing code, and anything the curator put in the file was
overwritten on the next run. `data/museumConfigs.ts` now reads the directory and nothing writes
it; `data/museumContent.ts` and `services/museumConfig.ts` are deleted. The file's fields, and
why each one is there rather than derivable, are documented at the top of `museumConfigs.ts`.
Two consequences worth knowing:

- **`name` beats Wikidata**, which is queried only for the fields left blank. For the Uffizi the
  Italian Wikidata label is *"Palazzo degli Uffizi"* — the building, not the gallery. A museum's
  name is a curatorial choice, so the file has the last word.
- **`logistics`** (new) holds the indications that belong to the museum and not to one visit —
  slide 21's own example is "l'entrata è da via Garibaldi 2, il biglietto costa 15€, c'è un
  guardaroba gratuito". The seed attaches them to every visit it generates as **opening notes**
  (`{after: null}`), which is where the navigator plays them.

**Where an artwork *is* comes from the map, not from the file.** `locationId` used to be
`art-<position in activeArtworks>`, i.e. two parallel lists to keep aligned by hand; inserting one
qid in the middle would have moved every artwork after it onto the wrong node, silently. The seed
now looks the artwork up by `data-qid` in the SVG and takes that element's `id`
(`manager.ts locationsFromMap`, `GraphNode.elementId`). Verified against the three old maps first:
their `art-N` ids already matched their config order, so the change is a no-op for them.

The **SVG map is the single spatial source of truth**. The curator annotates the map they
already draw; `services/svgGraph.ts` parses it into a room graph. The contract:

- `data-room="Nome"` on a circle/rect/polygon → a room **area**. A node's room is the area
  that **contains** it (point-in-region, document order, first match wins) — so walls are
  respected rather than mere proximity.
- `data-qid="Qxxx"` → artwork node (centre = position). `data-poi="exit|emergency_exit|
  toilet|bar|shop|elevator|stairs"` `[+ data-label]` → POI node.
- `data-obstacle="steps|door|chairs|object"` + `data-desc` → obstacle.
- `<line data-edge …>` → link between the two rooms containing its endpoints.
- `<g data-floor="1" data-floor-label="Primo piano">…</g>` → everything on that floor (§1.1-ter).

Connectivity is **authored only** — no geometric adjacency is inferred — so every walkable
space (corridors included) must be a `data-room`.

Two further annotations belong to the **localization module** and are read by the *navigator*,
not by `svgGraph.ts`:

- `data-width-m` on the `<svg>` root — how many real metres the viewBox width spans
  (80 / 95 / 110 / 150 on the four maps, deliberately different: a constant hardcoded in the
  client would otherwise pass unnoticed). It is the only thing tying the drawing to the world; the
  plans are schematic, so the number cannot be derived from what is drawn — the curator
  measures it. Without it the automatic localization does not start, and the app falls back to
  QR without claiming anything false.
- `data-poi="entrance"` — where the coordinate system is born when the app opens.

There is **no absolute georeference**: the frame is created at runtime with the visitor at the
entrance, and the map's up *is* north by definition. That is what makes the module work in
Bologna as well as in Bloomsbury, and it is why no museum's real coordinates appear anywhere.

Everything else in the file is **drawing**, and the parser ignores it because it carries no
`data-*`: the grid, the door leaves, the room labels, the legend under the plan. The three
maps carry an inline `<style>` whose rules are all wrapped in `:where(…)` (specificity 0)
and whose colours come from `shared/theme.css` variables with standalone fallbacks — so the
map follows the app's light/dark theme, and the classes `Stage.vue` adds at runtime
(`nodo-opera`, `nodo-corrente`, `nodo-opzionale`) always win the cascade. Two traps when
editing: the parser reads `cx/cy` or `x/y/width/height` **verbatim** (a `transform` on a
`data-*` element is not applied), and resizing a POI/obstacle square means recomputing `x`
and `y` to keep its centre — the centre is what decides its room.

### 1.1-ter I piani: una sala in piu', non un caso in piu' *(2026-08-02)*

`missing.txt` chiedeva «e se avesse piu' piani?». La risposta che il sistema da' ora e' che un
piano **non e' una dimensione nuova**: il vano scale e' una sala su ciascun piano, le due sono
collegate da un `data-edge` come due sale confinanti, e la ricerca del cammino sale e scende
senza sapere che esistono i piani. Non c'e' un ramo "cambio piano" da nessuna parte — c'e' una
sala in piu'. La Galleria degli Uffizi, il Louvre e il British Museum non dichiarano nessun
piano e si comportano **esattamente** come prima: `MuseumGraph.floors` resta vuoto e la parola
"piano" non compare mai.

**Dove sta il numero e dove sta la parola.** `data-floor` e' il numero, e serve a una cosa
sola: sapere se si **sale** o si **scende**. Il nome lo scrive il curatore in
`data-floor-label`, perche' un museo ha il Mezzanino e il Piano Nobile e un altro ha cinque
piani numerati: un elenco di ordinali italiani scritto nel codice sarebbe la lingua di un museo
solo imposta a tutti. Un piano numerato e non nominato ripiega su `piano N`, che e' un ripiego
dichiarato e non una traduzione inventata. Le stesse etichette le usano il selettore del
navigator e le indicazioni parlate.

**Il piano si nomina solo quando cambia.** `RouteStep` porta `floor` e `floorLabel`; la
risposta semplice aggiunge `(Primo piano)` **solo** se la destinazione e' su un altro piano, e
il prompt inserisce `SALI al …` / `SCENDI al …` dove il piano cambia lungo il percorso. Non
c'e' nessuna soglia da attivare e nessun museo da distinguere: in un edificio a un piano solo
la condizione non e' mai vera.

**I piani stanno nello stesso disegno**, impilati come su una pianta stampata, e il navigator
ne **inquadra** uno per volta spostando il `viewBox` sull'estensione del gruppo — non
nascondendo gli altri, perche' un sottoalbero nascosto non ha piu' un `getBBox()` e i numeri
delle tappe si disegnano proprio con quello. Inquadrando, i numeri e il segnalino di posizione
degli altri piani cadono fuori dal riquadro da soli. Il selettore compare solo con piu' di un
piano, e la tappa aperta porta con se' la pianta: aprirne una di sopra fa salire il disegno.
Impilando invece di affiancare, `data-width-m` resta la larghezza di **un** piano, quindi la
scala della localizzazione non cambia.

**A che piano si e' lo dice il selettore, non un sensore**, ed e' una risposta e non una
rinuncia: il GPS da' due coordinate, non tre, e nessuna delle misure che l'app fa distingue un
pavimento dall'altro. Il piano e' quindi **dichiarato**, come lo e' la posizione col QR, col
codice digitato e col teletrasporto — la stessa forma che il progetto usa ovunque. Il selettore
e' un gruppo di radio etichettato e **ogni cambio si annuncia** (`Pianta: Primo piano`), scelto
a mano o seguito da una tappa: chi non vede la pianta ha lo stesso identico modo di dichiarare
il piano e di risentirselo dire di chi la guarda.

**Due trappole trovate provando, non leggendo.** La linea che collega i due vani scale non puo'
stare dentro il gruppo di un piano: allunga il suo `getBBox()` fino all'altro piano, e
inquadrando il primo piano si vedeva mezzo piano terra. Sta fuori da entrambi i gruppi, e il
parser non se ne accorge perche' risolve gli estremi alla sala che li contiene. E i **nomi
delle sale devono essere unici su tutta la mappa**, piani compresi: le adiacenze si tengono per
nome, quindi due sale omonime su due piani diventerebbero una sola, cioe' un passaggio fra i
piani che nessuno ha disegnato — ora il parser lo segnala invece di indovinare.

Il parser inoltre **toglie i commenti prima di scandire**: queste piante si spiegano da sole a
lungo, e da quando il conto dei `<g>` e' uno stato, un `<g>` nominato dentro un commento
sposterebbe il piano di tutto quel che segue.

### 1.1-bis Concorrenza: dove l'idea regge e dove no

L'app deve poter servire molte persone insieme. L'impianto **regge**: le API sono REST
senza stato (nessuna sessione lato server), quindi due visitatori non si disturbano, e
l'unico stato condiviso — le sale guidate — è effimero e in memoria per scelta.
Il *polling* delle visite guidate è sano: 1,5 s per studente, e la presenza si deduce dalla
richiesta stessa, senza traffico aggiuntivo (30 studenti ⇒ ~20 richieste/s).

Tre punti dove invece **l'idea non scala**, misurati il 2026-07-30:

| Punto | Misura | Perché conta |
| --- | --- | --- |
| ~~Nessun filtro per museo~~ **CHIUSO 2026-07-30** | l'accesso scaricava **453 KB**, ora **153 KB (−67%)** | `GET /artworks`, `/items`, `/visits` accettano `?museum=Qxxx`; `initApp()` **risolve il museo prima di scaricare** e `selectMuseum()` ricarica. Conseguenza da conoscere: il selettore non poteva più contare i musei che non ha scaricato, quindi `GET /museums` porta ora `opere` e `visite` contati dal server. Resta senza paginazione *dentro* un museo (104 item): con il decuplo di contenuti per museo servirà anche quella |
| ~~**Un solo indice** in tutto il database~~ **CHIUSO 2026-07-30** | `explain()` sulla stessa query, prima e dopo: **COLLSCAN, 312 documenti esaminati per restituirne 104, 0 chiavi** → **IXSCAN, 104 esaminati per 104 restituiti** | senza indice Mongo legge *ogni* documento e scarta a mano: il costo cresce col numero di documenti, non con quello dei risultati, cioè peggiora esattamente quando il museo si riempie. Aggiunti solo gli indici corrispondenti a forme di query che esistono davvero nel codice: `Item.{@id,about,author}`, `Visit.{@id,ofMuseum,author,itemListElement}`, `Artwork.{qid,ofMuseum}`, `User.collezione` |
| ~~N+1 nel resoconto vendite~~ **CHIUSO 2026-07-30** | **654 ms → 67 ms** su 312 righe (≈10×), e le query passano da **314 a 3, fisse** | `countDocuments` stava *dentro* il ciclo sulle righe: una query per riga, sequenziali, e ognuna a sua volta una scansione di `users`. Ora una sola `find({collezione: {$in: ids}})` e il conteggio in memoria. **Verificato identico**: le 312 righe confrontate una per una col metodo precedente, zero divergenze |

| ~~Il catalogo di un museo viaggia intero, testi compresi~~ **CHIUSO 2026-07-31** | `GET /items?museum=Q19675`: **138 KB per 104 item**, cioè ~1,1 MB proiettati sugli 832 degli Uffizi. Ora l'accesso ne scarica **36 KB** (−74%), più 6 KB per ogni opera che si apre davvero | vedi §3.1-bis. La riga qui sopra prometteva la paginazione «col decuplo di contenuti»; il decuplo è arrivato con la Galleria degli Uffizi (104 opere × 4 toni × 2 durate = **832 item in un museo solo**), ed è servita un'altra cosa: non tagliare l'elenco, ma togliergli i testi |

Nota minore: la cache delle traduzioni (`services/translate.ts`) è una `Map` **senza tetto né
sfratto**, con dentro i testi interi. È la scelta giusta per la demo — gli stessi testi li
chiedono tutti — ma cresce in modo monotono finché il processo vive.

### 1.2 Convenzioni di codice

Stanno in **`guidelines.md`**, che è la sede unica: cinque regole (spiegazione in cima al
file, dentro solo separatori, codice in inglese e commenti in italiano, KISS, e la riga
migliore è quella che non hai scritto), più i tre difetti veri che le hanno prodotte.

⚠️ **Si fanno rispettare, non solo si seguono.** Chi tocca un file che le viola — commento
esplicativo in mezzo al codice, intestazione assente, identificatore in italiano — **lo
corregge lì, in quel passaggio**, invece di lasciarlo passare.

---

## 2. Data model (`shared/types.ts` — authoritative)

- **Artwork** — `@id` (Wikidata URI), `qid`, `name`, `imageUri` (remote), `imagePath`
  (downloaded, server-relative), `author{name,qid}`, `style{name,qid}`, `ofMuseum` (URI),
  `locationId` (the SVG node id), `lastUpdated`. Model adds `@context`/`@type`.
- **Item** (= `CreativeWork`) — `@id` = `QID-autore-tono-durata`, `about` (Artwork `@id`
  string in the DB, **populated object** when served to clients), `text`, `timeRequired`
  (bare seconds as a string, e.g. `"15"`), `educationalLevel` (the "tono"), `author`,
  `license`, `price?`, `visibility?` (`"pubblico"` default | `"privato"`).
  Uniqueness is per **(artwork, author, tono)** — enforced client-side (used tones disabled)
  and server-side (**409**).
- **Visit** (= `ItemList`) — `@id`, `name`, `level`, `duration` (**total** seconds),
  `price?`, `license?`, `ofMuseum`, `itemListElement` (Item `@id`[]), `optionalItems?`
  (subset), `logistics`, `author?`, `accessKey?`, `quiz?`.
  `accessKey` present ⇒ **guided visit**: free, not purchasable, not listed to visitors.
- **LogisticNote** — `{after: string | null, text}`. `Visit.logistics` is now
  `(string | LogisticNote)[]`: notes are **anchored to the stop they follow**, so the
  navigator can show "how to get to the next item" at the moment it matters (slide 21).
  Bare strings are pre-restyle rows, still readable; `testers.ts logistica` converts them.
- **QuizQuestion** — `{question, options[4], correct}`. `correct` never leaves the server.
- **User** — identity is the **pair `(username, role)`** (unique compound index). An
  `autore` and a `visitatore` with the same username are *distinct, unlinked accounts*.
  `wallet` exists only on visitors; `collezione` is the owned-content id list.
  Password stored in clear (security is explicitly not graded).
  **Three roles since 2026-07-30**: `visitatore` consumes, `autore` produces, **`curatore`**
  answers for the *museum* — it watches the catalogue's coverage and removes what should not
  be there. A curator has neither wallet nor collection, and is not self-registerable: the
  account comes from `testers.ts account` (`curatore1` / `12345678`). It is **not a slide
  requirement** — the four mandated accounts remain two authors and two visitors.
- **Match** — `{artwork, item}`; the join is done **server-side**, never in the client.

The four slide-mandated metadata are covered: **lunghezza** (`timeRequired`), **linguaggio**
(`educationalLevel`, 4 tones), **autore** (`author`), **licenza** (`license`).

### 2.1 Constants (`shared/constants.ts`)

- `educationalLevels = ["Infantile","Semplice","Medio","Avanzato"]` — **the slides' four
  tones** (slide 22), now the *single* vocabulary of the system: editor, seed, LLM planner
  enum and every filter. The old `Principiante/Intermedio/Avanzato` split is gone (§9.4 was
  closed by this change). ⚠️ **Existing DB rows still carry the old values until
  `npx ts-node src/testers.ts toni` is run.**
- `educationalLevelHints` — one line per tone, shown to the author choosing: the choice is
  made on the consequence, not on the label.
- `secPerArt = [15, 60]` — seed durations and planner enum.
- `licenses[5]`, `SOURCE_LANG = "it"`, `languages[13]` (name + translate/tts/stt codes,
  only fully-supported languages).
- `options: CommandOption[]` — the **controlled vocabulary**, single source for the
  on-screen buttons and the LLM voice mapping. **`id` and `label` are now decoupled**:
  `id` is the canonical token (`mapRequest` maps onto ids, handlers compare ids), `label` is
  free display text — which is why the labels are finally correct Italian, accents and
  apostrophes included. `surface` says *where* the equivalent button lives:
  `"chiedi"` (artwork questions → LLM), `"orientati"` (building questions → room graph),
  `"scheda"` (direct sheet controls: read, next, previous).
- `labelForCommand(id)` and `formatDurata(seconds)` — the latter enforces a product rule:
  a user is never shown raw seconds.

### 2.2 Il colore: nove sorgenti, tutto il resto derivato

`shared/theme.css` non contiene piu' due elenchi di venti colori scritti a mano (chiaro e
scuro) da tenere allineati. Contiene **nove colori** — i ruoli dell'interfaccia — e una
derivazione che ne ricava tutti i token di entrambi i temi:

```
--lastra  --muro  --inchiostro          i tre neutri
--struttura   DOVE SEI                  --accento   DOVE PUOI ANDARE
--valore  --categoria  --acquisito  --allarme       i quattro semantici
```

Cambiare aspetto = cambiare quelle nove righe. Non esiste piu' un valore che possa restare
indietro, e il tema scuro non e' un secondo elenco: e' la stessa palette letta al contrario.

**Come si deriva.** I neutri con `color-mix` (il testo secondario e' inchiostro annacquato
nel muro, non un grigio scelto a parte). Le tinte al buio con
`oklch(from var(--x) <L> c h)`: si alza la sola **luminosita'** lasciando stare tinta e
saturazione. Schiarire mescolando col bianco le spegneva — l'ottone diventava un beige
fangoso (ΔRGB 66 dal valore fatto a mano); con `oklch` lo scarto scende a 30 e sull'accento
a **8**. Il blocco `oklch` sta dentro un `@supports` perche' un valore non capito, in una
proprieta' personalizzata, **non ricade sulla dichiarazione precedente** — diventa invalido
e basta; dove manca restano le mescolanze, piu' spente ma leggibili.

**Le due regole** che una sorgente non puo' rompere: struttura e accento restano due tinte
riconoscibilmente diverse (altrimenti il bottone principale sparisce dentro la barra);
allarme resta l'unico rosso e valore l'unico oro (altrimenti i sei ruoli cromatici
collassano). La seconda e' piu' vincolante di quanto sembri: **esclude gli accenti caldi**,
perche' il caldo e' gia' occupato due volte — un accento rame finisce a ΔRGB 45 dall'allarme.

**In uso: "Sala e Deposito"**, l'originale — gesso, cemento, grafite; struttura Notte
`#284B63`, accento Verderame `#3C6E71`. Le sorgenti gia' provate stanno in coda al file,
pronte da reincollare.

**I quattro semantici erano dichiarati e non usati.** Fino al 2026-07-31 `--brass`,
`--slate` e `--tint` comparivano **zero volte** in entrambe le app, e il navigator non usava
nessuna delle quattro tinte: ogni pastiglia era grigia e il colore restava un capitolo del
foglio di stile. Ora il tono, il livello, «Privato», «Opzionale» e la parola chiave portano
l'**ardesia** della categoria, e ogni prezzo l'**ottone** del valore, in tutte e due le app.
Non e' decorazione aggiunta: sono i ruoli che il sistema gia' descriveva, finalmente accesi.

⚠️ Accendendoli e' venuto fuori un difetto di contrasto vero: `--slate` al buio stava a
`oklch(… 0.76 …)`, e dentro una pastiglia — corpo caption su `surface-2`, non sulla lastra —
faceva **4,44:1**, sotto AA. Portato a **0.8** (solo la luminosita': tinta e croma restano,
quindi l'ardesia non scivola nelle famiglie dell'oro o del rosso). Misurato, non stimato:
16 rapporti, due temi, tutti sopra 4,5:1.

**L'IRIDE — la sola eccezione al «un ruolo, un colore».** `--iride` e' i quattro semantici
in fila, e serve a una cosa sola: la visita che nasce da una frase (§4.13-bis), l'unica del
prodotto che li attraversa tutti — sceglie per categoria, e' un percorso da fare, consegna
contenuti, ha un valore. Non rompe la seconda regola della sorgente perche' nessuna delle
quattro tinte viene qui *asserita*: e' una scorsa, non un'etichetta. L'ordine e' per distanza
di tinta (oro → verde → verderame → ardesia, ~60° per gradino) e non per importanza, cosi'
si legge come piu' colori anche dentro una tessera di 40 px; con ardesia e verderame vicini,
meta' gradiente sembrava una tinta sola. Le `var()` dentro si risolvono sull'elemento che lo
usa, quindi al buio prende da se' le versioni schiarite.

Verificato in un browser vero, non stimato: 18 rapporti per tema, letti **dipingendo** i
token su un canvas e leggendone i byte. (`getComputedStyle` restituisce `oklab(…)` per i
`color-mix`, e leggerne i numeri come RGB da' nero — e' un modo perfetto per credere che
tutto sia rotto quando non lo e'.) La derivazione e' stata provata contro tre sorgenti
diverse prima di essere fissata: tutte e tre passano AA senza ritocchi.

---

## 3. Server

### 3.1 Route inventory (all under `/api`)

| Endpoint | Purpose | Consumed by |
| --- | --- | --- |
| `GET /artworks` | all artworks | marketplace editor |
| `GET /artworks/:qid/items?user=` | the **texts** of one artwork's public descriptions, gated by `access.ts` | marketplace, on expanding a description (§3.1-bis) |
| `GET /artworks/:qid/preview?level&duration` | `Match` for an artwork **outside** the current visit; falls back level+duration → level → any; **generates and persists** an LLM item if none exists | navigator QR scan |
| `GET /visits` · `GET /visits/:id` · `GET /visits/:id/items` | listing, deep-link, ordered items with `about` populated | marketplace / navigator |
| `POST /visits` | upsert by `@id`; computes `duration`, extracts `optionalItems` and `logistics` from `percorso`; validates guided-visit **key uniqueness (409)** and the **anti-loophole rule (400)**; validates the quiz | marketplace editor |
| `POST /visits/custom` | constraint-based visit generation (§3.3) | navigator |
| `DELETE /visits/:id` | delete + `$pull` from every `collezione` | marketplace |
| `GET /items` | all **public** items, texts included, `about` populated | **nobody since 2026-07-31** — kept deliberately (§3.1-bis) |
| `GET /items/metadata` | the same items **without `text`** and with `about` as a bare id | marketplace, at museum load (§3.1-bis) |
| `GET /items/author/:name` | an author's items (incl. private) | marketplace |
| `POST /items` | create (marketplace `tipo:"Item"` or Schema.org form) or **edit** (`editId`: only text+price mutate) | marketplace editor |
| `POST /items/batch` | items by id list | **nobody** (§8.1) |
| `GET /museums` · `GET /museums/:qid` · `GET /museums/:qid/config` · `/artworks` · `/visits` · `/qrcodes` | museum listing, DB doc, **config-file doc**, artworks, visits, printable QR sheet | marketplace / navigator / curator |
| `POST /users/register` · `/login` · `/:username/buy` · `GET /:username/sales` | role-scoped auth, server-side budget check, adoption/revenue report | marketplace |
| `POST /llm/newInfo` | `{previous, userReq, language}` → answer generated **directly in `language`** | navigator |
| `POST /speech` (multipart) · `POST /speech/tts` | STT → `mapRequest` → controlled command; TTS → MP3 | navigator |
| `POST /translate` | `{texts[], target}`, in-memory cache keyed `target+text` | navigator |
| `POST /wayfinding` | `{museumQid, from, target, language, detailed}` → room name (simple) or LLM-verbalized route (detailed) | navigator |
| `DELETE /items/:id` · `GET /items/:id/impact` | delete an item **with cascade** (see below); `impact` reports what would go, and writes nothing | marketplace (curatore) |
| `GET /museums/:qid/overview` · `/items` | counts + coverage; ALL items of the museum incl. private (`GET /items` hides them) | marketplace (curatore) |
| `/guided-sessions/*` | ephemeral synchronized-visit backbone (§3.4) | navigator + marketplace |
| `GET /health` | liveness | — |

**The cascade is the load-bearing part of item deletion.** An item cited by a visit cannot
vanish alone: it would leave a stop that does not resolve, and an unresolvable stop raises no
error — it simply fails to appear. So `DELETE /items/:id` also deletes every visit whose
`itemListElement` contains it, and pulls both the item and those visits out of every
`collezione`. `GET /:id/impact` exists so the UI can *state the blast radius before asking
for confirmation* rather than discovering it afterwards. Verified end-to-end on throwaway
data (8 assertions), including that an unrelated item sharing the same visit survives.

### 3.1-bis Il catalogo in due metà: i metadati e i testi *(2026-07-31)*

Il marketplace scaricava, all'ingresso in un museo, **ogni descrizione con il suo testo**. Con
tredici opere sono 138 KB e nessuno se ne accorge; con le centoquattro della Galleria degli
Uffizi diventano **832 descrizioni, circa 1,1 MB**, e nell'istante in cui arrivano non se ne
sta leggendo nemmeno una: la vetrina mostra «8 descrizioni · da gratis», cioè un conto e un
prezzo. Il testo è il **74%** del peso, e serve a una schermata sola.

Quindi il catalogo si è diviso in due, per come lo si guarda e non per come lo si taglia:

| | cosa porta | quando |
| --- | --- | --- |
| `GET /items/metadata?museum=` | tono, durata, autore, licenza, prezzo — i **metadati** della slide 21. Niente `text`, e `about` come id nudo | all'ingresso nel museo |
| `GET /artworks/:qid/items?user=` | i **testi** delle descrizioni di UNA opera | quando qualcuno ne apre una |

Misurato sul server vivo, sul Louvre: **138 KB → 36 KB** all'accesso, più **6 KB** per opera
aperta. Proiettato sugli Uffizi: **1,1 MB → 285 KB**. Il pareggio sarebbe dopo 183 opere aperte,
e nel museo ce ne sono 104 — quindi anche chi le aprisse tutte scaricherebbe meno di prima. Il
motivo è che la risposta vecchia ripeteva l'opera intera dentro ciascuna delle sue otto
descrizioni; qui l'opera si manda una volta e il client la **ricuce** (`withArtwork`), così
raggruppamento, ricerca e filtri non si accorgono di niente e non è stato necessario toccarli.

Tre cose da sapere prima di rimetterci le mani:

- **`GET /items` non è stata toccata** e risponde byte per byte come prima, per scelta esplicita.
  Oggi non la chiama nessuno: è la primitiva completa, tenuta perché una seconda strada non
  dovrebbe togliere la prima.
- **Testo assente e testo negato sono due stati diversi.** `access.ts withoutText` manda
  `text: ""` con `locked: true` a chi non ha comprato una descrizione a pagamento;
  `/items/metadata` **omette** la proprietà. Confonderli farebbe sembrare sotto chiave ogni
  descrizione gratuita. Il client distingue con `'text' in item`.
- **Il paywall vale identico sulla rotta nuova**, perché è lo stesso `readableItems` di
  `GET /items`. Provato su un database usa-e-getta con una descrizione a pagamento: anonimo →
  `text: ""` + `locked`, compratore e autore → il testo. La descrizione privata non compare in
  nessuna delle due rotte pubbliche.
- **Dopo un acquisto l'opera esce dalla cache dei testi** (`artworksWithText`): il testo poteva
  essere già stato chiesto quando ancora non si aveva diritto a leggerlo, ed era arrivato vuoto.

### 3.2 The four LLM uses (slide 31) — all present

1. **Create items for undescribed objects / missing level or length** —
   `createDescription` → `createTwistedDescription`, used by `GET /artworks/:qid/preview`
   and by the seed. Word budget is derived from the duration (~100 words/min).
2. **Free-vocabulary voice commands mapped onto the controlled set** — `mapRequest` gets
   the transcript plus the `options` labels and answers with one label, or echoes the
   request verbatim when nothing matches (which then goes to the LLM as a free question).
3. **Real-time translation** — Google Cloud Translation for DB content; LLM answers are
   *generated directly* in the target language rather than translated.
4. **Constraint-based visit generation** — §3.3.

Model: `gemini-3.1-flash-lite` for everything (`MODEL` and `MODEL_LIGHT` are the same
string). The user never sees a chat — every entry point is a form (slide 31, green rule).

**Quando il modello non risponde** *(2026-08-01, trovato esaurendo la quota gratuita: 500
richieste al giorno per modello)*. Il comando vocale restava a «Sto capendo…» e poi non
succedeva niente. Due difetti in fila, nessuno dei due dovuto alla quota:

1. **Il server rispondeva 200 con `{}`.** Il `catch` di `mapRequest` non aveva un `return`,
   quindi tornava `undefined`, che `JSON.stringify` toglie dall'oggetto: un guasto arrivava al
   client con la stessa forma di «ho capito, e non era niente». Ora `mapRequest` ritorna `null`
   quando il modello non risponde e la rotta risponde **503**. I tre casi — comando riconosciuto,
   niente da riconoscere, servizio giù — sono tre risposte diverse, perché chiedono all'utente
   due cose opposte: ripetere, oppure smettere di ripetere.
2. **Il fallimento si annunciava ma non si scriveva.** `Comando.vue` chiamava `announce()`, che
   parla solo alla regione viva: chi guarda lo schermo vedeva l'etichetta tornare a «Parla» e
   nient'altro. Ora il messaggio compare anche scritto, **senza** `role="alert"` — `announce` ha
   già detto la stessa frase, e due regioni vive la leggerebbero due volte.

Quel che resta in piedi senza Gemini: mappa, sintesi vocale, riconoscimento vocale e traduzione
(sono Google Cloud, quota separata), QR, teletrasporto, visite guidate e tutto il marketplace.
Cadono le quattro voci qui sopra: descrizioni generate, mappatura dei comandi liberi, risposte
alle domande sull'opera e visite su misura.

### 3.3 Custom visit ("su misura") — planner/resolver split

`POST /visits/custom {museumQid, request}`:

1. Load the museum catalog (`qid`, `name`, `author`, `style`).
2. `planVisit(catalog, userRequest)` returns **structured JSON** forced by a
   `responseSchema`: `{name, artworks:[{qid, tone, durationSec, twist}]}`, where `tone` and
   `durationSec` are **enums** of `educationalLevels` / `secPerArt`, so the resolver can
   always handle them. The time budget is balanced *by the model* — no server-side sum.
3. Per artwork, `resolveOrGenerateItem`: the `twist` doubles as the **reuse switch** —
   empty twist ⇒ reuse a curated DB item (level+duration → level → any), non-empty ⇒ always
   generate. Generated items are **built in memory and never persisted**.
4. Respond `{visit, content}` with `content` already joined. `level: "Su misura"`,
   `author: "AI"`. Nothing is written to Mongo, so custom visits can never leak into the
   marketplace or the selector.

Deterministic code owns correctness; the LLM owns interpretation. Same pattern as wayfinding.

**Two entry points since 2026-07-31**: the navigator's `Biglietteria` (§5.2) and the
marketplace's `sumisura` screen (§4.13-bis), which forwards the sentence rather than the
generated visit. Nothing about this route changed to support the second one.

### 3.4 Guided sessions — ephemeral, in-memory, polling

`routes/guidedSessions.ts` keeps `Map<sessionId, Sessione>` plus an `accessKey → id` index.
**No Mongo writes at all** — when the teacher ends the session, or the server restarts, it
is gone ("nessuna traccia"). Transport is **REST polling** (1.5 s), no WebSocket/SSE.

Lifecycle: `POST /` (teacher opens the room; re-opening an existing key **resets** it to a
clean waiting room) → `POST /join` (student, by key) → `POST /:id/start` →
`POST /:id/step {index}` (sets `stepStartAt` for ~simultaneous audio) →
`POST /:id/quiz/start|answer|end` → `POST /:id/end`.

Notable server-side rules:

- **Presence by heartbeat.** The student's `GET /:id/state` poll *is* the "I'm here" signal
  (`lastSeen`, `TTL_MS = 5000`). The teacher only ever sees currently-connected students.
- **Join gating.** 409 "il docente non ha ancora avviato la sala d'attesa" when the visit
  exists but no room is open; 404 when the key does not exist at all.
- **Museum scoping.** The session stores the visit's museum; joining from the wrong museum
  returns 409 "Questa visita guidata non esiste nel museo selezionato".
- **Questions are a delivery queue, not a log.** `POST /:id/ask` enqueues; the teacher's
  poll **drains** it. The teacher's *client* is what accumulates the history.
- **Quiz correction is server-side.** Students receive questions **without `correct`**;
  missing answers count as wrong; re-submission is blocked; `quiz/end` closes for everyone.
- **Temporary content access.** `GET /:id/items?username=` is the only way participants read
  the texts — including the teacher's private or paid items — and it 403s for outsiders and
  410s once the session is gone.

### 3.5 Seeding

**Rewritten 2026-07-31.** `seed.ts` is a small CLI over the config files, and it seeds **one
museum at a time**:

```
npx ts-node src/seed.ts                 elenca i musei configurati
npx ts-node src/seed.ts Q51252          semina quel museo
npx ts-node src/seed.ts Q51252 --force  rigenera anche gli item gia' scritti
npx ts-node src/seed.ts tutti           tutti i musei configurati
npx ts-node src/seed.ts speciali        le due visite dimostrative
```

Two properties decide the shape of the file, and both were forced by the fourth museum:

- **Additive.** The old `seed()` opened with `deleteMany({})` on artworks, items *and* visits,
  then rebuilt every museum. With the Uffizi in the directory that meant regenerating all
  **1144** items to add one museum — and taking every purchase and every hand-composed visit
  that points at the old ids down with them. Nothing is deleted now; each run touches only the
  museum it was asked for.
- **Resumable.** 104 artworks × 4 tones × 2 durations = **832 LLM calls** at a 6 s pause, i.e.
  roughly **two hours** (the run's own ETA settled at ~112 min). Something interrupts a two-hour
  job. An artwork already stored is not re-fetched, an item already stored is not regenerated,
  and re-running picks up where it stopped. This is what `dbActions.insert*` became upserts for:
  they create or update by `@id` instead of `create()`-ing into a duplicate-key error.
  `--force` is the way to overwrite deliberately.

Also: the image is downloaded right after its artwork instead of in a final pass, so an
interruption leaves complete artworks rather than artworks with no face. `populateArtwork` still
skips artworks with no Wikidata P18 image. `locationId` is looked up in the map (§1.1) and
re-checked on every run, so moving a node on the plan and re-seeding is enough to move an artwork.

- `seed.ts speciali` adds the two visits the homogeneous seed cannot produce, on the **first**
  configured museum: a visit with `optionalItems` (second half of the stops) and the **guided
  visit** "Visita guidata del docente" with key **`Fenice rossa`**, plus the accounts `docente1`
  (autore) and `studente1..3` (visitatore), password `12345678`.
- `seedUsers.ts` seeds the four slide-mandated accounts (`autore1`, `autore2`,
  `visitatore1`, `visitatore2`, password `12345678`), idempotently.

⚠️ **Nei testi generati manca ogni tanto l'apostrofo dell'elisione** — «L opera», «dall arte»,
«nell insieme». Misurato sui quattro musei: 5‰, 5‰, 3‰ e 7‰ delle parole, quindi è un vezzo
del modello e **non** una regressione di un seed particolare. Non c'è nessuna sostituzione nel
codice che tolga apostrofi: `createDescription` scrive quel che riceve. Si nota leggendo, e la
sintesi vocale lo pronuncia comunque bene; se un giorno dà fastidio, il posto per rimediarlo è
il prompt, non una `replace` a valle — che dovrebbe indovinare quali «l» sono articoli.
- **The guided visit now carries a quiz**, built by `data/quiz.ts` from the artworks of that
  very visit (§0.2). It is generated, not authored: no question, artwork or museum is named
  in the code, so it survives a change of museum. Three shapes — author of X, style of X,
  which work is by X — each with three distractors taken from the same museum, `Unknown`
  excluded from both answers and distractors; a shape that cannot find three distinct
  distractors is skipped rather than padded.

⚠️ **`seedSpecialVisits()` non è mai stato eseguito, e questo è il buco aperto più grave**
(misurato sul database vivo il 2026-07-30, non dedotto).

La vecchia versione di questa nota diceva che la funzione non trovava nulla perché il
database si fermava a tre toni. **Non è più vero**: il database è stato riseminato per
intero — 13 opere e **104 item per museo**, tutti e quattro i toni coperti al 100%,
`Infantile` compreso. Quindi `seedSpecialVisits()` oggi *funzionerebbe*.

Solo che non è stato lanciato, e si vede da cosa manca:

| Cosa | Nel database |
| --- | --- |
| Visite totali | 24 (8 per museo = 4 toni × 2 durate) |
| Visite con `accessKey` (guidate) | **0** |
| Visite con `quiz` | **0** |
| Visite con `optionalItems` | **0** |

Le conseguenze non sono cosmetiche:

- **il modulo I (18-27) non ha niente da mostrare.** Niente visita guidata ⇒ niente sala
  d'attesa, niente sincronizzazione, niente quiz. Il codice c'è ed è stato provato contro il
  server; è il *dato* che manca;
- l'unica visita con tappe opzionali non esiste, quindi la levetta di `Stage.vue` non ha
  dati su cui comparire;
- i nomi sono tornati quelli automatici (`Visita Infantile · 15s per opera`): dopo la
  risemina **`testers.ts nomi` non è stato rieseguito**.

Rimedio, dal 2026-07-31 in un comando: **`npx ts-node src/seed.ts speciali`**, piu'
`npx ts-node src/testers.ts nomi`. Non serve rifare il seed completo (lento: 8 item LLM
per opera).

---

## 4. Marketplace — every screen and state

> **Rewritten in the 2026-07 restyle** (`prelude.md` §7). The previous structure —
> `dashboard`/`my_collection`/`my_works` plus four stacked modals — no longer exists.

Single `x-data="appData()"` root over the `AppState` singleton
(`marketplace/src/frontend/state.ts`). **`vista` is driven by a hash router**, so every
screen has an address, the back button works, and a reload keeps its place. Alpine, its
focus and collapse plugins are **served locally** from `public/vendor/`.

### 4.1 Chrome

- **No top header.** A **left rail** (`bg-structure`) holds the wordmark, the museum
  switcher, 3–4 role-scoped destinations with `aria-current`, the wallet, the user and the
  theme toggle. Il visitatore ne ha **tre** da quando `visite` e `opere` sono una
  (`Home · Vetrina · Libreria`): sotto `lg` il binario diventa una barra in basso, dove una
  voce in meno si sente. Below `lg` it becomes a **bottom tab bar** (destinations only) plus a slim
  top bar for wallet/theme/exit.
- Le voci dell'autore dicono l'**azione** e non la categoria: `I miei contenuti ·
  Crea descrizione · Crea visita · Vendite` (2026-08-02). "Descrizione" e "Visita" da sole
  sembravano due elenchi, non due bottoni che aprono un editor.
- Two skip links (`#contenuto`, `#binario`), a `role="status"` live region fed by
  `annuncia()`, `[x-cloak]` on the root so views never render stacked before Alpine boots.
  **I salti compaiono solo dove c'e' un binario da scavalcare** (`guscioMontato()`): soglia,
  accesso e registrazione non montano il guscio, e li' i due collegamenti puntavano dentro un
  sottoalbero `display:none` — c'erano, si prendevano il primo Tab della pagina e non
  portavano da nessuna parte (2026-08-02).
- **Only two overlays remain**: the confirm dialog and the toast. Everything that used to be
  a modal is now a page.

### 4.2 `soglia` — the front door *(new)*

Full-bleed `bg-structure`. `ART AROUND.` at `text-hero` in Bricolage Grotesque over
**lo sciame** (`swarm()` in `app.ts`): a cloud of ~6–13k particles that assembles, one after
another, the **artworks actually on sale here**, holds a few seconds, then flows into the
next. The figures come from a halftone screen of the real images — the curator picks which
and in what order via `server/src/data/soglia.json` → `GET /api/config`, and **no qid appears
in the marketplace**, so genericity holds; without the file it falls back to the first six of
the catalogue. Motion is an eased interpolation along bowed paths (`left.md` §0-bis, eighth
pass); `prefers-reduced-motion` composes one figure and stops.

Two doors: `Entra` and `Guarda com'è fatta una visita` (opens the navigator with no account —
free visits only). Nothing is asked before something is shown. Since 2026-07-28 the screen
carries **no university strapline and no theme toggle** — the toggle did nothing visible
here, `bg-structure` being the same in both themes.

### 4.3 `accedi` / `registrati`

Login takes **username + password only** — the role is resolved server-side. The role
question survives in exactly one place: a `300` response listing both profiles, rendered as
two *described* choices. Registration keeps the role as a real decision, again as two
described panels. Every field has a **visible label**; errors are `role="alert"` blocks that
name the fix.

### 4.4 `musei`

The mandatory multiple-choice panel (slide 20), now shown **once** and remembered in
`localStorage`; afterwards it is a switcher in the rail. Cards show name, location and
`N opere · M visite` — the QID is gone from the UI.

### 4.5 `home` — visitor home

Three doors: **Scegli una visita pronta** → `visite`, **Componi il tuo percorso** →
`componi`, **Ho una parola chiave** (inline field → `POST /guided-sessions/join`, then a
deep link to the navigator's waiting room). Below, a **Riprendi** strip of owned visits with
`Inizia` directly on each row. No list of 300 cards on arrival.

Called `banco` until 2026-07-28; the route, the rail item and the page title are all `home`
now. "Banco di lavoro" survives only where it means the *editor's* workbench.

### 4.6 `vetrina` — un posto solo, due specie dentro *(riunita 2026-07-31)*

Erano due schermate, `visite` e `opere`, con due ricerche e due serie di filtri. Ora una
sola, con **due sezioni intitolate**: le visite (copertina tipografica, `N tappe · N min`,
livello, curatore, prezzo, e l'azione piu' forte disponibile — `Inizia` / `Completa` /
`Sblocca`) e le opere (immagine con passe-partout, `N descrizioni · da € X`, con le
descrizioni della stessa opera **raggruppate**, che e' il modo in cui reggono le 104 del
Louvre). I due mazzi di carte restano diversi perche' dicono cose diverse: una visita si
compra e si percorre, un'opera e' un contenitore di descrizioni.

Ricerca e filtri sono **una serie sola** (`market*` in `state.ts`): due copie tornerebbero a
divergere. La specie e' un controllo segmentato *Tutto · Visite · Opere*; scegliendola le
intestazioni di sezione spariscono, perche' a quel punto le ripeterebbero il controllo.

**La durata la calcola sempre il server, prima di scrivere**, sommando i `timeRequired` degli
item davvero trovati. Due punti in cui non era cosi', e una visita a tappe di lunghezza
diversa dichiarava un totale che le sue tappe non fanno: `POST /visits` faceva
`payload.duration ?? somma`, cioe' si fidava di un totale mandato dal client, e
`/visits/custom` sommava la durata **pianificata** invece di quella dell'item trovato —
mentre `resolveOrGenerateItem` ripiega su un item di qualunque lunghezza quando quella voluta
non esiste.

**Perche' i filtri prima non filtravano**, misurato sul database vivo e non dedotto:

| Difetto | Ora |
| --- | --- |
| Fasce di durata `< 30` / `30-60` / `> 60` min: **tutte e 9 le visite cadevano nella prima**, cioe' due opzioni su tre restituivano zero e la terza tutto | soglie tarate su quel che `Visit.duration` misura davvero, cioe' minuti di **lettura**: `meno di 5 min` · `da 5 a 15 min` · `oltre 15 min`. Stanno in **una tabella sola** (`VISIT_DURATION_BANDS`), etichetta e predicato nella stessa riga cosi' non possono dire due cose diverse; il confronto e' `banda.test(min)`. Quando la durata contera' anche il cammino fra le sale si rialzano quei tre numeri e non serve toccare altro |
| `availableLevels()` accodava qualunque valore trovato, quindi **`Personalizzata` compariva come quinto livello** (§7.3 lo aveva previsto) e sceglierlo dava una visita sola | solo i quattro toni veri: `Personalizzata` e `Su misura` sono etichette di *provenienza*, non livelli |
| Il livello confrontava `Visit.level`, un campo solo — una visita composta a mano che mescola i toni non si trovava sotto nessuno di essi | si confrontano i **toni delle tappe** (`visitTones`), piu' la voce **`Misto`** per i percorsi che ne hanno piu' d'uno. Una visita a due toni si trova sotto `Misto` **e** sotto ciascuno dei due |
| La durata era un filtro solo per due grandezze diverse | **contestuale**, come nel catalogo del curatore (§4.15): minuti per le visite, i due secondi veri (`secPerArt`) per le descrizioni, e su *Tutto* non compare, con una riga che dice perche' |

I due indirizzi vecchi **rispondono ancora** e arrivano con la specie gia' scelta:
`#/visite` apre la vetrina sulle visite, `#/opere` sulle opere. Erano scritti in giro per
l'app e in qualunque segnalibro, e un indirizzo che smette di funzionare rimanda alla soglia
senza spiegare niente.

### 4.8 `opera/<qid>` · 4.9 `visita/<id>` — pages, not modals

**`opera`** — two columns: matted image + painter/style left; the descriptions as a list of
plaques right, each with tone, length, author, licence, price and one action. Owned rows
**expand in place** (`x-collapse`) to reveal the text: no navigation, no overlay.
**`visita`** — metadata, the strongest action first, the access key when guided, and the
**percorso** as a numbered list with the **logistics notes rendered between the stops they
belong to**; the ones anchored to nothing (`after: null`) **open** the list rather than
trailing it, because that is where the navigator plays them. Quiz shown with the correct
answer marked (author's view).

### 4.10 `libreria` (visitor) / 4.11 `lavori` (author)

Same component, different sets, each titled with *what it contains*. `libreria` groups
**Visite first** (they're actionable) then Descrizioni. `lavori` shows only the author's own
production, with adoption counts, the guided visit's key, `Sala d'attesa`, and a
**`Stampa i QR delle opere`** link (previously a URL only we knew about).

### 4.12 `nuovo` — item editor

Artwork → **tone** (four described choices) → duration → text → price → licence → private.
A live **`stimaLettura()`** ties the written text back to the declared duration. In edit mode
the frozen fields are shown as read-only facts with one shared reason.

**L'opera si vede mentre la si descrive** *(2026-08-02)*. Sceglierla da un menu a tendina la
riduceva a un titolo, e il testo che si sta scrivendo parla di un quadro: da `lg` in su la
schermata e' a due colonne e la seconda tiene l'immagine **appiccicata in alto**, perche'
serve proprio quando si e' scesi fino al testo, cioe' quando la tendina e' gia' fuori schermo.
Sotto `lg` la stessa scheda apre la pagina ma **non** e' appiccicata: fra lei e la barra di
salvataggio, che sta incollata in basso, su un telefono non resterebbe schermo per scrivere.
`draftArtworkFacts()` salta autore e stile quando valgono `Unknown` — e' il valore che
Wikidata lascia scritto, e stamparlo fa sembrare rotta una scheda solo incompleta.

### 4.13 `componi` — visit workbench

Three steps: **Percorso · Impostazioni · Quiz**. Step 1 is two panes ≥`lg` (the percorso
being built, always visible, beside the searchable library) and two tabs below. Timeline rows
carry the stop number, ▲▼ keyboard-safe reorder, an `aria-pressed` **Opzionale** pill and
remove; **logistics notes are visually distinct rows with no number** — they aren't stops.
A sticky bar states `validazioneVisita()` **as text** at all times, and the publish button
says `Attiva la visita guidata` when guided — it is not published to the marketplace.

**I tre passi sono una strada, non tre schede** *(2026-08-02)*. Il bottone della barra
pubblica **solo dall'ultimo passo**; prima porta al successivo (`Continua · Impostazioni`,
poi `Continua · Quiz`). Prima si poteva pubblicare dal percorso senza avere mai aperto le
impostazioni, cioe' con nome, livello, prezzo e licenza mai guardati. Qual e' l'ultimo passo
dipende dalla visita: il quiz esiste solo per le guidate, e `nextVisitStep()` e' l'unico posto
che lo sa. Le linguette in cima restano cliccabili — sono navigazione, e bloccarle
imprigionerebbe chi sta modificando una visita gia' fatta.

### 4.13-bis `sumisura` — la visita descritta a parole *(nuova 2026-07-31)*

Un campo di testo, tre esempi da toccare, e un bottone che apre il navigator. È l'ingresso
alla generazione su vincoli (§3.3) dal lato in cui la gente arriva: prima esisteva **solo**
nella biglietteria del navigator, che un giorno sparirà.

**Due porte, e si aprono l'una sull'altra.** Dalla home del visitatore, e da dentro il
compositore manuale (§4.13), dove una striscia in cima offre la strada a parole *prima* che
uno cominci a scegliere le tappe a mano — l'invito non compare in modifica, perché
manderebbe via da un lavoro già aperto. Nel senso opposto, la riga che avverte che la visita
non si salva rimanda al compositore, che è il modo per tenerne una. Sono le due metà dello
stesso atto: comporre scegliendo, o comporre descrivendo.

**Porta la frase, non la visita.** Una visita su misura non viene scritta nel database
(§3.3) e le due applicazioni stanno su due origini diverse: non c'è modo di passarsela. Il
collegamento è quindi `?museum=…&custom=<frase>&user=…` e a comporla è il navigator, una
volta sola. Generarla qui per mostrarne un'anteprima darebbe un percorso **diverso** da
quello poi eseguito — il modello non risponde due volte allo stesso modo — e l'anteprima
sarebbe una bugia.

La schermata dice per esteso che la visita non si salva in libreria, perché il marketplace
è il posto in cui le cose si tengono e un oggetto che sparisce va dichiarato prima, non
scoperto dopo.

**Il marchio è l'iride** (§2.2): tessera con la scintilla, filo sul bordo, bottone che avvia
— tre segni, gli stessi tre in tutti e tre i punti da cui ci si arriva, e in nessun altro
posto dell'app.

⚠️ **L'interfaccia non nomina mai l'intelligenza artificiale**, per scelta: dice cosa
succede («il percorso nasce da lì», «la trovi già composta», «le opere vengono scelte fra
quelle di X»), non da quale macchina. È la regola del progetto — si nomina ciò che la
persona controlla e riconosce, non come è costruito il sistema — e vale anche qui, dove la
tentazione di vantare il meccanismo è massima. Nella documentazione e all'esame si chiama
col suo nome; sullo schermo no.

### 4.14 `gestione` / 4.15 `catalogo` — le due schermate del curatore *(nuove 2026-07-30)*

> La rotta si chiamava `curatela` per mezza giornata. **Non usare quella parola**: in
> italiano *curatela* è un istituto giuridico — l'amministrazione dei beni di un incapace, o
> la procedura fallimentare — e non ha niente a che vedere con i musei. `curatore` invece è
> il termine corretto e resta il nome del ruolo. Il vocabolario dell'interfaccia è parola
> d'uso comune: `#/gestione`, «Gestione del museo».

**`gestione`** — quattro cifre (opere, descrizioni, visite, visite guidate), poi la parte che
serve davvero: **la copertura**. Una barra per tono, «quante opere hanno almeno una
descrizione in quel tono»: non è una statistica, è lavoro da assegnare a un autore, e un tono
fermo a zero si colora d'allarme perché vuol dire che nel museo quel tono non esiste. Sotto,
l'elenco delle opere senza nessuna descrizione, e in coda il totale degli account registrati.

**`catalogo`** — una tabella di tutto quel che esiste nel museo, **descrizioni private e
visite guidate comprese**, che negli altri elenchi non compaiono per costruzione. Colonne:
titolo, tipo, autore, tono, **durata**, prezzo, azione. Ricerca più quattro filtri — tipo,
tono, autore, durata — conteggio dei risultati in `role="status"`, `Elimina` su ogni riga.
La conferma **dichiara la cascata per esteso** e il bottone resta disabilitato finché
`GET /items/:id/impact` non ha risposto: non si chiede di confermare una cosa di cui non si è
ancora detta la portata.

⚠️ **La colonna durata non è decorazione: senza, la tabella è ambigua.** Una descrizione è
unica per (opera, autore, tono, **durata**), e il seed produce 4 toni × 2 durate: ogni riga ha
quindi una gemella identica in titolo, tipo, autore, tono e prezzo. Prima di aggiungerla, le
due righe della Gioconda/Infantile erano indistinguibili a schermo — e l'azione disponibile è
un'eliminazione irreversibile. Per lo stesso motivo le descrizioni mostrano i **secondi
esatti** (`15 s`, `60 s`) invece di `formatDuration()`, che le appiattirebbe entrambe su
«meno di 1 min»/«1 min»: è un'eccezione voluta alla regola «mai secondi nudi», dichiarata in
testa a `state.ts`. Le visite restano in minuti.

Il **filtro durata è contestuale**: compare solo scegliendo *Descrizioni* (le due durate reali,
da `secPerArt`) o *Visite* (fasce in minuti), e si azzera al cambio di tipo. Su *Tutto* non
compare, con una riga che dice perché — i secondi di una descrizione e i minuti di una visita
non si filtrano con le stesse soglie, e un filtro unico sarebbe una trappola.

> **Perché non c'è un «utenti collegati».** Era la prima richiesta, ed è stata scartata per
> un motivo strutturale: **il sistema non ha sessioni** (la persistenza è stata rimossa per
> volontà esplicita, §0.2). Il server non sa chi è entrato, quindi qualunque numero di
> «online» sarebbe inventato. Gli account si contano, ma sono **iscritti, non collegati**.
>
> Un pannello «sale guidate aperte» (presenza reale, dal battito degli studenti) è stato
> **costruito e poi rimosso** nella potatura: costava ~120 righe su quattro file, duplicava
> quel che il docente già vede nella *sua* sala, e non era dimostrabile perché nel database
> non esiste una visita guidata (§3.5). Se un giorno serve una vista di museo, il pezzo
> mancante è solo `listSessionsForMuseum` — recuperabile da git.

### 4.16 `vendite`

Real `<table>` with `scope`, tabular figures, museum-scoped totals. Free content shows
adoptions with revenue `—`: the revenue of free content isn't `€ 0,00`, it doesn't exist.

---

## 5. Navigator — every screen and state

> **Rewritten in the 2026-07 restyle** (`prelude.md` §8). `MainView`/`Map`/`Card`/
> `OptionsBar`/`Selector` no longer exist.

### 5.1 Entry and configuration

`App.vue` loads **`public/config.json`** first — `{museumQid, museumTitle, apiBase}`, the
"file di configurazione" of slides 25/33. This removed the hardcoded `Q6373` and every
`localhost` literal (`apiBase()` falls back to the page's own host on port 8000, so opening
the navigator from a phone on the LAN works). Then it branches five ways: guided student /
guided teacher / `?visit=` deep link / **`?custom=<frase>`** / normal entry.

`?custom=` carries the *sentence* a visitor typed in the marketplace (§4.13-bis) and is
composed here through `POST /visits/custom`, because a custom visit is never written to the
DB and cannot be handed across origins. It takes ~6 s, so the opening screen says
`Stiamo componendo la tua visita…` rather than `Apertura del museo…`.

### 5.2 `Biglietteria` — visit selection

An **elenco** of visits (name, `N tappe · N min · livello`), with livello and durata demoted
to filters that can no longer produce a dead end. The visit list is **ownership-aware**
(`GET /museums/:qid/visits?user=`): guided visits never appear, and without a user only free
ones do. Below a rule, the **su misura** block with example chips.

### 5.3 The visit runtime

- **Progress rail** — `Esci`, visit name, **`Tappa 3 di 13`** (counting only the stops
  `Prossimo` will actually reach) and a 2px progress line.
- **`Stage`** — `Mappa` and `Elenco` are **peers**, toggled by a segmented control and
  remembered. Map stops are **numbered discs** drawn onto the SVG (`getBBox`, re-run when the
  map becomes visible again), each a real keyboard target with `aria-label` **and** an SVG
  `<title>`. Optional stops keep the three-signal encoding. The `TODO TEMP` is gone: the
  toggle appears only when `optionalCount > 0`.
- **`Scheda`** — the bottom sheet, three snaps (`riposo`/`media`/`piena`). Only at `piena`,
  and only below `lg`, does it become `role="dialog"` and mark the stage `inert`; from `lg`
  it is a side column and never modal. Inside: matted image, badges, description, then
  `Pannello`, the language selector, and a **permanent microphone** in the footer. The
  open/close control is a pill with a rotating chevron, not a caption.
- **`Pannello`** — the controlled vocabulary as buttons, split **Chiedi** (artwork questions
  → LLM) / **Orientati** (building questions → room graph), with the answer (`Info`) below.
  One component, **two mounts**: inside the sheet at `piena`, and behind the **Chiedi**
  button in the visit rail — which is the one that satisfies slide 28's "bottoni equivalenti
  ai comandi vocali" without requiring a sheet to be opened first. Questions work from the
  current stop even with the sheet closed (`riferimento`: the open artwork, else the last
  stop reached, else the first).
- **Logistics transitions** — pressing `Prossimo` when the author left a note for that
  passage shows it as a step before the next stop (opening notes appear before stop 1).
  This is `Visit.logistics` finally reaching the person it was written for.
- **`Posizione`** — one entry, four ways: scan the QR, **type the code** (the tab is
  disabled with a stated reason outside a secure context), **`Trovami`** (the advanced
  localization of slide 33), and **`Teletrasporto`** (slide 34).
  **The teleport module moves the position and does nothing else** — it opens no card and does
  not advance the visit, because declaring where you stand and choosing what to read are two
  different acts; it is the same distinction that keeps opening a stop from moving the marker.
  It is the only control that moves the position with no sensor, and that is the point: from
  there `Trovami` runs the real equation, so the localization module is demonstrable indoors,
  with no printed sheets and without crossing a museum.
  Measured against the three real maps, not assumed: landing on a node, `Trovami` picks that
  same artwork and is confident enough to open it directly in **39/39 cases**, worst case 98%.
  A compass can only sharpen this — the angular term is skipped for the work you are standing
  on (`metri > 0.5`) and only adds cost to the others.

  **The jump is made by touching the plan** (2026-07-31; it used to be a list of the stops).
  The tab holds one button that **arms** the mode and closes the panel — which would otherwise
  cover the thing you have to touch — and a strip declares it until the touch lands or it is
  cancelled (button or `Esc`). Single-shot, and announced: an invisible mode would let a
  distracted tap silently move the position everything else is reasoned from. While armed the
  stops change trade rather than disappearing — a map node or a list row **places** instead of
  opening — so one act has three ways in: the plan for whoever looks, a stop for the
  **predetermined position** the slide asks for, the list for whoever cannot aim at a point.
  Why it was worth rewriting: a free point is the **only** way to reach the ambiguous branch
  indoors — from a node `Trovami` always wins outright (39/39), so the chooser, half of the
  slide-33 module, could never be shown. Landing between two works is what makes it appear.
  The estimate of where the visitor *physically stands* lives in `src/localization.ts` and is
  **not** a second notion of "where I am" beside the open card: opening a card never moves it,
  and only a declared act re-anchors it (QR, typed code, choosing among the candidates — and,
  when it exists, the teleport module). The marker and its heading cone move on the map on
  their own; they never open anything. The card opens only on a press, and when it does, the
  logistics note written for that passage is shown first, through the same `transition` step
  `Prossimo` uses — the slide's second purpose for localization.
  One equation decides, with no branch per platform: each artwork costs
  `(distance/σ_d)² + (angle/σ_θ)²`, `σ_d` being the accuracy the *device itself* declares and
  `σ_θ` 30°. Where there is no compass (every desktop: no magnetometer in the hardware) the
  angular term simply is not in the sum, the probabilities flatten and the picker appears —
  orientation is not dropped, it is *absent*, and the formula already says what that means.
  Verified against the real map before shipping: 2 m from a work with the compass on it, 93%;
  midway between two, no winner; a compass with a 300 m fix stays at 15%, i.e. **a compass
  alone never manufactures confidence**.

### 5.4 `GuidedGate`

Four phases. **`attesa`** is a full-bleed stage with the access key at `text-display` — it
gets read aloud across a room. **`attiva`** puts class-level commands in a *conduzione bar*
separate from visit controls, with one panel sheet instead of two overlapping asides;
joins, leaves and questions are announced.

**`quiz`** is now implemented on both sides. The teacher's `Quiz` button (present only when
the visit has one) opens a sheet with a duration picker — the slide wants the teacher to
size the test against the time left — and starting it switches every device at once. The
teacher then gets a **live board**: submissions landing one by one, each with its score out
of the total, plus `Chiudi il quiz` and `Termina per tutti`. The student gets the questions
with radio options, a countdown, one submission (`giaConsegnato` blocks the second) and the
mark. **Nothing is corrected client-side**: the answers go up as indices and the score comes
back. The countdown is informative only — the deadline the server enforces is `quizEndsAt`.

**`terminata`** distinguishes *the teacher ended it* from *the session vanished*, and now
usually reads as the former: the server keeps the session 30 s in `terminata` so the poll
can report a *planned* close instead of a 410. It shows the student's mark, and offers
**Torna alla home** beside "Scegli un'altra visita".

### 5.5 Cross-cutting

`useTTS` (server-side synthesis, request-id guarded), `useTranslation` (lives in `Visita` so
`Leggi` reuses the translated text), `useAnnouncer`, `useSTT`, `useTheme` — the last one
wired to the toggle in `Biglietteria`'s utility row, which is also where the mandatory link
back to the marketplace lives (both were lost with the deleted `Header.vue` and restored
there: during a visit every pixel belongs to the map).

---

## 6. End-to-end flows (open this, then that)

> ⚠️ **F1, F2, F3, F5 and F6 still use the PRE-restyle screen names** (`dashboard`,
> `my_collection`, `my_works`, `MainView`, `Card`, `OptionsBar`, the modals). The *steps* are
> still right, the *names* are not: §4 and §5 were rewritten in the restyle and this section
> was not. Read it for the sequence, read §4/§5 for what things are called. Same caveat
> applies to the inventory in §11. F4 is current.

**F1 — Visitor buys and runs a visit.**
`login` (role=visitatore) → `select_museum` → `dashboard` → artwork card → artwork modal →
`Sblocca` → confirm modal → toast → `my_collection` → visit card → detail modal →
(`Sblocca N item mancanti` if needed) → `Inizia la visita ➜` → **navigator**
`?museum&visit` → visit bar + `MainView` → map node / list row → Card → `Opzioni` →
`OptionsBar` → LLM answer or wayfinding in `Info` → `Prossimo` … → `Cambia visita`.

**F2 — Visitor composes their own visit.**
`dashboard` → `Crea Percorso` → (optionally "Parti da una visita gratuita esistente") →
library artwork card → artwork modal → `+ Aggiungi` → reorder ▲▼ / mark `Opzionale` / add
logistics notes → `Salva nei miei Percorsi` → `my_collection` → detail → `Inizia la visita`.

**F3 — Author publishes an item.**
`login` (role=autore) → `select_museum` → `my_works` → `+ Nuovo Contenuto` → Item mode →
artwork + tone + duration + text + price + licence (+ 🔒 private) → `Pubblica sul
Marketplace` → `my_works` → later `Vendite` for adoptions and revenue.

**F4 — Teacher runs a synchronized visit (module 18-27).**
Author: editor → Visita → 🔑 guided + key + (quiz) → publish → `my_works` → `▶ Avvia
(docente)` → **navigator** `?guidedVisit&role=docente` → waiting room.
Student: `dashboard` → "🔑 Hai una parola chiave?" → key → join (409 if the room is not open
yet, 409 if the wrong museum, 404 if the key does not exist) → "Vai alla sala d'attesa →" →
**navigator** `?guidedSession&role=studente` → waiting → teacher presses `Avvia visita` →
both sides run the visit, the teacher's `Prossimo` pushing the step to everyone → teacher
opens `Quiz`, picks a duration, `Avvia il quiz` → every device switches to the questionnaire
while the teacher watches the marks arrive → `Chiudi il quiz` → `Termina per tutti` →
students read state `terminata` from their next poll and see "La visita è finita" with their
mark. **Nothing persisted**: the session, the answers and the marks die with it.

**F5 — Custom visit from constraints (18-33).**
Selector → free-text box → `POST /visits/custom` → planner → per-artwork resolve/generate →
`{visit, content}` injected client-side → visit starts. Nothing is written to the DB.

**F6 — QR localization (18-33).**
Curator opens `GET /api/museums/:qid/qrcodes`, prints the sheet, puts one QR beside each
artwork. Visitor: `Scansiona QR` → in-app decode → if the artwork is in the visit, jump to
that stop; otherwise fetch `/artworks/:qid/preview` (generating the item if needed) and show
it flagged "Non fa parte di questa visita", leaving visit progress untouched.

---

## 7. Improvements — flow changes that stay within the slides

Ordered by value. Each is a *flow* change, not a repaint; several are also prerequisites for
a clean restyle.

### 7.1 Close the remaining spec hole (blocking, not optional)

- ~~**Quiz UI in the navigator.**~~ **DONE 2026-07-28** — both screens, plus a generated quiz
  on the seeded guided visit. See §0.2 and §5.4.
- ~~**Advanced localization.**~~ **DONE 2026-07-30** — `src/localization.ts` (frame, anchor,
  the confidence equation), `composables/useSensors.ts` (geolocation + compass, tilt included),
  the `Trovami` tab with the picker, and the position marker on the map. See §5.3 and §1.1.
- ~~**Teleport module.**~~ **DONE 2026-07-30** — built as the fourth tab of `Posizione.vue`
  rather than as a per-stop action, so it keeps its own label and cannot be mistaken for a
  side effect of opening a stop. It differs from what this entry proposed in one way that
  matters: it does **not** reuse `goToArtwork` (QR's path), because that would also open the
  card. Teleport only calls `reanchor()`; reading is left to `Trovami`. See §5.3.

  Fixing it surfaced a real defect in `reanchor()`, which is why the two changes ship
  together: it carried the old `lat`/`lon` into the new anchor, but `applyFix` writes that
  pair **only once**, on the first fix ever. So the next fix measured its delta from the
  session's first reading and re-applied every metre of drift since — sliding the visitor off
  the point they had just declared, and doing the opposite of the header's promise to "buttare
  via la deriva accumulata". Nulling the pair makes the next useful reading re-establish the
  reference at the declared point. This bit QR and the typed code too, on any device with a
  GPS; it was invisible on a desktop, where no fix ever arrives.

### 7.2 Show the logistics indications during the visit

`Visit.logistics` is authored in the marketplace, stored, and displayed in the marketplace
detail modal — but **the navigator never reads it** (`grep logistics navigator/src` → no
hits). Slide 21 defines a visit as "una sequenza di descrizioni di item **più indicazioni
logistiche**… per passare da un item all'altro". Proposal: render the notes as
**inter-stop steps** — after `Prossimo`, if a note is attached between stop *n* and *n+1*,
show it as a short transition panel (readable by TTS like any other text) before the next
Card. This also answers `missing.txt`'s two open questions ("come mantenere ordine",
"come visualizzare le note logistiche") and needs a small model change: notes currently lose
their position in the sequence (§9.6).

### 7.3 Replace the level×duration selector with a visit list

Today the navigator's Selector is a cross-product of two dropdowns and only starts when an
**exact** (level, duration) pair matches. Consequences: visits sharing a pair are
unreachable; user-created visits pollute the dropdowns with `Personalizzata` and raw totals
like `195`; and the visit's *name* — the thing a person recognizes — is never shown.
Slide 25 only asks for "selezione di una delle molteplici forme di visita disponibili".
A list of visit cards (name, level, duration in minutes, number of stops) with the two
dropdowns demoted to *filters* is strictly closer to the requirement and removes an entire
class of dead ends. (`missing.txt` line 7 already reads "rimuovere il selettore dal
navigator".)

### 7.4 Make the navigator aware of ownership

The navigator will start **any** visit whose id it is given, including paid visits the user
never bought and **guided visits, which it lists in the Selector like any other**
(`getVisitsByMuseum` returns everything, `accessKey` included). The marketplace carefully
gates "Inizia la visita" behind `visitaUtilizzabile`, and the whole point of `accessKey` is
that a guided visit is *not* freely playable — both guarantees evaporate one URL later.
Minimal fix (security is not graded, but *coherence* is): have the selector list only
non-guided visits, and have the navigator receive the acting user so the visit list can be
restricted to owned/free content. This is a flow fix, not hardening.

### 7.5 Give the visit a visible progress state

The visit bar shows level and duration but never *where you are*. Since `stepIndex` already
knows which stops count, a "Tappa 3 di 13" marker (excluding skipped optional stops, mirrored
to the live region) is nearly free and is the single most useful thing that bar could say.
`stylespec-v2.md` §6.3 already specifies it.

### 7.6 Translate the interface, not only the content

Content translation is complete, but the on-screen equivalents of the voice commands
(`OptionsBar`), the Card buttons and every status message stay Italian even when the visitor
picked 中文. The slide's phrase is "gli stessi identici contenuti verranno ascoltati in
italiano da italiani, in cinese da cinesi" — the chrome is arguably out of scope, but a
Chinese visitor facing a grid of Italian buttons undermines the feature that is otherwise
fully implemented. The controlled vocabulary is a single small array; adding a `labels`
map per language in `shared/constants.ts` keeps `mapRequest` anchored to the Italian ids
while showing translated labels.

### 7.7 Use `stepStartAt` for the synchronized audio

The server computes `stepStartAt` specifically so every student's device can start the audio
at the same instant ("trasmette gli stessi contenuti **allo stesso tempo** a tutti gli
auricolari"). The navigator never reads it: `autoRead` is hardcoded `false` and each student
presses play individually. Honouring `stepStartAt` (schedule `tts.speak` at that timestamp
for students in an active guided visit) turns a documented design into an actual, very
demoable feature.

### 7.8 Order custom-visit stops spatially

`planVisit` chooses the artworks but nothing constrains their *order*, so a generated visit
can zig-zag across the museum — already flagged in `missing.txt` and still open. The room
graph is right there: after planning, re-order the chosen artworks by BFS distance from the
entrance POI. Deterministic code fixing a deterministic problem, in the same spirit as the
existing planner/resolver split.

### 7.9 Smaller flow wins

- **Announce filter results** in the marketplace ("12 risultati") — the live region exists,
  it just isn't used for the most frequent state change on the busiest screen.
- **Label the publish button correctly for guided visits** — it still reads "Pubblica sul
  Marketplace" for something that is deliberately never published there (`missing.txt`).
- **Link the QR sheet from the UI.** `GET /api/museums/:qid/qrcodes` is a graded deliverable
  reachable only by typing the URL. One "Stampa i QR delle opere" link in the author area
  makes it discoverable and demoable.
- **Author revenue filters** (per period) — requested in `missing.txt`, currently absent.

---

## 7-bis. La passata di semplificazione del 2026-07-30

Fatta dopo un censimento di tutto il codice. Le due cose che *sembravano* il problema —
`state.ts` a 1656 righe e `index.html` a 1620, il 24% del progetto in due file — sono state
lasciate stare: funzionano, sono navigabili per sezioni, e spezzare i template di Alpine è
rischio senza guadagno. Il problema vero era un altro.

**`state.ts` non era troppo grande: era senza tipi.** 94 righe con `any`, cioè il compilatore
spento proprio nella metà del marketplace che *potrebbe* essere controllata (l'altra metà,
i binding di Alpine, non lo può essere per costruzione). La causa era una sola: `Content =
Item | Visit` non era distinguibile, quindi ogni accesso a un campo di una sola delle due
metà veniva aggirato con un `as any[]`. Rimedio: tre guardie in `shared/types.ts`
(`isVisit`, `isItem`, `isArtwork`), che si distinguono per un campo **obbligatorio** e non per
`@type`. Poi `visits` è diventato `Visit[]` (la rotta restituisce solo visite) e i cast sono
caduti da sé. **94 → 55**, e i 55 che restano sono parametri di richiamo genuinamente
polimorfi.

Cosa ha trovato il compilatore appena riaccesso, che nessuno aveva visto:

- **`@type` non esiste nei tipi condivisi**, ma il client lo usava per filtrare
  (`v["@type"] === "ItemList"` in `shownVisits`, `importableVisits`, `itemName`, `itemDetail`).
  Funziona solo perché lo schema Mongoose ha un `default`: un documento inserito per altra via
  **sparirebbe dal catalogo in silenzio**. Ora si usa il narrowing.
- Il catalogo delle opere costruiva un **item finto** (`{about: g.artwork, "@type":
  "CreativeWork"}`) solo per riusare `matchesSearch` su un'opera. Con le guardie l'opera si
  passa così com'è.
- `filteredSales()` passava una riga di vendita a `belongsToMuseum`, e funzionava **solo perché
  cadeva nel suo ramo altrimenti**. Ora ha il suo confronto, di due righe.
- `percentualeCopertura` dereferenziava `overview` senza controllo: l'unica cosa che lo
  proteggeva era un `x-if` in una stringa Alpine che nessuno verifica.

**Le dieci espressioni Alpine lunghe (90–137 caratteri) sono diventate metodi.** Non è
estetica: quella è logica in stringhe che nessun compilatore guarda, ed è la classe di difetto
che in questo progetto è già costata una funzione intera. **10 → 0.**

E spostandole è venuto fuori un difetto vero, esattamente quello previsto dall'avvertenza in
testa a `state.ts`: la schermata di scelta del profilo titolava
`r === 'autore' ? 'Autore' : 'Visitatore'` — un ternario binario più vecchio del terzo ruolo —
e mostrava quindi **«Visitatore» sopra la descrizione del curatore**. Trovato rendendo la
schermata per davvero, non leggendola.

Altro, minore: `MONGO_URI` era ricopiato in quattro punti d'ingresso, ora sta in `env.ts`;
rimossi `chosenArtwork`/`chosenArtworkName`, morti dal restyle.

**Non fatto, deliberatamente:** accorpare i cinque `catch` identici di `llm.ts` («meglio
leggere codice lungo che generalizzare la cosa sbagliata»), spezzare `index.html`, toccare
`swarm()` (692 righe, ma isolate e tarate numericamente).

## 8. Useless things — code that can be removed or shrunk

### 8.1 Dead endpoints (no client anywhere)

| Route | Note |
| --- | --- |
| `GET /api/artworks/:qid/items` | superseded by `/preview` and by `/visits/:id/items` |
| `POST /api/items/batch` | no caller; the marketplace resolves ids from already-loaded lists |
| `GET /api/museums/:qid` | the navigator uses `/config`, the marketplace uses the list |

Removing the three deletes ~50 lines and one duplicated populate block. (`shared/types.ts`
already carries the reminder "debloatare alcune routes".)

### 8.2 Dead files and build artifacts

- `marketplace/dist/backend/{server,database}.js` and `marketplace/dist/frontend/*.js` —
  output of a **removed** marketplace backend and of an older `outDir` layout. `index.html`
  loads `/dist/marketplace/src/frontend/app.js`; these are never served.
- `server/dist/index.js` (+ map) — 44 bytes from March; the server runs through `ts-node`.
- `navigator/dist/` — a June `vite build` output, root-owned; the navigator runs on the dev
  server. `.gitignore` covers `dist/`, so all of the above are untracked local litter, but
  they actively mislead anyone reading the tree.
- `navigator/tailwind.config.js` and `marketplace/tailwind.config.js` — **0 bytes**.
  Tailwind v4 is configured in CSS; both files are vestigial.
- `<div id="dropDown"></div>` in `navigator/index.html` — nothing teleports into it.

### 8.3 Dead imports and functions

- `server/src/services/llm.ts` imports `ItemModel` and `insertArtwork` — **neither is used**
  (and `insertArtwork` creates a needless `llm ↔ dbActions` import cycle).
- `server/src/dbActions.ts` imports `fetchArtwork`, `createDescription` and `downloadImage` —
  all unused (`createTwistedDescription` is the one actually called).
- `server/src/seed.ts`: `testArtworks` (18 QIDs) and `printStored()` are unreferenced.
- `marketplace/src/frontend/state.ts`: the `else` branch of `contenutiFiltrati()` builds the
  author's dashboard list, but **authors have no `dashboard` entry in the navbar** — the
  branch is unreachable. `trovaItem`'s `i._id === id` fallback is likewise never exercised
  (every caller passes an `@id`).
- `useMediaRecorder.ts` exports `audioUrl` and keeps an object URL alive for a playback UI
  that does not exist; only `finalBlob` is consumed.

### 8.4 Duplication worth collapsing

- **`MONGO_URI` fallback string** is repeated verbatim in `index.ts`, `seed.ts` and
  `seedUsers.ts`. One `env.ts` export would do.
- **The theme toggle button markup** appears **three times** in `marketplace/public/index.html`
  (floating, mobile navbar, desktop navbar) with the two SVGs inlined each time — ~40 lines
  of exact duplication. An Alpine `x-template`/component collapses it to one.
- **The filter toolbar** (search + type control + difficulty + duration) is copy-pasted
  across `my_works`, `dashboard`, `my_collection` and the editor library — four near-identical
  40-line blocks driven by three parallel triples of state fields
  (`filtroTipo|Diff|Durata` × `Lavori|Collezione|Dashboard`). A single toolbar template
  parameterized by a filter-state object would remove ~120 lines of HTML and 9 fields.
- **The ordered-populate block** (`find({$in: ids}).populate(about)` then re-order by
  `itemListElement`) is written twice, identically, in `routes/visits.ts` and
  `routes/guidedSessions.ts`. One helper.
- **Theme bootstrap**: the anti-FOUC script exists twice (both `index.html`s) and the
  marketplace additionally defines its own `themeToggle` Alpine component **inline in
  `<head>`** — already flagged in `missing.txt` ("spostare lo script … a un qualche file js").
- **The token blocks** in `navigator/src/assets/main.css` and
  `marketplace/src/frontend/style.css` are byte-identical for ~60 lines. Since the restyle
  will change every value, factor them into one shared CSS file **before** the restyle, or
  the two apps will drift on day one.

### 8.5 Over-specified constants

`options` contains four near-synonymous content commands (`Non ho capito`, `Sintetizza`,
`Approfondisci`, `Semplifica`) that map onto two axes (longer/shorter, harder/simpler). The
slides list "dimmi di più / dimmi di meno / non capisco / troppo semplice" so all four are
defensible — but the *panel* renders 13 buttons in one column, which is the main reason the
options panel feels cluttered. Grouping them as two paired controls is a restyle decision to
make consciously rather than inherit.

---

## 9. Odd parts — things that are wrong, misleading, or awkwardly written

### 9.1 `spec.md` is stale in ways that will mislead the restyle

- It states **"Marketplace = solo contenuti a pagamento — DONE"** and refers to
  `state.ts:itemGratuito`. The code does the **opposite**: free items *are* listed and a
  price segmented control (Tutte/Gratis/A pagamento) was added; `itemGratuito` no longer
  exists.
- It says the navigator side of guided visits is "**NON toccato**" and lists the quiz as
  navigator-pending; the sync half is in fact fully implemented (`guided.ts`,
  `GuidedGate.vue`) — only the quiz is missing.
- §1 claims the three seeded tours are "British Museum Q6373, 13 artworks each, author
  `autore1`" created **through the API**; `seed.ts` creates unauthored visits named
  `Visita <livello> · <durata>s per opera`, and `seedSpecialVisits` adds two more. The DB may
  well contain both, but the file describes a state the code cannot reproduce.

### 9.2 `stylespec-v2.md` targets screens that no longer exist

§7.1 specifies a `welcome` view with two role panels and §7.2 specifies `login_autore` /
`login_visitatore` as separate views. The marketplace has **one** `login` view with a role
segmented control, and no `welcome` at all. The rest of the document (tokens, charter,
components, navigator §6) still applies; that section needs rewriting against §4 of this
file before anyone implements from it.

### 9.3 The quiz can be authored and served but never taken — **CLOSED 2026-07-28**

> Closed, in all three of its parts. `guided.ts` carries the quiz state for both roles,
> `api.ts` wraps the three endpoints, `GuidedGate.vue` has the two screens, and the seeded
> guided visit now gets a generated quiz (§0.2, §3.5, §5.4). One thing this entry did *not*
> foresee: `GET /visits/:id` was handing the whole `quiz` array — `correct` included — to
> every student's browser, since that is the route the navigator uses to load a guided
> visit. It now `select("-quiz")`s; the questions reach students only through the session,
> already stripped.

The original finding, kept for the reasoning: `grep -rn "quiz" navigator/src` returned
**nothing**. Concretely:

- `guided.ts` types `Stato = "attesa" | "attiva" | "terminata"` while the server's real
  enum includes `"quiz"`. If the teacher ever hit `POST /:id/quiz/start`, every client would
  fall into `GuidedGate`'s `v-else` and display **"Visita terminata"** mid-visit.
- `api.ts` has no wrapper for the three quiz endpoints, and the student state's `quiz`
  payload is dropped by `applyStudentState`.
- The seeded guided visit has **no quiz**, so the slide-34 requirement ("almeno una visita …
  ha un test sensato di competenza alla fine") is unmet twice over.

It was the single largest gap between what the backend could do and what the product did.

### 9.4 Two disjoint vocabularies for the same field

`Item.educationalLevel` is written by the editor from a **hardcoded** array
`['infantile','semplice','medio','avanzato']` (capitalized on save), while
`shared/constants.ts:educationalLevels` is `["Principiante","Intermedio","Avanzato"]` and
drives the seed, the LLM planner enum, the marketplace difficulty menu and the navigator's
level dropdown. The two sets overlap on exactly one value (`Avanzato`): a hand-authored item
is `Medio` while every seeded item at the same depth is `Intermedio`. Consequences: the
difficulty filter offers up to **five** values for what is one axis, the planner's enum can
never select three of the four authored tones, and `/artworks/:qid/preview` falls through its
level match whenever the visit's level came from the other vocabulary. `missing.txt` notes it in passing ("vanno
rivisti i toni nei seed"); it is a data-model defect, not a naming preference. Note also
that the slides' own example uses *infantile / semplice / medio / avanzato*, so the
**editor** is the one following the assignment and `constants.ts` is the one to reconcile.

### 9.5 Seeding a fresh database silently produces no museums

`completeSeed()` has `// await seedMuseums();` commented out (`seed.ts:310`). Everything
downstream — the marketplace's museum panel, `GET /:qid/config`, wayfinding — needs the
`Museum` documents. A newcomer running the documented command gets artworks, items and
visits, an empty museum panel, and no obvious reason why. Related: the three seed entry
points connect and `disconnect()` in sequence rather than sharing one connection, and
`seed()`'s `finally` disconnects before `seedDownload()` reconnects.

### 9.6 Logistics notes lose their position in the sequence

The editor's timeline interleaves item stops and logistics notes, but `POST /api/visits`
splits them into two independent arrays (`itemListElement`, `logistics`). Reloading a visit
for editing rebuilds "prima gli item, poi le note" — the author's ordering is **silently
destroyed**, as the code comment admits. Any implementation of §7.2 has to fix this first;
the cheapest fix is to store an index (or to store `logistics` as `{after, text}`).

### 9.7 `Map.vue`'s optional-stops toggle is shipped in a debug state

```
<!-- TODO TEMP: ripristinare v-if="optionalCount > 0" (visibile per test senza dati) -->
<label v-if="matchedContent.length > 0" …>
  Includi le {{ optionalCount }} tappe opzionali
```

On any visit without optional stops the user is offered "**Includi le 0 tappe opzionali**".
`seedSpecialVisits` now creates a visit that *does* have optional stops, so the reason for
the workaround is gone — the `TODO TEMP` can simply be reverted.

### 9.8 Environment values hardcoded across all three parts

| File | Value |
| --- | --- |
| `navigator/src/api.ts:3` | `API_BASE = "http://localhost:8000/api"` |
| `navigator/src/state.ts:124` | map fetched from `http://localhost:8000` |
| `navigator/src/components/map/Card.vue:30` | `MEDIA_ORIGIN = "http://localhost:8000"` |
| `navigator/src/App.vue:17` | `DEFAULT_MUSEUM_QID = "Q6373"` |
| `navigator/src/components/Header.vue:11` | marketplace at `<host>:8000` |
| `marketplace/src/frontend/state.ts:808, 843, 856` | navigator at `<host>:5173`, three times |

The deploy target is a department docker host, so `localhost` is wrong there by definition;
and the two apps hardcode each other's ports in **five** places. The `DEFAULT_MUSEUM_QID`
constant is also the one remaining piece of museum-specific code in an app whose selling
point is genericity — the default should come from the config layer (e.g. the first museum
returned by `GET /api/museums`), not from a literal.

### 9.9 `visitaUtilizzabile` treats unknown items as owned

`itemsMancanti` maps ids through `trovaItem` and then `.filter(it => it && !haIlPossesso(it))`
— an id that resolves to `null` (e.g. a **private** item, which `GET /api/items` excludes)
silently drops out of the "missing" list. A visit containing content the client cannot see is
therefore reported as fully usable. It does not bite today (guided visits are the only ones
with private items and they are not purchasable), but the failure mode is silent and the
guard reads as if it checks the opposite.

### 9.10 Server TypeScript is effectively unchecked

`server/tsconfig.json` sets neither `strict` nor `skipLibCheck`, and its `include` is
`["src/**/*"]` although every file imports from `../../shared/*` (outside the program;
`ts-node` resolves it anyway). Meanwhile `tsc --noEmit` on the server reports one error —
inside `@google/genai`'s own `.d.ts`, for an optional MCP peer dependency — which
`skipLibCheck: true` would silence. Navigator and marketplace both type-check clean; the
server is the only part with no real type safety, and it is where the domain logic lives.

### 9.11 Naming and small infelicities

- `dbActions.ts` exports **`intertMuseum`** (typo for `insertMuseum`), used as such by
  `manager.ts`.
- ~~`server/src/data/museumContent.ts` keys are **wrong**~~ — **CLOSED 2026-07-31**, the file
  is deleted. It read `uffizi: Q19675` (the Louvre), `louvreab: Q6373` (the British Museum),
  `britishMuseum: Q160236` (the Met): every key named a different museum than the one it held.
  Museums are now keyed by qid out of the config directory, so there is no name to lie.
  Worth keeping in mind for the presentation: the real Uffizi (`Q51252`) is the fourth museum,
  and until this file went away its name was taken by the Louvre.
- `marketplace/package.json` → `"name": "markeplace"`.
- `stt.ts` → `const transcrtiption`.
- `manager.ts:populateItem` decides "generate a description" from `if (!itemAuthor &&
  !description)` and then reassigns both parameters — three call shapes tangled into one
  signature with two optional out-params.
- `Info.vue`'s prompt strings contain typos that go straight to the model
  ("Spiegalo con parole **diverese**", "Dimmi di piu' su **l'autore**").
- `shared/constants.ts` command ids are written without accents/apostrophes
  (`"Che stile e?"`, `"Dove e il bagno?"`) because id and label must be identical — so the
  *user-visible* labels are misspelled Italian. Decoupling label from id (§7.6) fixes both
  problems at once.
- `AppState.wallet` is initialized to `100.0` in the class body even though the real value
  always arrives from the login response — a phantom budget visible for one frame.
- `marketplace/public/index.html` is a **1097-line** single file holding eight views and four
  overlays; `state.ts` is **1316 lines** in one class. Both are navigable today only because
  the section comments are good. Before the restyle multiplies the markup, splitting the
  views into Alpine `x-template` partials (still framework-free, still one page) is close to
  a prerequisite.

### 9.12 The build step that is easy to forget

`marketplace/dist` is **not** rebuilt by anything except `npm run build --prefix
marketplace` (which `docker-compose` does run, but a manual `npm run start` in `server/`
does not). Right now `dist/…/state.js` is dated **2026-07-20** while `src/frontend/state.ts`
is dated **2026-07-27**: the served marketplace is a week behind the source. Any restyle
session must run the marketplace build after every change, or it will be debugging code that
isn't running.

---

## 10. Compatibility defects — verified, and all three fail silently

> **10.1 and 10.2 are closed**; 10.3 is half-closed (the typed code exists, §5.3). The entries
> stay because the *rule* each states still holds.

These are not style opinions and not "odd parts": they are **defects that make working
features stop working** on a platform or in a situation we do not currently test. All three
share the same shape — no exception, no error in the console, no visible breakage during
development on a Linux laptop over `localhost`. They are listed here rather than in §9 because
each needs a code fix, not a rewrite.

### 10.1 Voice commands are broken on Safari / iOS — **CLOSED 2026-07-30**

> Closed by replacing the capture, not by negotiating the format. **`useVoce.ts` is now
> `useSTT.ts`** — it is the listening half and belongs beside `useTTS.ts`, the speaking one;
> older notes (§0.1, `left.md`) still use the old name. It no longer uses
> `MediaRecorder`: it takes raw samples off the Web Audio API (`AudioContext` →
> `createMediaStreamSource` → `createScriptProcessor`), averages them down to 16 kHz mono and
> writes its own WAV header; `api.ts` uploads `recording.wav`; `stt.ts` declares
> `LINEAR16` / `STT_SAMPLE_RATE`. **One path on every browser, no branch per platform** — an
> `if (Safari)` would have had to contain this same code *plus* the old one, since no format
> Safari can produce is decodable server-side.
>
> The sample rate now lives in `shared/constants.ts` as **`STT_SAMPLE_RATE`**, imported by
> both ends. It is not tidiness: this defect *was* the client and the server disagreeing about
> the audio format, and two copies of the number would let it recur in the same silent way.
>
> Two things to know before touching it. **`resume()` must stay inside the user gesture** or
> iOS records silence from a suspended context; and the processor node must stay connected to
> a **zero-gain** node into `destination` — it does not run if it reaches no destination, and
> reaching the speakers directly would feed the microphone back into the room.
>
> Verified: 23 assertions on the two pure functions (48000 and 44100 → 16000, tone preserved
> at 879/880 zero-crossings, amplitude within 0.001, every header field, data size, clipping
> saturating instead of wrapping) — including that averaging attenuates a 15 kHz tone from
> 0.566 to 0.044 rms where plain decimation would have let it back in disguised as a 1 kHz
> tone that was never spoken. **Not verified: an actual iPhone**, and the round trip to Google
> (no running server at the time). The Safari claim remains reasoning until someone records a
> command on iOS.
>
> Unchanged, because it does not depend on the format: `getUserMedia` still needs a secure
> context, so over `http://<lan-ip>:5173` there is still no microphone (§10.3).

**What happened.** On any iPhone or on macOS Safari, pressing "Comando vocale", speaking and
releasing produces no command and no error. The announcer says "Comando non riconosciuto" at
best.

**Why.** The recorder never negotiates a format and the whole pipeline then *asserts* one:

| Where | Code |
| --- | --- |
| `navigator/.../speech/useMediaRecorder.ts:24` | `new MediaRecorder(stream)` — no `mimeType` requested |
| `navigator/.../speech/useMediaRecorder.ts:34` | `new Blob(audioChunks, { type: "audio/webm" })` — the blob is **labelled** webm regardless of what was actually recorded |
| `navigator/src/api.ts:153` | uploaded as `"recording.webm"` |
| `server/src/services/stt.ts:14` | `encoding: "WEBM_OPUS"`, `sampleRateHertz: 48000` — hardcoded |

Safari's `MediaRecorder` (since 14.1) emits **MP4/AAC**, not WebM/Opus. So the container is
mislabelled client-side and then decoded server-side as something it is not; Google STT
returns no alternatives and `mapRequest` receives an empty transcript. The source comment at
`useMediaRecorder.ts:22-23` ("Safari might fallback to mp4 … MediaRecorder handles it mostly")
is the assumption that produced the bug.

**Why it matters.** Controlled-vocabulary voice input is a **black, mandatory** requirement of
the 18-24 base (slide 25), and the navigator is explicitly *"pensata per smartphone"* — so the
feature is broken on the device class the slides name as primary. Roughly half of any exam
audience opening the demo on an iPhone sees a dead button.

**Fix — and format negotiation is *not* enough.** Google STT v1 accepts `LINEAR16`, `FLAC`,
`MULAW`, `AMR`, `AMR_WB`, `OGG_OPUS`, `SPEEX_WITH_HEADER_BYTE`, `WEBM_OPUS`, `MP3` — and
**nothing else**. There is no AAC/MP4 encoding, so *no* format Safari's `MediaRecorder` can
produce is decodable server-side. Negotiating the mime type would just move the failure.

The working fix is to stop using `MediaRecorder` for this and capture PCM directly: Web Audio
(`AudioContext` → `createMediaStreamSource` → a processor node) collecting `Float32`, downsampled
to 16 kHz mono and written into a WAV header client-side, uploaded as `LINEAR16` /
`sampleRateHertz: 16000`. One code path on every browser, no negotiation, no mislabelled
container, and it deletes the class of bug entirely. Cost: ~60 lines and an uncompressed upload
(a 5-second command ≈ 160 KB — irrelevant on a LAN). Note `AudioContext` needs `resume()` inside
the user gesture on iOS, which the existing tap already provides.

### 10.2 The marketplace stops existing without a CDN — **CLOSED**

> Closed by the 2026-07 restyle: Alpine and both plugins are vendored in
> `marketplace/public/vendor/` and loaded by relative path, pinned at 3.15.0. The entry is
> kept because the *rule* it states — zero external requests at runtime, in either app — is
> still the rule.


**What happens.** With no route to `cdn.jsdelivr.net`, the marketplace loads its own CSS and
its own compiled JS, and then renders **every view at once, stacked**, with no working control
— because without Alpine, `x-data`, `x-show`, `x-if` and `@click` are inert attributes. It
does not error; it just becomes a very long dead page.

**Why.** `marketplace/public/index.html:40-41` loads both `@alpinejs/focus` and `alpinejs`
from jsDelivr. They are the only runtime dependencies not served by our own server — Tailwind
output, the compiled TS and the shared types are all local.

**Why it matters.** The deploy target is a **department docker** and the written exam machines
are described in the slides as isolated from the internet. A demo that depends on a third-party
host being reachable and unblocked from a university network is a risk taken for no benefit,
and the failure mode gives no clue about its cause.

**Fix.** Vendor both files into `marketplace/public/vendor/` and load them with relative paths
(pin the version while doing it — `alpinejs@3.x.x` currently floats). Same principle for any
future font: **zero external requests at runtime, in either app.**

### 10.3 QR localization has no path for a blind visitor — and no fallback at all

**What happens.** The only way to tell the navigator "I am standing in front of this artwork"
is to aim a phone camera at a QR code taped beside it.

**Why it matters, twice over.**

- **Accessibility.** Aiming a camera at a small printed square is precisely the task a blind or
  severely visually impaired person cannot perform — in an app whose whole purpose is to
  *speak* to that person. This is not a corner case: it is the product's most sympathetic user
  meeting its most visual interaction.
- **Compatibility.** `getUserMedia` is unavailable outside a secure context, so opening the
  navigator over a LAN IP (`http://192.168.x.x:5173` — the normal way to test on a real phone)
  disables the camera. `useQRScanner.ts:21-24` does detect this and shows *"Fotocamera non
  disponibile (serve https o localhost)"*, so at least it is honest — but there is nothing
  behind that message.

**The half-solution already on paper.** `GET /api/museums/:qid/qrcodes` already prints the
artwork's `qid` under each QR (`routes/museums.ts:128-135`) — but as an 11px grey caption,
styled as a label rather than as something a human is meant to read out or type, and **the
navigator has no field to type it into**.

**Fix.** One input closes both gaps: promote that code on the printed sheet (short, uppercase,
large, high contrast) and accept it typed in the navigator, next to — not instead of — the
scanner. Note for the implementation: it must be a single pasteable field, never split across
character boxes, and never timed (WCAG 2.2 **3.3.8 Accessible Authentication**). Reusing the
raw QID is possible but poor (`Q137925932` is ten characters of database leakage, cf. §9.11);
a short per-museum code is better.

---

## 11. Quick reference for the restyle

**Every marketplace surface to style**: `login`, `register`, `select_museum`, `dashboard`,
`my_collection`, `my_works`, `editor` (item mode / visit mode / guided extras / quiz editor /
library / timeline), `sales`; overlays: artwork modal, detail modal (item view / visit view /
quiz preview), confirm modal (3 variants), toast; chrome: navbar (2 responsive rows, 2 role
variants), floating theme toggle, footer; states: empty lists ×4, protected content, error
toasts, disabled editor fields.

**Every navigator surface to style**: Header (+ mobile dialog menu), Footer, Selector
(language combobox, 2 dropdowns, custom-visit block with loading/error), visit bar, Map
(SVG well, active/current/optional node styles, artwork list, optional toggle, empty state),
QR FAB, QR dialog (live / error), Card (image / broken / absent, 2 notice variants, nav
buttons with disabled ends, TTS states), OptionsBar (4 groups, recorder idle/recording/
processing/error), Info (loading / answer / error / "Indicazioni dettagliate"), GuidedGate
(waiting-teacher, waiting-student, active bar with 3 side panels, **quiz-teacher board**,
**quiz-student form / submitted / time-out**, ended), the command panel as a modal, and the
end-of-visit screen.

**Do not break**: the `.dark`-class token mechanism and the shared `artaround-theme` key; the
skip link and both live regions; the SVG map nodes as real keyboard targets **and** the
parallel non-spatial list; the three-signal encoding of optional stops; focus trapping on
every overlay; the ban on `alert`/`confirm`; `aria-current` on the active nav tab.
