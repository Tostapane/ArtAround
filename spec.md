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
  src/routes/           # artworks, items, visits, museums, llm, speech
  src/services/         # llm (Gemini), speech (Google STT), wikidata, imageDownloader, museumConfig
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
- **LLM** `/api/llm`
  - `POST /newInfo` → `{previous, userReq}` → enriched description (Gemini). (NOT `/addInfo`.)
- **Speech** `/api/speech`
  - `POST /` (multipart `audioFile`) → Google STT transcript → `mapRequest` LLM mapping to
    a controlled command → `{mappedTranscript}`.
- `GET /api/health`.

External services: **Gemini** (`@google/genai`, models `gemma-3-*`) and **Google Cloud
Speech** (STT). Keys in `server/.env` (`GEMINI_API_KEY`, `GOOGLE_API_KEY`).

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
  cross-platform. Synthesis is **server-side** (Google Cloud TTS, it-IT Neural2, reuses
  `GOOGLE_API_KEY`): `services/tts.ts` + `POST /api/speech/tts` returns MP3; the client only plays
  it back (`useTTS.ts` composable), so it works on any browser/OS. Controlled-vocab commands
  `"Leggi"` / `"Ferma lettura"` in `shared/constants.ts` drive both the on-screen buttons
  (`OptionsBar.vue`) and the STT voice vocabulary (`mapRequest`); they read the artwork's
  `item.text` (`MainView.actionHandler`), and a read button in `Info.vue` reads LLM answers too.
  Manual play for now; a `autoRead` flag is in place for a future on/off toggle.

**Missing / broken (priority order)**
1. 🟠 **Item publish is broken:** `routes/items.ts` looks up `ArtworkModel.findOne({wikiDataUri:…})`
   but the Artwork schema has no `wikiDataUri` → never matches → items never created via marketplace.
2. 🟠 **Logistics not wired:** `Info.vue` maps all positional commands ("Dove esco?", "Dove è il
   bagno?"…) to `"no"` (no answer); and `routes/visits.ts` filters `t.tipo === "logistics"` while
   the editor emits `"logistica"` → logistics steps dropped on save.
3. 🟠 **Hardcoded env:** `App.vue` pins `museumId="Q6373"`; `navigator/src/api.ts` pins
   `http://localhost:8000`. Both must be config/relative for the docker deploy.
4. 🟡 **Marketplace persistence:** users hardcoded (only `autore1`/`visitatore1` — need
   `autore2`/`visitatore2`); wallet/collection/purchases not saved to DB (reset on reload).
   License/adoptions/sales mgmt mostly absent (only `price`).
5. 🟡 **Extensions not started:** teacher sync + quiz (18-27); QR/geo + teleport (18-33).
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
