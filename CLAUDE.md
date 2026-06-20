# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read these first

- **`spec.md`** — the durable project reference: priorities, hard constraints, data model,
  full API reference, and a per-feature implementation-status snapshot. It is authoritative
  for "what works / what's broken / what to do next." **Keep it updated as code changes.**
- **`slides.pdf`** — the actual university assignment (course *Tecnologie Web*, Univ. Bologna).
  It defines the *requirements*; `spec.md` summarizes them. A missing or broken **mandatory**
  feature makes the project unacceptable per the slides, so correctness-to-spec beats polish.
- Security/auth hardening is **not** graded — don't over-invest there.

## Architecture: three parts, one shared type layer

The repo is a monorepo of three independently-built parts that all import `shared/`:

- **`server/`** — Node + Express + Mongoose (port **8000**). Entry `src/index.ts`. Also serves
  the marketplace's static files (`/` → `marketplace/public`, `/dist` → `marketplace/dist`).
  Routes under `/api` in `src/routes/`; external integrations in `src/services/`
  (Gemini LLM via `@google/genai`, Google Cloud STT, Wikidata).
- **`navigator/`** — Vue 3 + Vite + Tailwind (port **5173**), the visitor app. Runs on its own
  dev server. Global reactive state in `src/state.ts`; API wrappers in `src/api.ts`.
- **`marketplace/`** — Alpine.js + vanilla TS + Tailwind, the author/visitor hub. **No framework
  build step like Vite** — `tsc` compiles TS to `dist/`, Tailwind CLI compiles CSS, and Alpine
  loads from CDN in `public/index.html`. Served *by the server*, not standalone.
- **`shared/`** — `types.ts` (Artwork, Item, Visit, Museum, User, Match, Contenuto) and
  `constants.ts`. Imported by all three parts; a field rename here ripples across server models,
  navigator, and marketplace — change with care. The real field names are documented in
  `spec.md` §3 (some are non-obvious, e.g. `imageUri`/`imagePath`, not `image`).

**Genericity is the core design constraint and a heavily-weighted grading criterion:** one app
serves many museums, driven by a config file. Museums live in the DB plus per-museum JSON in
`server/src/data/museums/`, with SVG floor maps served statically from `server/public/maps/`.
Do not introduce museum-specific code into navigator or marketplace.

## Commands

```bash
# Closest to the deploy target (mongo:7 + node:22, runs installs + navigator dev + server):
docker-compose up

# Manual dev (needs MongoDB running, e.g. `docker-compose up mongodb`):
cd server && npm install && npm run start      # API on :8000, also serves marketplace at /
cd navigator && npm install && npm run dev     # navigator on :5173

# Marketplace has no dev server — build it so the server can serve dist/:
cd marketplace && npm install && npm run build  # build:ts (tsc) + build:css (tailwind)
cd marketplace && npm run watch:css             # rebuild CSS on change during dev

# Seed / reseed the DB (no npm script):
cd server && npx ts-node src/seed.ts

# Navigator type-check and lint:
cd navigator && npm run type-check
cd navigator && npm run lint                    # oxlint + eslint, both with --fix
```

There is **no test suite** in this repo.

## Environment

`server/.env` must define `MONGO_URI`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`. The LLM and
speech-to-text routes are non-functional without the Google keys.

## Conventions

- Code comments and UI copy are in **Italian** — keep that style when editing existing files.
- `spec.md` §5 tracks known-broken items and the recommended work order; consult it before
  starting a feature so you don't duplicate or contradict in-flight decisions.
