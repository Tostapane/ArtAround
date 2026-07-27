# ArtAround — `state.md`

**Complete state of the system as of 2026-07-27.**

> Purpose. This document is the *starting point for the restyle*. It therefore has to be
> exhaustive about **what screens exist, in what states, reachable from where** — not just
> about architecture. Sections 1–6 describe the system as built; sections 7–9 are the
> analysis requested: **Improvements**, **Useless things**, **Odd parts**.
>
> Relationship to the other docs:
> - `slides.pdf` — the assignment. Authoritative for *requirements*.
> - `spec.md` — the durable dev reference. **Partly stale** (see §9.1); where the two
>   disagree, this file reflects the code as actually read on 2026-07-27.
> - `stylespec-v2.md` — the visual direction for the restyle. Its per-screen walkthrough
>   (§7.1–7.2) describes screens that **no longer exist** (see §9.2).
> - `missing.txt` — the team's running to-do / open questions between the two developers.

---

## 0. Executive summary

| Band | Requirement | State |
| --- | --- | --- |
| 18–24 (base, mandatory) | marketplace+editor, navigator with visit selection/execution, map, TTS, on-screen text, controlled-vocabulary voice commands + equivalent buttons | **Complete**, except **logistics indications are never shown in the navigator** (§7.2 / §9.3) |
| Module I (18–27) | teacher-synchronized visit + end-of-visit quiz | Sync: **complete end-to-end**. Quiz: **server + authoring done, navigator UI absent → the quiz cannot be taken** (§9.3) |
| Module II (18–33) | QR localization, **teleport module**, deep LLM integration | QR: done. LLM (4 uses): done. **Teleport: not started** (§9.3) |

Two blockers remain for the declared 18-33 target: **the quiz has no navigator UI**, and the
**teleport module does not exist**. Everything else is in place and type-checks cleanly
(`vue-tsc` and `tsc` both pass on all three parts).

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
navigator/ :5173       Vue 3 + Vite + TS + Tailwind v4 + headlessui/vue. Own dev server.
marketplace/           Alpine.js (CDN) + vanilla TS compiled by `tsc` + Tailwind CLI.
                       No bundler. Served by the server.
```

- **No framework** in the marketplace ✔ (Alpine + vanilla TS, one 1097-line `index.html`).
- **A framework** in the navigator ✔ (Vue 3, `<script setup>`, no router, no store library).
- **Node-only server** ✔; MongoDB only ✔; two docker containers (`mongo:7.0` + `node:22`) ✔.
- **Genericity** ✔: no museum-specific code anywhere. A museum = a DB document + a JSON
  config in `server/src/data/museums/` + an annotated SVG in `server/public/maps/`.

### 1.1 The genericity mechanism (the heavily-weighted criterion)

Three museums are configured, each with a real Wikidata QID, a generated JSON config and a
hand-annotated SVG floor map:

| Config file | qid | rooms / artwork nodes / POIs / edges / obstacles in the SVG |
| --- | --- | --- |
| `British Museum.json` | `Q6373` | 6 / 14 / 6 / 5 / 3 |
| `Metropolitan Museum of Art.json` | `Q160236` | 7 / 14 / 7 / 9 / 4 |
| `Museo del Louvre.json` | `Q19675` | 7 / 14 / 7 / 6 / 4 |

The **SVG map is the single spatial source of truth**. The curator annotates the map they
already draw; `services/svgGraph.ts` parses it into a room graph. The contract:

- `data-room="Nome"` on a circle/rect/polygon → a room **area**. A node's room is the area
  that **contains** it (point-in-region, document order, first match wins) — so walls are
  respected rather than mere proximity.
- `data-qid="Qxxx"` → artwork node (centre = position). `data-poi="exit|emergency_exit|
  toilet|bar|shop|elevator|stairs"` `[+ data-label]` → POI node.
- `data-obstacle="steps|door|chairs|object"` + `data-desc` → obstacle.
- `<line data-edge …>` → link between the two rooms containing its endpoints.

