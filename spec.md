# ArtAround — Project Reference (for dev sessions)

> Purpose of this file: durable context so a fresh session doesn't have to re-derive
> the project from scratch. The authoritative *requirements* are in `slides.pdf`
> (the course assignment); this file summarizes them plus the **actual state of the
> code**. Keep it updated as the code changes.

---

## 0. Context & priorities (READ FIRST)

- This is a **university project** for the course *Tecnologie Web — A.A. 2025/26*
  (Univ. Bologna, Fabio Vitali). The full assignment is `slides.pdf` (49 slides).
- **Main goal: a system that WORKS, exactly per spec.** The slides state explicitly:
  *"Se una o più delle specifiche qui dettagliate non funzionano, il progetto NON è
  considerato accettabile."* So a missing/broken **mandatory** feature is a blocker,
  not polish.
- **Security is NOT a grading topic.** Don't invest in auth hardening, input
  sanitization, etc. beyond what's needed for the demo to work. Don't over-engineer it,
  but don't write anything actively dangerous either.
- Grading criteria (slides): **generality** of the tools, **flexibility/structure** of
  the solution, **usability**, and **graphic sophistication**. Genericity (one app, many
  museums, driven by config) is weighted heavily.

### Project levels (bands) — target: 18-33
⚠️ **The bands are CUMULATIVE, not alternatives** (slide 4, "Valutazione delle prove"):
the 18-33 grade requires the base **plus BOTH additional modules** ("Il progetto con
*entrambi i moduli aggiuntivi* genera un voto da 18 a 33").
- **18–24 (base, mandatory black requirements):** marketplace+editor, navigator with
  visit selection/execution, map view of objects, **voice synthesis (TTS) of item
  content**, on-screen display of the same content, controlled-vocabulary voice commands
  **with equivalent on-screen buttons**. No user positioning at this level.
- **Module I (18–27):** teacher/guide **synchronized** visit (same content pushed to all
  students, monitoring who connected/asked what) + an end-of-visit **quiz/test**; the seed
  must include at least one synchronized visit with a meaningful test.
- **Module II (18–33):** **georeferencing/QR** localization (QR codes on paper to simulate
  being near an object) + a **teleport module** + deep **LLM** integration (generate
  missing items, map free-form voice commands to controlled ones, real-time translation,
  constraint-based visit generation). 18-33 is for groups of 2–3 and presented in person.

> Since we target **18-33**, Module I (teacher sync + quiz) is **mandatory** and is
> currently **absent**, as is Module II's **teleport**; QR localization and all four LLM
> uses are done. The 18-24 base is essentially complete (see §5).
> **Recommendation: teacher-sync module + quiz + teleport are the top remaining blockers.**

---

## 1. Hard constraints (from slides — non-negotiable)

- **Server:** Node + Express + MongoDB + npm modules only. **NO** php/python/java/ruby/
  MySQL/Deno or any non-Node server tech.
- **Navigator:** JS/TS with a framework chosen among Angular/React/**Vue**/Svelte. → uses **Vue 3**.
- **Marketplace+editor:** **no framework** — Web Components, **Alpine**, or HTMX + vanilla JS. → uses **Alpine.js**.
- Graphic framework free (Bootstrap/Tailwind/…). → uses **Tailwind**.
- Both apps are **GENERIC** (not tied to one museum). A museum-specific navigator is
  produced only via a **config file + images/titles**. No museum-specific marketplace.
- Deploy = **two docker containers** on a department server; all data in **MongoDB** on
  that server. DBs are presented **already populated**.
- Seed expectations: 4 accounts `autore1`, `autore2`, `visitatore1`, `visitatore2`
  (password `12345678`) — seeded via `seedUsers.ts` ✅; at least **3 visits of ≥10 artworks
  each** on the same museum, differentiated by content/level — ✅ present in the DB:
  `tour-bm-principiante` / `tour-bm-intermedio` / `tour-bm-avanzato` (British Museum Q6373,
  13 artworks each, author `autore1`, free, CC-BY, per-level item texts, 2-3 optional steps
  each). ⚠️ Created **directly in the DB via the API**, not by `seed.ts` — if the DB is ever
  wiped and reseeded, they must be recreated.

---

## 2. Repo layout & entry points

```
docker-compose.yml      # mongo:7.0 + node:22 containers; node exposes 8000 (API) + 5173 (navigator dev)
shared/                 # shared TS types + constants used by ALL three parts
  types.ts              # Artwork, Item, Visit, Museum, User, Match, Contenuto
  constants.ts          # educationalLevels, secPerArt, voice-command `options`
server/                 # Node/Express/Mongoose backend (port 8000)
  src/index.ts          # app entry: mounts routes, serves marketplace static files
  src/routes/           # artworks, items, visits, museums, llm, speech (STT+TTS), translate
  src/services/         # llm (Gemini), stt (Google STT), tts (Google TTS), translate (Google Translation), wikidata, imageDownloader, museumConfig
  src/models/           # mongoose schemas: artwork, item, visit, museum
  src/data/museums/     # per-museum JSON config files (the "config file" deliverable)
  src/seed.ts           # DB seeding
  public/maps/*.svg     # museum floor maps   public/images/artworks/*  artwork images
  .env                  # GEMINI_API_KEY, GOOGLE_API_KEY, MONGO_URI
navigator/              # Vue 3 + Vite + TS + Tailwind (visitor app)
  src/App.vue           # root; currently HARDCODES museumId "Q6373" (should come from config/URL)
  src/api.ts            # fetch wrappers; API_BASE hardcoded to http://localhost:8000
  src/state.ts          # reactive global state (artworks/items/visit/museum/map + matchedContent)
  src/components/map/   # Map, MainView, Card, Info, OptionsBar + speech/ (recorder, player)
  src/components/selection/  # Selector, DropDownMenu (pick visit by level+duration)
marketplace/            # Alpine + vanilla TS + Tailwind (author/visitor hub)
  public/index.html     # the whole UI (Alpine x-data="appData()"), ~740 lines
  src/frontend/state.ts # AppState class — all client logic (login, editor, wallet, publish)
  src/frontend/api.ts   # ArtAPI fetch wrappers (relative /api/... paths)
  src/frontend/app.ts   # wires AppState into Alpine
```

The server **also serves the marketplace** statically (`server/src/index.ts:21-29`):
marketplace at `/`, compiled JS at `/dist`. Navigator runs on its own Vite dev server (5173).

---

## 3. Data model (ACTUAL — `shared/types.ts`)

> ⚠️ The previous version of this file listed wrong field names (`wikiDataUri`, `image`).
> These are the real fields.

- **Artwork**: `@id` (wikidata URL), `qid` (`QXXXX`), `name`, `imageUri`, `imagePath`,
  `author{name,qid}`, `style{name,qid}`, `ofMuseum` (string), `locationId`, `lastUpdated`.
  Mongoose model adds `@context`, `@type`. **No `wikiDataUri` field exists.**
- **Item** (= Schema.org CreativeWork): `@id` (`QID-author-tono-lunghezza`), `about`
  (Artwork `@id` string, or populated), `text`, `timeRequired`, `educationalLevel`,
  `author`, `license`, `price?`. ItemModel stores `about` as a **string id**.
- **Visit** (= ItemList): `@id`, `name`, `level`, `duration`, `price?`, `ofMuseum`,
  `itemListElement` (Item `@id`[]), `optionalItems?` (subset marked "optional"),
  `logistics` (string[]), `author?`.
- **Museum**: `@id`, `qid`, `name`, `created`, `location`, `mapPath`.
- **User**: `username`, `role` (`autore`|`visitatore`), `wallet`, `collezione` (id[]).
  **Now persisted** in MongoDB (`models/user.ts`, adds a plaintext `password` — security is not
  graded). CRUD via `/api/users` (see §4); seeded with the 4 required accounts (`seedUsers.ts`).
- **Match**: `{artwork, item}` (navigator joins item.about ↔ artwork["@id"]).
- **Contenuto** = `Item | Visit` (marketplace union).

Items come in **4 tones** (infantile/semplice/medio/avanzato) × multiple durations —
directly satisfies "multipli item per lo stesso oggetto". The editor creates **one item
(= one tone) per publish**; uniqueness is enforced per **(artwork, author, tone)**: the
same author can cover the other tones with further publishes, but never duplicate one
(client-side the used tones are disabled, server-side `POST /api/items` returns **409**).

---

## 4. API reference (ACTUAL — verified against route files)

Base path `/api`. All mounted in `server/src/index.ts`.

- **Artworks** `/api/artworks`
  - `GET /` → all artworks.
  - `GET /:qid/items` → items for a QID, grouped by author (marked "DA AGGIUSTARE").
  - `GET /:qid/preview?level=<lvl>&duration=<sec>` → `{artwork, item}` (a `Match`) for a
    **single** artwork even if it's **not in the current visit** (used by the QR scanner).
    Picks the item matching level **and** duration, falling back to level-only then any; if the
    artwork has **no** item, generates one via the LLM (`createDescription`) for that level+duration
    and persists it as `@id = "<qid>-AI-<level>-<duration>"` (author `"AI"`).
- **Items** `/api/items`
  - `GET /` → **all** items with `about` (Artwork) **populated** (marketplace visitor listing; the
    client filters by museum via `about.ofMuseum`).
  - `GET /author/:authorName` → author's items (populates `about`).
  - `POST /` → **create** item. Accepts marketplace format (`tipo:"Item"`) **or** Schema.org
    (`@type:"CreativeWork"`). Marketplace format: **rejects duplicates with 409** if the author
    already has an item for the same (artwork, tone) — no silent overwrite. (A previous
    `deleteMany({about, author})` that wiped the author's *other* items for that artwork on every
    publish was removed.)
    - **`@type` in forma corta obbligatoria:** gli item si salvano con `@type:"CreativeWork"`
      (non l'URL `https://schema.org/CreativeWork`), coerente con le Visit (`"ItemList"`). I
      template del marketplace confrontano `item['@type'] === 'CreativeWork'`, quindi l'URL
      completo faceva fallire silenziosamente immagine/badge/dettaglio degli item (bug risolto:
      default del model normalizzato + migrazione dei 310 item esistenti).
  - `POST /batch` → items by `{ids:[...]}`.
- **Visits** `/api/visits`
  - `GET /` → all visits. `GET /:id/items` → the visit's items with `about` (Artwork) **populated**
    and ordered per `itemListElement` (the navigator consumes this directly — no client-side join).
    `POST /custom` → ephemeral custom visit (see §8). `POST /` → upsert by `@id` (used both for
    creation and for the marketplace's "Modifica" on own visits); fills the required `level`
    (default `"Personalizzata"`) and `duration` (sum of the items' `timeRequired`) when the
    payload omits them, and drops empty logistics notes. Items flagged `opzionale` in the
    `percorso` are also stored in `optionalItems` (a subset of `itemListElement`).
    `DELETE /:id` → deletes a (marketplace-created) visit and `$pull`s its id from every user's
    `collezione`; 404 if unknown.
    (`GET /:id` exists for the navigator's deep link `?visit=<id>` from the marketplace.)
- **Museums** `/api/museums`
  - `GET /` → all. `GET /:id` → museum by **qid**. `GET /:id/artworks` → artworks where
    `ofMuseum === "http://www.wikidata.org/entity" + id` (⚠️ note: **no `/` before qid**).
  - `GET /:qid/qrcodes` → **printable HTML** sheet with one QR per artwork (payload = the bare
    artwork qid). The curator's "foglio di carta" for QR localization; fully generic (driven by
    the museum's artworks). Uses the `qrcode` npm module server-side.
- **Users** `/api/users` (marketplace auth + persistence)
  - `POST /register` `{username, password, role}` → creates a user, returns it **without password**
    (409 if the username exists).
  - `POST /login` `{username, password, role}` → validates username+password+**role** (the portal
    must match the account's role), returns the user (`wallet`+`collezione` included).
  - `POST /:username/buy` `{itemId, price}` → **server-side** budget check, deducts `wallet`, adds
    `itemId` to `collezione` (idempotent if already owned), returns the updated user.
  - `GET /:username/sales` → the author's published items+visits with `license`, `price`,
    `adozioni` (buyers) and `ricavo` (adozioni×price) — adoptions counted from `User.collezione`.
- **LLM** `/api/llm`
  - `POST /newInfo` → `{previous, userReq, language}` → enriched description (Gemini), generated
    **directly in `language`** (the language's display name, e.g. `"English"`). (NOT `/addInfo`.)
- **Speech** `/api/speech`
  - `POST /` (multipart `audioFile` + `lang` BCP-47) → Google STT (in `lang`) transcript →
    `mapRequest` LLM mapping to a controlled command → `{mappedTranscript}`.
  - `POST /tts` `{text, lang}` (`lang` = BCP-47) → MP3 synthesized in that language.
- **Translate** `/api/translate`
  - `POST /` `{texts:string[], target}` (`target` = Google Translate code, e.g. `fr`, `zh-CN`)
    → `{translations:string[]}`. Google Cloud Translation, in-memory cached by `target+text`.
    Source language is always Italian (`SOURCE_LANG` in `shared/constants.ts`).
- **Wayfinding** `/api/wayfinding`
  - `POST /` `{museumQid, from, target, language}` → `{directions}`. Loads the museum's SVG map
    (by `mapPath`), parses it into a graph (`services/svgGraph.ts`, cached per map), runs Dijkstra
    (`services/wayfinding.ts`) from the current artwork (`from` = its qid) to `target` (a POI type
    `toilet|exit|bar|shop|emergency_exit|…`, the literal `"obstacles"`, or another artwork qid),
    and verbalizes it via the LLM (`directionsFromRoute`, generated **directly** in `language`).
    The graph guarantees the route (the sequence of rooms to cross) and the obstacles; the LLM
    only phrases it.
- `GET /api/health`.

External services: **Gemini** (`@google/genai`, model `gemini-3.1-flash-lite`) and **Google
Cloud** Speech-to-Text (STT), Text-to-Speech (TTS) and Translation — all under one
`GOOGLE_API_KEY` (its API restrictions must allow each of the three APIs). Keys in
`server/.env` (`GEMINI_API_KEY`, `GOOGLE_API_KEY`).

---

## 5. Implementation status (snapshot — keep updated)

**Working / present**
- Three-tier skeleton compliant with all framework/deploy hard constraints.
- Generic museum design: museums in DB + per-museum JSON config + SVG maps served statically.
- Navigator happy path: pick visit (Selector by level+duration) → map → artwork Card →
  LLM "options" (Approfondisci/Semplifica/Chi è l'autore/…) → STT voice input mapped to
  controlled vocab; on-screen buttons mirror voice commands (`OptionsBar.vue`, with aria-labels).
- Marketplace: login/register, author "my works", visitor dashboard/collection, editor for
  items (**one tone per publish**, duplicates per (artwork, author, tone) blocked client+server)
  and visits, **DB-persisted wallet/purchase** (see §5 item 4 + `/api/users`).
- **Marketplace UX/a11y + visit lifecycle — DONE.** Everything is keyboard-navigable
  (cards are `<button>`s, aria-labels/alt/label-for everywhere); every overlay window has a
  **focus trap** (`@alpinejs/focus`, `x-trap.inert.noscroll`) + Esc/click-away; native
  `alert()`/`confirm()` are **banned** — confirmations use an in-app modal (purchase confirm for
  **paid** content only; free content unlocks on first click) and notifications use an aria-live
  **toast**. The detail modal keeps an internal history (`storiaModale`) with a "← Indietro"
  button whenever its content switches screens (e.g. visit → item). **Full screen-reader pass
  (2026-07):** skip link ("Salta al contenuto principale") as the first focusable element, an
  `aria-live` region announcing each SPA view change (`etichettaVista()`), `aria-current="page"`
  on the active nav tab, and contextual `aria-label`s on otherwise-generic action buttons
  ("Dettagli/Anteprima/Sblocca di <nome>", via the now-public `nomeContenuto`). Verified: every
  `<img>` has an `:alt`, every icon-only button (`×`, arrows) has an `aria-label`, no clickable
  `<div>` (all interactive elements are `<button>`/`<a>`/native controls). Visit detail: clickable
  timeline entries (open each item) + logistics notes displayed; own visits can be **edited**
  (prefilled editor, upsert on same `@id`) and **deleted** (danger confirm modal,
  `DELETE /api/visits/:id`). Visits may be created **with unowned items** (editor library filter
  Tutti / Posseduti e gratis / Da acquistare, 🔒 price badge), but "Inizia la visita" only shows
  when the user owns the visit **and all its items** (`visitaUtilizzabile`) — with a bulk
  "Sblocca N item mancanti" purchase; this closed a bug where unpurchased item descriptions were
  readable via the navigator. Collection view has its own search bar.
- **Visit editor — scale + reorganize + optional content (slide 23) — DONE.** The item picker has
  its own **search box** (`ricercaLibreria`) on top of the Tutti/Posseduti/Da-acquistare filter, so
  a library of hundreds/thousands stays browsable. Timeline steps can be **reordered** (up/down
  buttons, `spostaTappa`) and each item step can be flagged **"Opzionale"** (`toggleOpzionale`) —
  content shown only if time remains / on visitor questions. Optional flags persist as
  `Visit.optionalItems` (subset of `itemListElement`; new field on the shared type + Mongoose model
  + `POST /api/visits`, verified round-trip), and show as an "Opzionale" badge in the visit detail.
  ⚠️ **Navigator side not done:** the navigator still treats all `itemListElement` equally — it does
  not yet skip/deprioritize `optionalItems`. Additive field, so nothing breaks (colleague's domain).
- **Marketplace code review vs slides.pdf — DONE (2026-07).** Full audit of the marketplace against
  the slide-20 mandatory requirements: all covered (museum panel, edit/create visit, free+paid
  content listing with scale handling, visit editing with reorder/multi-depth/optional, content
  creation with universal ids + image + multi-text + the 4 minimum metadata
  lunghezza/linguaggio/autore/licenza, publishing with license/price/adoptions/sales). Fixes from
  the review: **a visit can no longer be published without at least one item** (was possible to
  save an empty / logistics-only visit, contradicting the slide's "sequenza di descrizioni di
  item"); **`logout()` now resets all residual session state** (search fields, sales report,
  `editingId`, editor form — previously a second login on the same browser inherited them);
  removed the unused `educationalLevels` import and a leftover init `console.log` in
  `marketplace/state.ts`. Verified: no `alert`/`confirm`/TODO leftovers, no dead views, no
  residue of the old 4-tone editor.
- **Visitor buys single items AND visits, then composes own visits — DONE (slide 20/23).** The
  visitor dashboard now lists **both individual items** (`GET /api/items`, artwork image+name, tone/
  duration, price) **and visits**, all buyable one-by-one (`contenutiFiltrati` merges
  `itemsMarket`+`contenuti`, museum-scoped). Purchased items feed the visitor's **"Crea Percorso"**
  editor (`listaOpereSelezionabili` now reads owned items from `itemsMarket`, previously looked in the
  visits list → always empty). A composed visit is saved with `author=<visitor>` + `ofMuseum` and
  appears in the visitor's collection. Also: system auto-tour visits were **renamed** from the raw
  code (`Q…-Livello-durata`) to a readable label (`Visita <livello> · <durata>s`), in
  `manager.populateVisit` + a one-off `renameVisits.ts`.
- **Museum selection panel (slide 20, mandatory green req) — DONE.** At marketplace access, after
  login, a **multiple-choice panel** (`select_museum` view) lists the museums (`GET /api/museums`)
  and the user picks one; **all marketplace content is then filtered to that museum** (visits,
  author items, collection, and the editor's selectable artworks — via `ofMuseum` ===
  `http://www.wikidata.org/entity/${qid}`). A navbar pill shows the chosen museum with a "Cambia"
  action. Frontend-only (`state.ts` `musei`/`museoSelezionato`/`selezionaMuseo`/`appartieneAlMuseo`,
  `api.ts` `fetchMuseums`); no server change. (Navigator's museum selection stays config/URL-based,
  a separate mechanism per the slides.)
- **Artwork images reliably shown (navigator + marketplace) — DONE.** Frontends resolve the image as
  `imagePath` (server-downloaded) → fallback `imageUri` (remote Wikidata) → placeholder, with an
  `@error` guard so a broken URL never shows a broken-image icon (marketplace `state.ts:imgOpera`
  used across cards/collection/modal; navigator `Card.vue:imgSrc` + `imgBroken`). **Seed hardening:**
  `manager.populateArtwork` now **skips artworks with no P18 image** (returns `false`; `seed.ts`
  `continue`s), so every artwork stored via seed always has a viewable image; `wikidata.ts` also drops
  a label that is merely the QID (label-service fallback). Several invalid/imageless placeholder QIDs
  in `data/museumContent.ts` were replaced with real, verified artworks.
- Visit-matching identifiers/format fixed: `ofMuseum` now uses canonical
  `http://www.wikidata.org/entity/${qid}` (with `/`) consistently in `Selector.vue:51` and
  `museums.ts:47`; `Selector` levels/durations are now derived dynamically from the visits in
  the DB (`availableLevels`/`availableDurations`) instead of hardcoded "Principiante/Avanzato".
- **Text-to-speech (sintesi vocale del contenuto)** — satisfies the 18-24 base requirement,
  cross-platform. Synthesis is **server-side** (Google Cloud TTS, reuses `GOOGLE_API_KEY`):
  `services/tts.ts` + `POST /api/speech/tts {text, lang}` returns MP3 in the requested BCP-47
  voice; the client only plays it back (`useTTS.ts` composable), so it works on any browser/OS.
  `useTTS.speak` is **pure synthesis — it does NOT translate**: callers always pass text already
  in the chosen language (translated static fields, or natively-generated LLM answers). Controlled-
  vocab commands `"Leggi"` / `"Ferma lettura"` (`shared/constants.ts`) drive both the on-screen
  buttons (`OptionsBar.vue`) and the STT voice vocabulary (`mapRequest`); `"Leggi"` reads the
  artwork's already-translated description (`MainView.translatedFields`), and a read button in
  `Info.vue` reads the LLM answer. Manual play for now; an `autoRead` flag is in place for a
  future on/off toggle.
- **Real-time translation (18-33 LLM extension)** — the visitor picks a language in a searchable
  panel (`selection/LanguageSelector.vue`, wired into `Selector.vue`); the choice is global +
  persisted (`state.ts` `language`/`setLanguage`, localStorage). **Two content sources, two
  strategies:**
  - **Static DB content (stays Italian)** is translated **live** via Google Cloud Translation.
    Title/author/description are translated in `MainView` (`translatedFields`, the `useTranslation`
    composable → `POST /api/translate`) and passed down to `Card.vue`. The translation lives in
    MainView (not Card) so the `"Leggi"` command reuses it without re-translating. Server-side
    cache keyed by `target+text` (whole-string, not per-word), shared across visitors, kept for the
    process lifetime.
  - **LLM answers are NOT translated** — Gemini is asked to **answer directly in the chosen
    language** (`additionalDescription(previous, userReq, language)`), so `Info.vue` displays the
    raw response. Switching language re-asks the LLM (the `Info` watcher depends on `language`),
    guarded by a request-id token so a late response can't overwrite a newer one.
  Audio: `useTTS.speak` is **pure synthesis** (no translation) — it voices the already-in-language
  text with the language's TTS code. Voice commands are recognized in the user's language
  (`AudioRecorder` sends the STT code; `mapRequest` still maps onto the Italian command vocabulary —
  the one remaining Italian-anchored link, bridged by the LLM). The supported list lives in
  `shared/constants.ts` (`languages`: name + translate/tts/stt codes) — only fully-supported
  languages are offered. **Requires the `Cloud Translation` API enabled on the `GOOGLE_API_KEY`
  project (and the key's API restrictions must allow it), and `@google-cloud/translate` installed
  server-side.**
- **Wayfinding / logistic directions (18-33 georeferencing, QR/geo deferred)** — positional voice
  commands & buttons ("Dove è il bagno?", "Dove esco?", "Ci sono ostacoli?") now answer with real
  spoken+on-screen directions in the chosen language. **The SVG map is the single spatial source
  of truth**: the curator enriches the map they already draw with `data-*` tags, the server parses
  it into a graph of **rooms** and runs a BFS (fewest rooms to cross), and the LLM phrases the
  result (graph = correctness, LLM =
  natural language). **QR localization is now implemented** (see below). The deterministic output is the **sequence of rooms to cross** plus the
  **obstacles** in them — rooms are *areas* and a node/obstacle's room is the area that contains it
  (point-in-region), so an obstacle across a wall isn't reported. Pipeline: `services/svgGraph.ts`
  (parse) → `services/wayfinding.ts` (route IR) → `services/llm.ts:directionsFromRoute` →
  `routes/wayfinding.ts`; navigator calls it from `Info.vue` (`api.ts:getDirections`), current
  position = the open artwork's qid. No museum-specific code; a new museum works by dropping in an
  annotated SVG. **Not yet done:** device geolocation (the "versione avanzata"); drawing the route
  on the map.

- **QR localization (18-33 "versione base") — DONE.** A QR beside each artwork simulates physical
  presence near it (slides: *"simulare la presenza fisica vicino ad un oggetto"*). Design decided
  with the user: the QR is **position-only**, scanned by an **in-app scanner** (no deep-link/reload,
  so the in-progress visit/language/progress never leave memory), and the payload is the **bare
  qid**. Pipeline: `composables/useQRScanner.ts` (getUserMedia + `jsqr`) → `components/map/QRScanner.vue`
  (modal, tolerant qid extraction) → `MainView.onScan`. The scan only sets `currentArtwork`:
  - **Selection model refactored** from an index into `matchedContent` to a `Match` object
    (`MainView`: `currentArtwork` + `lastVisitIndex`), so an artwork **outside** the visit can be
    shown. Out-of-visit artworks are fetched via `GET /api/artworks/:qid/preview` and flagged in
    `Card.vue` with "Non fa parte di questa visita"; the visit's progress is untouched.
  - **"Prossimo"/"Precedente" point to the REAL next/prev** relative to actual position: if in the
    visit, the item after the current one (skips honored); on an off-visit detour, resume from
    `lastVisitIndex`. Clamped at the ends (buttons disabled), no more modulo wrap.
  - **Voice-ready without OptionsBar clutter:** `shared/constants.ts` options gained a
    `surface: "panel"|"card"` tag. The controlled vocabulary stays single-source (so `mapRequest`
    recognizes `"Prossimo"/"Precedente"`), but `OptionsBar` renders only `surface:"panel"` while the
    Card's nav buttons (driven from the `surface:"card"` entries) are their on-screen equivalent.
    `MainView.actionHandler` routes the nav voice commands into `navigationHandler`.
  - **Curator QR sheet:** `GET /api/museums/:qid/qrcodes` returns a printable page (`qrcode` npm).
  - **Deps:** `jsqr` (navigator) + `qrcode`/`@types/qrcode` (server) — installed and **verified
    working** end-to-end. NB: `node_modules` is root-owned (docker), so future `npm install` must run
    as root / via docker (see `[[node-modules-root-owned]]` note).
  - ⚠️ **Camera needs a secure context:** `getUserMedia` only works on `localhost` or HTTPS — opening
    the navigator via a LAN IP silently blocks the camera. The scanner requests the rear camera
    (`facingMode: environment`) and falls back to any camera (laptops).
  - **Testing note:** the seed puts **every** museum artwork into **every** visit of that museum
    (`seed.ts`), so within one museum nothing is "out of visit". To exercise the preview path, scan a
    QR from a **different** museum's sheet (e.g. a Q19675 code while in a Q6373 visit).

  **SVG annotation convention (curator contract)** — on the museum's SVG (`server/public/maps/*.svg`):
  - room → a shape (circle/rect/polygon) with `data-room="Nome"` defining an **area**; a node's or
    obstacle's room is the area that **contains** it (point-in-region, so walls/boundaries are
    respected, not mere proximity). Areas are tested in document order — first containing area wins
    (put more specific ones first). A shape may be both an area and a node (an artwork that is itself
    a room).
  - artwork node → `data-qid="Qxxx"` (center = position),
  - POI node → `data-poi="exit|emergency_exit|toilet|bar|shop|elevator|stairs"` `[+ data-label]`,
  - obstacle → `data-obstacle="steps|door|chairs|object"` + `data-desc`,
  - edge → `<line data-edge …>` between two rooms; each endpoint resolves to the room that
    **contains** it (not to the nearest node) → those two rooms are linked.

  Connectivity is **authored only** (edges) — no geometric adjacency is inferred — so
  **every walkable space must be a `data-room` region** (corridors and halls included), otherwise
  it cannot appear among the rooms to cross. Single-floor maps only; multi-floor is one map per
  floor (vertical links via `data-edge` are a future extension).

**Missing / broken (priority order)**
1. ✅ **Item publish — FIXED:** the editor's artwork `<select>` used a non-existent field
   (`art.wikiDataUri`) for its `:value`/`:key`, so nothing could be selected; and `routes/items.ts`
   looked up `ArtworkModel.findOne({wikiDataUri:…})` which never matched. Now the select uses
   `art['@id']` and the server resolves the artwork by `@id` (with `qid`/`wikiDataUri` fallback).
   Negative price/duration are also blocked (`min="0"` + JS validation in `salvaOpera`).
2. ✅ **Logistics — DONE:** positional commands now answer via the wayfinding pipeline (see
   "Working / present"); `routes/visits.ts` `tipo` filter fixed to `"logistica"` so author-written
   logistics persist (the *caricare* path) alongside the graph-generated directions (*creare*).
3. 🟠 **Hardcoded env:** `App.vue` pins `museumId="Q6373"`; `navigator/src/api.ts` pins
   `http://localhost:8000`; marketplace `state.ts:urlNavigator` pins port `5173`. All must be
   config/relative for the docker deploy.
3b. 🟡 **`shared/constants.ts:educationalLevels = ["Principiante"]`** while the DB has
   Principiante/Intermedio/Avanzato visits: the seed and the custom-visit LLM enum only use
   "Principiante". Server/seed domain (colleague's) — check whether intentional.
4. ✅ **Marketplace persistence — DONE.** ✅ Users, wallet, collection and purchases are now
   **persisted in MongoDB** via `/api/users` (`models/user.ts`, `routes/users.ts`); the marketplace
   `state.ts` calls the API for login/register/buy instead of the old in-memory array. ✅ All **4
   required accounts** (`autore1`/`autore2`/`visitatore1`/`visitatore2`, pw `12345678`) are seeded
   (`seedUsers.ts`). ✅ **Publish license + adoptions + sales — DONE (slide 20):** the editor now
   has a **license** selector (`shared/constants.ts:licenses`), persisted on Item **and** Visit
   (`license` field added to the Visit type/model); the author has a **"Vendite" view** showing, per
   published content, license + price + **adozioni** (buyers) + **ricavo** (adozioni×price) with
   museum-scoped totals, from `GET /api/users/:username/sales` (adoptions **derived** from
   `User.collezione`, no duplicated storage). Also fixed: the Visit `POST` now stores `ofMuseum`
   (was missing → author/visitor-created visits wouldn't appear under the museum filter).
5. 🟡 **Extensions partially done:** teacher sync + quiz (18-27) not started; for 18-33, **QR
   localization is done and working** (see §5 above), **teleport + device geolocation not started**.
6. ✅ **Hygiene — done:** request-path `console.log`s removed (kept startup/seed/config logs);
   dead `AIRequest()` test fn, the unused local `navigator/.../map/map.svg`, and stale commented
   blocks in `Map.vue` removed; `shared/types.ts` TODO header trimmed to the still-open item
   (museum-selection via config — "multiple items per artwork" is solved by the per-tone editor
   + (artwork, author, tone) uniqueness). The normal-visit flow no longer double-fetches the
   visit (Selector emits the full `Visit`; `state.setVisit` injects it, symmetric to
   `setCustomVisit`); `GET /api/visits/:id` was later reintroduced for the marketplace →
   navigator deep link (`?visit=<id>`).

---

## 6. Setup & run

**Prerequisites:** Node 18+ (docker uses node 22), MongoDB (local or `docker-compose`).

**Env:** `server/.env` needs `MONGO_URI`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`.

**Docker (closest to deploy target):**
```bash
docker-compose up    # mongo + node; runs npm install, navigator dev (5173), server (8000)
```

**Manual dev:**
```bash
# 1. mongo running (locally or via docker-compose up mongodb)
cd server && npm install && npm run dev     # API on :8000, also serves marketplace at /
cd navigator && npm install && npm run dev  # navigator on :5173
# marketplace is served by the server at http://localhost:8000
# (re)seed the DB with server/src/seed.ts when needed (heavy: LLM-generates items)
# seed just the 4 required accounts (fast, no LLM):  npx ts-node server/src/seedUsers.ts
```

---

## 7. Conventions

- Code comments and UI copy are in **Italian**; keep that style when editing existing files.
- Shared types live in `shared/` and are imported by all three parts — change them with care
  (a field rename ripples across server models, navigator, and marketplace).

---

## 8. Custom (constraint-based) visit generation — IMPLEMENTING (18-33 LLM)

Satisfies the 18-33 requirement *"Creazione di visite di un museo sulla base di vincoli
dell'utente"* (slide 31): a free-text box where the visitor describes constraints ("ho solo
mezz'ora, mostrami le cose importanti"; "tesi sul Parmigianino, so dei rapporti con Bedoli")
and the system returns a **runnable `Visit`** of the same shape the navigator already consumes.
Hard rule (slide 31, green): **the user must not know an LLM is involved** — a form, no chat,
no prompt-style interaction; AI vs human content is distinguishable only via metadata.

**Design (decided with the user) — planner/resolver split**, mirroring the wayfinding pattern
(deterministic code owns correctness, the LLM owns interpretation/phrasing):

1. **`planVisit(catalog, userRequest)`** (`services/llm.ts`, non-lite `MODEL`) — gets the
   museum's catalog (`qid`/`name`/`author`/`style`) + the raw request and returns **structured
   JSON** (forced via `responseSchema` + `responseMimeType:"application/json"`):
   `{ name, artworks: [{ qid, tone, durationSec, twist }] }`.
   - `tone` and `durationSec` are **schema enums** (`educationalLevels`, `secPerArt`) so the
     model can only emit values the resolver understands.
   - `twist` = a short Italian instruction on *which angle to emphasize for that artwork*
     (e.g. `"enfatizza l'uso del verde"`, `"analizza in rapporto a Bedoli"`), `""` if none.
     Per-artwork, so different works in the same visit can have different angles.
   - **Time budget is the model's job, stochastically** — no separate budget param, no
     server-side sum enforcement: the planner balances count × per-artwork duration against the
     budget it reads from `userRequest`. Server validates only enums/qids + a loose count cap.
   - **Multi-age ("due adulti + bimbi 5 e 8") = a twist, not multiple tracks.** Interpreted as
     "one blended description, comprensible to a child yet interesting to an adult" → the group
     composition becomes a `twist` string. This keeps content *synchronized* (everyone hears the
     same words) per the slide wording, with zero schema/navigator changes.
2. **`createTwistedDescription(name, author, level, duration, twist)`** (`services/llm.ts`,
   `MODEL_LIGHT`) — `createDescription` refactored to delegate to this with `twist=""`, so the
   plain path is unchanged. A non-empty twist adds one "dai particolare risalto a …" clause.
3. **`resolveOrGenerateItem(artwork, level, durationSec, twist)`** (`dbActions.ts`) — the
   `twist` field doubles as the **reuse switch** (keeps the "indistinguishable from human" rule
   honest): `twist===""` → reuse a curated item from the DB (the `/:qid/preview` fallback chain:
   level+duration → level → any), generate only if missing; `twist!==""` → always generate.
   **Generated items are NOT persisted** — they're built **in memory** and returned (the `@id`
   `${qid}-AI-${level}-${duration}[-${sha1(twist).slice(0,8)}]` is informative only).
4. **`POST /api/visits/custom { museumQid, request }`** (`routes/visits.ts`) — load catalog →
   `planVisit` → validate enums/qids + count cap (`MAX_CUSTOM_ARTWORKS`) → per-artwork
   `resolveOrGenerateItem` → assemble the `Visit` (`level:"Su misura"`, `author:"AI"`) and
   respond with **`{ visit, content }`** where `content` is `[{artwork, item}]` already joined
   (no client-side join). Generation stays **in Italian** (source lang); the navigator
   translates live as usual.

**Persistence — DECIDED: custom visits are NOT persisted; they live only in the client.**
Reasoning: non-custom visits keep being fetched from the DB; custom visits are ephemeral and
must never leak into the marketplace/selector listings. So the route writes nothing — no `Visit`
doc, no generated `Item` docs — and there is no `custom` flag / listing filter to maintain.
(This is why a `custom` field was considered and then dropped from `Visit`/the visit model.)

**Navigator:** `api.ts:createCustomVisit` returns `{ visit, content }`; `state.ts:setCustomVisit`
injects both directly into `visit`/`matchedContent`, guarded by a module-level `contentVisitId`
so `loadVisit`/`loadVisitContent` (driven by `MainView`'s `currVisit` watcher) short-circuit
instead of re-fetching and wiping the injected content. A free-text box in
`selection/Selector.vue` ("Oppure descrivi la tua visita") does the fetch (owning its loading/
error UI) and emits a single `customStart` event; `App.vue:onCustomStart` owns the injection
(`setCustomVisit`) and the transition (`choice`/`summary`/`started`), beside the normal-visit
`onStart`. No AI is mentioned in the UI.
