# Repository Guidelines

## Project Structure & Module Organization

ArtAround is a TypeScript monorepo with three applications. `server/src/` contains the Express API, Mongoose models, routes, services, data, and maintenance scripts; museum plans and artwork images live in `server/public/`. `navigator/src/` is the Vue 3/Vite visitor application. `marketplace/src/frontend/` contains the Alpine.js marketplace client, while `marketplace/public/` holds its HTML and assets. Cross-application types, constants, themes, and translation catalogs belong in `shared/`. Do not commit generated `dist/`, `sources/`, or `node_modules/` directories.

## Build, Test, and Development Commands

- `npm run setup` installs development dependencies for all three packages.
- `npm run build` type-checks and builds the server, marketplace, and navigator.
- `npm run dev --prefix server` runs Express from TypeScript with file watching on port 8000.
- `npm run dev --prefix navigator` starts the Vite UI on port 5173.
- `npm run watch --prefix marketplace` watches marketplace TypeScript and Tailwind CSS.
- `docker compose up` builds and serves the integrated application with MongoDB at `http://localhost:8000`.
- `npm run lint --prefix navigator` applies Oxlint and ESLint fixes to Vue and TypeScript files.

Use Node 22 (the navigator accepts Node 20.19+). Run `npm run build` before submitting changes.

## Coding Style & Naming Conventions

Use strict TypeScript and two-space indentation. Follow the quote and semicolon style already used by the package being edited; navigator lint configuration is authoritative there. Name variables and functions `camelCase`, types and Vue components `PascalCase`, and constants `UPPER_SNAKE_CASE`. Keep API handlers in plural route modules such as `server/src/routes/artworks.ts`. Put shared contracts in `shared/` rather than duplicating them across clients.

## Testing Guidelines

There is no unit-test runner or coverage threshold. Treat a clean build and navigator lint as the baseline, then manually exercise affected API and browser flows. The local browser suite under `testers/` is entirely Git-ignored. From `server/`, `npx ts-node src/scripts/testers.ts mappe` validates maps without MongoDB. Other `testers.ts` commands require a configured database and may perform idempotent migrations; inspect them before running. Document manual scenarios and results in the PR.

## Commit & Pull Request Guidelines

History favors short, informal summaries. Use clearer imperative, scoped subjects, for example `navigator: fix guided visit restart`. Keep commits focused. PRs should explain behavior changes, affected packages, setup or migration needs, and validation performed; link relevant issues and include screenshots for UI changes.

## Security & Configuration

Store local secrets only in `server/.env` (for example `MONGO_URI`, `NAVIGATOR_ORIGIN`, and Google API keys). Never commit `.env` files, credentials, database dumps, or generated artwork caches.