Connectivity is **authored only** — no geometric adjacency is inferred — so every walkable
space (corridors included) must be a `data-room`. Single floor per map.

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
  (subset), `logistics` (string[]), `author?`, `accessKey?`, `quiz?`.
  `accessKey` present ⇒ **guided visit**: free, not purchasable, not listed to visitors.
- **QuizQuestion** — `{question, options[4], correct}`. `correct` never leaves the server.
- **User** — identity is the **pair `(username, role)`** (unique compound index). An
  `autore` and a `visitatore` with the same username are *distinct, unlinked accounts*.
  `wallet` exists only on visitors; `collezione` is the owned-content id list.
  Password stored in clear (security is explicitly not graded).
- **Match** — `{artwork, item}`; the join is done **server-side**, never in the client.

The four slide-mandated metadata are covered: **lunghezza** (`timeRequired`), **linguaggio**
(`educationalLevel`, 4 tones), **autore** (`author`), **licenza** (`license`).

### 2.1 Constants (`shared/constants.ts`)

- `educationalLevels = ["Principiante","Intermedio","Avanzato"]` — used by the seed, the
  custom-visit planner enum and the marketplace difficulty filter. **The editor's tone
  buttons use a different, hardcoded set** (`infantile/semplice/medio/avanzato`) — see §9.4.
- `secPerArt = [15, 60]` — seed durations and planner enum.
- `licenses[5]`, `SOURCE_LANG = "it"`, `languages[13]` (name + translate/tts/stt codes,
  only fully-supported languages).
