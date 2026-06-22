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

### Project levels (bands) — decide which one we target
The project grade maps to a band; each adds features on top of the base:
- **18–24 (base, mandatory black requirements):** marketplace+editor, navigator with
  visit selection/execution, map view of objects, **voice synthesis (TTS) of item
  content**, on-screen display of the same content, controlled-vocabulary voice commands
  **with equivalent on-screen buttons**. No user positioning at this level.
- **18–27 (extension):** teacher/guide **synchronized** visit (same content pushed to all
  students, monitoring who connected/asked what) + an end-of-visit **quiz/test**.
- **18–33 (extension):** **georeferencing/QR** localization (QR codes on paper to simulate
  being near an object) + a **teleport module** + deep **LLM** integration (generate
  missing items, map free-form voice commands to controlled ones, real-time translation,
  constraint-based visit generation). 18-33 is for groups of 2–3 and presented in person.

> Current code reaches *toward* 18-33 (LLM + STT + TTS present) but **has not finished the 18-24
> base** (logistics stubbed, marketplace item-publish broken) and has none of the 18-27/18-33
> extension features (sync, quiz, QR/geo, teleport). **Recommendation: finish the 18-24 base first.**

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
  (password `12345678`); at least **3 visits of ≥10 artworks each** on the same museum,
  differentiated by content/level.

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
  public/index.html     # the whole UI (Alpine x-data="appData()"), ~430 lines
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
  `itemListElement` (Item `@id`[]), `logistics` (string[]), `author?`.
- **Museum**: `@id`, `qid`, `name`, `created`, `location`, `mapPath`.
- **User**: `username`, `role` (`autore`|`visitatore`), `wallet`, `collezione` (id[]).
  ⚠️ Currently **not persisted** — marketplace users/wallet/collection are in-memory only.
- **Match**: `{artwork, item}` (navigator joins item.about ↔ artwork["@id"]).
- **Contenuto** = `Item | Visit` (marketplace union).

Items intentionally come in **4 tones** (infantile/semplice/medio/avanzato) × multiple
durations — directly satisfies "multipli item per lo stesso oggetto".

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
  - `GET /author/:authorName` → author's items (populates `about`).
  - `POST /` → upsert item. Accepts marketplace format (`tipo:"Item"`) **or** Schema.org
    (`@type:"CreativeWork"`).
  - `POST /batch` → items by `{ids:[...]}`.
- **Visits** `/api/visits`
  - `GET /` → all visits. `GET /:id` → one visit by `@id`. `POST /` → upsert (marked "DA AGGIUSTARE").
- **Museums** `/api/museums`
  - `GET /` → all. `GET /:id` → museum by **qid**. `GET /:id/artworks` → artworks where
    `ofMuseum === "http://www.wikidata.org/entity" + id` (⚠️ note: **no `/` before qid**).
  - `GET /:qid/qrcodes` → **printable HTML** sheet with one QR per artwork (payload = the bare
    artwork qid). The curator's "foglio di carta" for QR localization; fully generic (driven by
    the museum's artworks). Uses the `qrcode` npm module server-side.
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
  items (4 tones×durations) and visits, in-memory wallet/purchase.
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
1. 🟠 **Item publish is broken:** `routes/items.ts` looks up `ArtworkModel.findOne({wikiDataUri:…})`
   but the Artwork schema has no `wikiDataUri` → never matches → items never created via marketplace.
2. ✅ **Logistics — DONE:** positional commands now answer via the wayfinding pipeline (see
   "Working / present"); `routes/visits.ts` `tipo` filter fixed to `"logistica"` so author-written
   logistics persist (the *caricare* path) alongside the graph-generated directions (*creare*).
3. 🟠 **Hardcoded env:** `App.vue` pins `museumId="Q6373"`; `navigator/src/api.ts` pins
   `http://localhost:8000`. Both must be config/relative for the docker deploy.
4. 🟡 **Marketplace persistence:** users hardcoded (only `autore1`/`visitatore1` — need
   `autore2`/`visitatore2`); wallet/collection/purchases not saved to DB (reset on reload).
   License/adoptions/sales mgmt mostly absent (only `price`).
5. 🟡 **Extensions partially done:** teacher sync + quiz (18-27) not started; for 18-33, **QR
   localization is done and working** (see §5 above), **teleport + device geolocation not started**.
6. 🟡 **Hygiene:** many `console.log`, dead imports (`AudioRecorder` in `MainView`,
   `getAllArtworks` in `state.ts`), `navigationHandler` prev can go negative (`(idx-1)%len`),
   open TODOs at top of `shared/types.ts` (custom-visit handoff marketplace↔navigator, multiple
   items per artwork, museum-selection via config).

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
# (re)seed the DB with server/src/seed.ts when needed
```

---

## 7. Conventions

- Code comments and UI copy are in **Italian**; keep that style when editing existing files.
- Shared types live in `shared/` and are imported by all three parts — change them with care
  (a field rename ripples across server models, navigator, and marketplace).