- `options: CommandOption[]` — the **controlled vocabulary**, single source for both the
  on-screen buttons and the LLM voice mapping. Each entry carries a `surface` tag:
  `"panel"` (rendered by `OptionsBar`) or `"card"` (`Prossimo`/`Precedente`, rendered as the
  Card's navigation buttons). `id` and `label` must stay identical — `mapRequest` matches on
  labels, handlers compare ids.

---

## 3. Server

### 3.1 Route inventory (all under `/api`)

| Endpoint | Purpose | Consumed by |
| --- | --- | --- |
| `GET /artworks` | all artworks | marketplace editor |
| `GET /artworks/:qid/items` | items of an artwork | **nobody** (§8.1) |
| `GET /artworks/:qid/preview?level&duration` | `Match` for an artwork **outside** the current visit; falls back level+duration → level → any; **generates and persists** an LLM item if none exists | navigator QR scan |
| `GET /visits` · `GET /visits/:id` · `GET /visits/:id/items` | listing, deep-link, ordered items with `about` populated | marketplace / navigator |
| `POST /visits` | upsert by `@id`; computes `duration`, extracts `optionalItems` and `logistics` from `percorso`; validates guided-visit **key uniqueness (409)** and the **anti-loophole rule (400)**; validates the quiz | marketplace editor |
| `POST /visits/custom` | constraint-based visit generation (§3.3) | navigator |
| `DELETE /visits/:id` | delete + `$pull` from every `collezione` | marketplace |
| `GET /items` | all **public** items, `about` populated | marketplace |
| `GET /items/author/:name` | an author's items (incl. private) | marketplace |
| `POST /items` | create (marketplace `tipo:"Item"` or Schema.org form) or **edit** (`editId`: only text+price mutate) | marketplace editor |
| `POST /items/batch` | items by id list | **nobody** (§8.1) |
| `GET /museums` · `GET /museums/:qid` · `GET /museums/:qid/config` · `/artworks` · `/visits` · `/qrcodes` | museum listing, DB doc, **config-file doc**, artworks, visits, printable QR sheet | marketplace / navigator / curator |
| `POST /users/register` · `/login` · `/:username/buy` · `GET /:username/sales` | role-scoped auth, server-side budget check, adoption/revenue report | marketplace |
| `POST /llm/newInfo` | `{previous, userReq, language}` → answer generated **directly in `language`** | navigator |
| `POST /speech` (multipart) · `POST /speech/tts` | STT → `mapRequest` → controlled command; TTS → MP3 | navigator |
| `POST /translate` | `{texts[], target}`, in-memory cache keyed `target+text` | navigator |
| `POST /wayfinding` | `{museumQid, from, target, language, detailed}` → room name (simple) or LLM-verbalized route (detailed) | navigator |
| `/guided-sessions/*` | ephemeral synchronized-visit backbone (§3.4) | navigator + marketplace |
| `GET /health` | liveness | — |

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

- `seed.ts` `completeSeed()` = `seed()` + `seedDownload()` + `seedSpecialVisits()`.
  **`seedMuseums()` is commented out** (line 310) — a fresh DB therefore has *no museums*
  unless that line is re-enabled or the function is run by hand (§9.5).
- `seed()` wipes artworks/items/visits, then per museum: `populateArtwork` (skips artworks
  with no Wikidata P18 image, so every stored artwork is displayable), then one LLM item per
  (level × duration) with a **5 s delay** between calls, then one visit per (level ×
  duration) containing *every* artwork of that museum.
- `seedSpecialVisits()` adds the two visits the homogeneous seed cannot produce: a visit
  with `optionalItems` (second half of the stops) and the **guided visit** "Visita guidata
  del docente" with key **`Fenice rossa`**, plus the accounts `docente1` (autore) and
  `studente1..3` (visitatore), password `12345678`.
- `seedUsers.ts` seeds the four slide-mandated accounts (`autore1`, `autore2`,
  `visitatore1`, `visitatore2`, password `12345678`), idempotently.
- **The seeded guided visit has no quiz** — so even the authoring side of Module I is not
  demonstrated by a fresh seed (slide 34 asks for "un test sensato" on at least one
  synchronized visit).

---

## 4. Marketplace — every screen and state

Single `x-data="appData()"` root over the `AppState` singleton
(`marketplace/src/frontend/state.ts`, 1316 lines). `currentView` is the router; overlays are
independent booleans. Login-first: nothing is reachable while `currentUser === null`.

### 4.1 Global chrome

- **Live region** (`sr-only`, `role="status"`) announcing `etichettaVista()` on every view
  change.
- **Floating theme toggle** when logged out; **in-navbar toggle** when logged in
  (duplicated for the mobile and desktop rows).
- **Navbar** (`x-show="currentUser !== null"`): wordmark tile "A" + "ArtAround" (button →
  `tornaHome()`), museum pill with "Cambia" (≥ sm), role-scoped nav (only when a museum is
  selected), a **role indicator** (🖋️ Autore / 👤 Visitatore — *not* a switch), wallet
  (visitors only), theme toggle, "Esci".
- **Overlays**, all with `x-trap.inert.noscroll` + Esc + click-away: artwork modal
  (`z-105`), detail modal (`z-100`), confirm modal (`z-110`), toast (`z-120`).
- **Footer**: "ArtAround Suite © 2026".

### 4.2 View: `login` (entry point)

Branding block ("ArtAround." + "MANAGEMENT & DISCOVERY"), card with username, password, and
a **role segmented control** (`role="group"`, default *Visitatore*) — the role is part of
the credentials and **fixes the interface for the session**. `Accedi` submit + "Registrati
ora". Errors arrive as an error toast.

### 4.3 View: `register`

Back link, username, password, confirm, the same role control ("Tipo di account", carried
over from the login form), `Crea Account`, "Hai già un account? Accedi ora". Client
validation: non-empty + matching passwords. Server: 409 if `(username, role)` exists.

### 4.4 View: `select_museum` (mandatory green requirement, slide 20)

Grid of museum cards (🏛️ tile, name, location, qid, "Entra →"). Empty state: "Nessun museo
disponibile…". Selecting sets `museoSelezionato` and lands on the role home. Auto-selected
when exactly one museum exists. **Everything downstream is filtered by
`ofMuseum === http://www.wikidata.org/entity/<qid>`**, including items (via `about.ofMuseum`).

### 4.5 View: `dashboard` (visitor marketplace)

1. Title + hint banner pointing at "Crea Percorso".
2. **Toolbar**: search (`ricerca`), type segmented control (Tutti/Item/Visite), difficulty
   `<select>`, per-artwork duration `<select>`, price segmented control
   (Tutte/Gratis/A pagamento). Menu options are derived from the data actually present in
   the selected museum (`difficoltaDisponibili()`, `durateDisponibili()`).
3. **Guided-visit entry box** — "🔑 Hai una parola chiave?" → `POST /guided-sessions/join`.
   On success it shows a confirmation line plus **"Vai alla sala d'attesa →"**, a deep link
   to the navigator (`?guidedSession&role=studente&user`). This is the *only* student
   entrance to a guided visit.
4. **Content grid**: one **card per artwork** (image, name, "N contenuti") — the scale
   answer to "centinaia o migliaia di contenuti" — plus separate **visit cards** (author,
   price, `Dettagli`, `Sblocca`/`Posseduto ✅`).

Filtering pipeline: `contenutiFiltrati()` = museum scope → `visibileNelMercato` (hides other
people's guided visits) → text search → `filtraAvanzato` (type/difficulty/duration) → price.

### 4.6 View: `my_collection` (visitor)

Same shape, own search + type/difficulty/duration filters, source = **owned** content
(`haIlPossesso`: own creations + `collezione`). Compact artwork cards + visit cards; a visit
card opens the detail modal directly.

### 4.7 View: `my_works` (author)

Same layout as the collection but a **different data set**: only the author's *own
production* — their items (`mieOpere`, private included) and their visits — never anything
adopted from others. Visit cards additionally expose **"▶ Avvia (docente)"** when the visit
has an `accessKey`: the deep link that opens the navigator as teacher.

### 4.8 View: `editor` (items and visits)

One form, two modes; the type toggle is author-only (a visitor can only build visits).

**Item mode** (author): artwork `<select>` (museum-scoped), price (hidden when private),
license `<select>`, **"🔒 Tieni privato"** checkbox, tone buttons
(infantile/semplice/medio/avanzato — already-used tones disabled), duration, text area.
**In edit mode** (`editingId`) everything except text and price is disabled, with an
explanation of why (identity, rights and visibility must not change under existing owners).

**Visit mode**: title; **"🔑 Visita guidata"** checkbox + unique key field (author only,
locked in edit mode); **quiz editor** (add/remove questions, 4 options each, radio for the
correct one) shown only for guided visits; price (hidden for guided); license (author only);
**"Parti da una visita gratuita esistente"** import (copies the stops; for an author it
becomes the base of a *new guided* visit, for a visitor a personalized one — the original is
never touched); item library (card-per-artwork, search, Tutti/Posseduti e gratis/Da
acquistare for visitors, difficulty and duration filters); "+ Aggiungi Nota Logistica"; and
the **timeline** with position number, ▲▼ reorder, name or free-text logistics input,
"Opzionale" toggle (`aria-pressed`), remove.

Client validation before publishing: artwork chosen, non-negative price/duration, tone
chosen, non-empty text, no duplicate tone; for visits: title, **at least one item**, and for
guided visits a key plus only free/owned items plus complete quiz questions.

### 4.9 View: `sales` (author)

Adoption/revenue table (`Contenuto | Tipo | Licenza | Prezzo | Adozioni | Ricavo`), museum
scoped, with totals. Adoptions are **derived** from `User.collezione` — no duplicated
counter anywhere.

### 4.10 Overlays

- **Artwork modal** (`artworkAperto`): lists that artwork's already-filtered items; the
  action per row depends on the current view — `dashboard` → Ottieni/Sblocca € / "Posseduto
  ✅"; `editor` → "+ Aggiungi" / "✓ Aggiunto"; `my_collection`/`my_works` → "Apri".
- **Detail modal** (`modalDettaglio`): image, level/reading-time, text (or "Contenuto
  Protetto…" when not owned); for visits the clickable stop timeline (with "Opzionale"
  badges), logistics notes, and the **quiz preview with the correct answer marked** (author
  view). Footer: curator + licence, then contextually `✏️ Modifica`/`🗑️ Elimina` (own
  content), `Ottieni gratis`/`Sblocca per € X`, `Sblocca N item mancanti (€ X)`, or
  **`Inizia la visita ➜`** (only when `visitaUtilizzabile`). An internal history
  (`storiaModale`) provides "← Indietro" when the modal switches content.
- **Confirm modal**: three variants — purchase, bulk purchase of a visit's missing items,
  delete visit (danger styling). Native `alert`/`confirm` are banned project-wide.
- **Toast**: aria-live, success/error, auto-dismiss after 3.5 s.

### 4.11 Search and filtering engine

One engine for all four search bars: `normalizzaRicerca` (lowercase, strip accents, collapse
non-alphanumerics) + `campiRicercabili` (name, curator, difficulty, and for items also the
painter and the style) + `corrispondeRicerca` (multi-token **AND**, matching both the spaced
and the space-stripped haystack, so "davinci" finds "Leonardo da Vinci"). `filtraAvanzato`
is the shared type/difficulty/duration filter. Note that **duration is per-artwork**:
choosing one necessarily excludes visits.

---

## 5. Navigator — every screen and state

No router. `App.vue` reads the query string once on mount and picks one of four entries:

| URL | Branch |
| --- | --- |
| `?role=studente&guidedSession=<id>&user=<u>` | `attachAsStudent` → guided mode |
| `?role=docente&guidedVisit=<visitId>&user=<u>` | `startAsTeacher` → guided mode |
| `?visit=<id>[&museum=<qid>]` | load the visit, derive the museum from `ofMuseum`, start immediately |
| *(nothing)* / `?museum=<qid>` | load the museum, show the Selector. Fallback museum: **hardcoded `Q6373`** |

Three top-level phases: **guided** (`GuidedGate`), **selection** (`Selector`, with the
`Footer`), **visit** (visit bar + `MainView`).

### 5.1 Phase — Selector ("scegli la visita")

`LanguageSelector` (headless Combobox, searchable, persisted in `localStorage`), a **Livello**
dropdown and a **Durata (secondi)** dropdown whose options are derived from the visits
actually in the DB, an estimated-time line, and `Inizia la visita`, enabled only when a visit
exactly matches the (level, duration) pair — otherwise a status line invites another
combination. Below a hairline: the **custom visit** block — a free-text textarea and
"Crea visita su misura", with in-place loading ("Preparazione in corso…") and error states.
No AI is ever mentioned.

### 5.2 Phase — visit bar

`← Cambia visita` and, on the right, "`<livello>` · `N` min".

### 5.3 Phase — `MainView` (the visit itself)

Always mounted: **`Map`**. Conditionally: the QR FAB, the QR dialog, the artwork **Card**
dialog, and the options/info side column.

**`Map.vue`** — the museum SVG injected with `v-html`, plus a **non-spatial artwork list**
next to it (this pairing is the accessibility model: everything doable on the map is doable
in the list). On mount and on every `map`/`matchedContent` change, `setupListeners()` walks
`matchedContent`, finds each `locationId` node and turns it into a real control
(`tabindex="0"`, `role="button"`, `aria-label`, click + Enter/Space, `.active-artwork`, plus
`.optional-artwork` and an "(tappa opzionale)" suffix for optional stops). A separate
`highlightCurrent()` moves a pulsing `.current-artwork` "you are here" ring without rebuilding
the listeners. States: with content (toggle + list) / **empty** ("Seleziona livello e
durata…").

**Optional stops** (slide 23): `includeOptional` (default off) makes `stepIndex()` skip them
in Prossimo/Precedente, while they remain directly openable from the map, the list or a QR
scan — i.e. "se rimane tempo, o su domanda del visitatore". They are signalled three ways
(dashed stroke + dimming, "Opzionale" badge, aria-label suffix), never by colour alone.

**`Card.vue`** — headless `Dialog` (focus trap, Esc, focus restore). Image (with
`imagePath` → `imageUri` → hidden-on-error chain), title and author **already translated by
the parent**, one of two notices ("Non fa parte di questa visita" / "Tappa opzionale"),
description, then `Precedente` / `Opzioni` / `Prossimo`, whose labels come from the shared
controlled vocabulary. TTS play/stop and close sit top-right.

**`OptionsBar.vue`** — the `surface:"panel"` commands grouped by `group`
(Lettura / Contenuto / Dettaglio / Posizionale) as buttons, plus `AudioRecorder`
(idle → recording → "Elaborazione…" → error, each announced through `useAnnouncer`).

**`Info.vue`** — the answer panel. Positional commands are routed to `/api/wayfinding`
(first the **simple** answer: just the room name from the SVG; then, on demand,
"Indicazioni dettagliate" → the graph route verbalized by the LLM); everything else is
rewritten into a natural-language request and sent to `/api/llm/newInfo`. States: loading,
answer, error; a `requestId` token discards late responses so a language switch cannot be
overwritten by a stale answer.

**`QRScanner.vue`** — `getUserMedia` + `jsqr` in-app decoding (never a deep link, so the
in-progress visit, language and progress never leave memory). Tolerant payload extraction
(`/Q\d+/`). Error states: no camera / permission denied / insecure context.

**Selection model.** `currentArtwork` is a `Match`, not an index, so an artwork **outside**
the visit can be displayed; `lastVisitIndex` remembers the real position so "Prossimo"
resumes the visit after a detour. `hasNext`/`hasPrev` clamp at the ends (no modulo wrap).

### 5.4 Phase — `GuidedGate` (module 18-27)

- **`attesa`** — teacher: the access key as a reminder, the live list of connected students,
  `Annulla` / `Avvia visita`. Student: "In attesa che il/la docente avvii la visita",
  connected count, `Esci`.
- **`attiva`** — a top bar (visit name; for the teacher `Studenti (n)`, `Domande (n)`,
  `Termina`; for the student "Guidata dal docente") over the normal `MainView`, plus two
  mutually exclusive right-hand panels: connected students, and the **questions log** the
  teacher's client accumulates from the drained queue (username, time, question, artwork).
- **anything else** — "Visita terminata" + "Torna alla selezione" (which resets the guided
  state and strips the deep link from the URL).

Student restrictions during `attiva`: `hasNext`/`hasPrev` are forced false, the QR FAB is
hidden, map clicks only re-open *their current* stop, and `watch(guidedCurrentStep)` makes
the view follow the teacher. They may still close the Card to look at the map, and may still
ask questions — each of which is reported to the teacher via `studentAsk` (fire-and-forget).
Content is loaded once through the session endpoint, so possession is temporary by
construction.

### 5.5 Cross-cutting navigator services

- **`useTTS`** (singleton) — server-side synthesis (Google TTS → MP3), `requestId` guard so
  a stale request cannot interrupt a newer read, `AbortError` tolerated. It is **pure
  synthesis**: callers must pass text already in the target language.
- **`useTranslation`** — reactive translation of a text list; short-circuits when the chosen
  language is `SOURCE_LANG`; falls back to the originals on error. Lives in `MainView` (not
  `Card`) so the "Leggi" command reuses the same translated text.
- **`useAnnouncer`** — global live-region singleton; blanks before writing so identical
  messages are re-announced.
- **`useTheme`** — `light`/`dark`/`system`, `.dark` on `<html>`, `artaround-theme` key shared
  with the marketplace, anti-FOUC inline script in both apps.

---

## 6. End-to-end flows (open this, then that)

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
both sides run `MainView`, the teacher's `Prossimo` pushing the step to everyone → teacher
`Termina` → students' poll gets 410 → "Visita terminata", nothing persisted.
**The quiz cannot currently be started from the navigator** (§9.3).

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

### 7.1 Close the two remaining spec holes (blocking, not optional)

- **Quiz UI in the navigator.** The server (`/quiz/start|answer|end`) and the authoring side
  are finished; only the navigator screens are missing: teacher — "Avvia quiz" with a
  duration picker (the slide explicitly wants the teacher to size it against the remaining
  time), live results table, "Termina per tutti"; student — a **non-skippable** questionnaire
  with a countdown and the final score. `guidedStato` must gain the `"quiz"` value (today the
  server can enter a phase the client type does not model — see §9.3).
- **Teleport module.** Slide 34 asks for a module that takes you to a *predetermined position
  near each object of the visit*. The cheapest honest implementation reuses what already
  exists: a "Teletrasportami qui" action on each stop (list row, map node, Card) that sets
  the current position exactly as a QR scan does — i.e. `onScan`'s logic without the camera —
  making the whole visit demonstrable indoors without printed sheets. It should be visibly a
  *module* (its own affordance and label), not an implicit side effect of clicking a stop.

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

### 9.3 The quiz can be authored and served but never taken

`grep -rn "quiz" navigator/src` returns **nothing**. Concretely:

- `guided.ts` types `Stato = "attesa" | "attiva" | "terminata"` while the server's real
  enum includes `"quiz"`. If the teacher ever hit `POST /:id/quiz/start`, every client would
  fall into `GuidedGate`'s `v-else` and display **"Visita terminata"** mid-visit.
- `api.ts` has no wrapper for the three quiz endpoints, and the student state's `quiz`
  payload is dropped by `applyStudentState`.
- The seeded guided visit has **no quiz**, so the slide-34 requirement ("almeno una visita …
  ha un test sensato di competenza alla fine") is unmet twice over.

This is the single largest gap between what the backend can do and what the product does.

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
- `server/src/data/museumContent.ts` keys are **wrong**: `uffizi` holds `Q19675`
  (the Louvre), `louvreab` holds `Q6373` (the British Museum), `britishMuseum` holds
  `Q160236` (the Met). The QIDs and the generated configs are correct; only the identifiers
  lie — which is exactly the sort of thing that costs an hour during a demo. (`louvreab` is
  also just an unfinished word.)
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

These are not style opinions and not "odd parts": they are **defects that make working
features stop working** on a platform or in a situation we do not currently test. All three
share the same shape — no exception, no error in the console, no visible breakage during
development on a Linux laptop over `localhost`. They are listed here rather than in §9 because
each needs a code fix, not a rewrite.

### 10.1 Voice commands are broken on Safari / iOS — a **mandatory** 18-24 feature

**What happens.** On any iPhone or on macOS Safari, pressing "Comando vocale", speaking and
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

**Fix.** Pick the format with `MediaRecorder.isTypeSupported()` (prefer
`audio/webm;codecs=opus`, fall back to `audio/mp4`), tag the `Blob` with the format that was
actually used, send it as a field alongside the audio, and map it to the Google STT `encoding`
server-side (`WEBM_OPUS` ↔ `MP3`/`MP4` variants — for AAC-in-MP4 the practical route is to let
Google auto-detect by omitting `encoding` and `sampleRateHertz`, which it supports for
containerized formats).

### 10.2 The marketplace stops existing without a CDN

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
(waiting-teacher, waiting-student, active bar with 2 side panels, ended) — plus, once §7.1
lands, the two quiz screens.

**Do not break**: the `.dark`-class token mechanism and the shared `artaround-theme` key; the
skip link and both live regions; the SVG map nodes as real keyboard targets **and** the
parallel non-spatial list; the three-signal encoding of optional stops; focus trapping on
every overlay; the ban on `alert`/`confirm`; `aria-current` on the active nav tab.
