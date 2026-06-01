# Repository Guidelines

## Project Structure & Module Organization

This repo is a single Next.js App Router app at the repository root. Pages and Route Handlers live under `app/`, with recipe pages in `app/recipes/` and JSON endpoints under `app/api/recipes/`. The data layer is centered in `lib/recipes.js`, backed at runtime by Neon Postgres through `lib/db.js`. Supporting helpers live in `lib/`:

- `lib/dietary.js` for diet and allergen derivation/filtering.
- `lib/recipeOptions.js` for public filter/sort option definitions.
- `lib/servingMath.js` for browser-safe serving and nutrition scaling.
- `lib/aiOverview*.js` and `lib/rateLimit.js` for the AI Overview feature.
- `lib/apiCache.js` for shared Route Handler cache headers.

Database schema and seed tooling live in `db/`: `schema.sql`, `migrate.mjs`, `seed.mjs`, and `data.json`. Treat `db/data.json` as seed/catalog data, not the runtime database. Tests live in `test/` and use `*.test.js`.

## Build, Test, and Development Commands

Run all commands from the repository root.

```bash
npm ci            # Install dependencies from package-lock.json
npm run dev       # Start Next.js on :3000, or the next free port
npm run build     # Production build
npm test          # Unit/render tests
npm run check     # Typecheck, lint, format check, unit/render tests
```

Database commands require environment variables in `.env.local`:

```bash
cp .env.local.example .env.local
npm run db:reset  # Runs db:migrate and db:seed
npm run test:db   # DB-backed repository and API tests
```

Use `npm run check` as the fast local quality gate. Use `npm run check:full` before opening a PR; it runs the fast gate, DB-backed tests, production build, and `npm audit --omit=dev`.

## Environment & Configuration

Required for runtime and DB-backed tests:

- `DATABASE_URL`: pooled Neon connection string for app reads.
- `DATABASE_URL_UNPOOLED`: unpooled Neon connection string for migrations and seeding.

Optional:

- `AI_GATEWAY_API_KEY`, or Vercel OIDC via `VERCEL_OIDC_TOKEN`, enables successful AI Overview LLM responses. Core recipe browsing must still work without it.

Never commit real `.env` files. `.env.local.example` is the committed template. `API_BASE_URL` and `CORS_ORIGIN` are obsolete because pages and Route Handlers run in the same Next.js app.

## Coding Style & Naming Conventions

The app uses plain JavaScript with strict `checkJs` type checking through JSDoc types. Do not add TypeScript source files unless the project direction changes. Use 2-space indentation, double quotes, and semicolons; Prettier enforces this through `prettier.config.mjs`. ESLint extends Next.js core-web-vitals and Prettier configs.

Use `camelCase` for variables/functions, `PascalCase` for React components, and keep modules small and focused. Components are Server Components by default. Add `"use client"` only for browser-owned interaction such as filter controls, serving-size controls, or streamed AI UI state.

## Architecture Guidelines

Route Handlers should stay thin and delegate validation, filtering, sorting, nutrition calculations, and DTO mapping to `lib/recipes.js` or focused helpers. Server Components should call the data layer directly instead of making internal HTTP requests.

Recipe data is treated defensively. Normalize untrusted data at boundaries, keep public DTOs narrow, validate ids and scalar fields, and fail closed for positive diet/allergen claims when ingredient metadata is missing. SQL filters and in-memory fallback logic should stay behaviorally aligned.

Filters use constrained vocabularies for tags, ingredients, diets, and allergens. Ingredient filtering is by exact ingredient id, not name substring. Sort options should flow through the whitelisted definitions in `lib/recipeOptions.js`.

The AI Overview feature may stream model-written prose, but final recipe cards must always resolve through real catalog ids and the deterministic data layer. Do not render model-authored recipe links, cards, or nutrition values as authoritative data.

## Testing Guidelines

Jest powers the test suite. Add or update focused tests under `test/` for new branches and edge cases. Prefer pure helper tests for normalization/math/schema logic, render tests for UI states, Route Handler tests for API behavior, and DB-backed tests when changing SQL or Neon repository behavior.

Run `npm test` for normal local changes. Run `npm run test:db` when changing `lib/recipes.js` SQL paths, migrations, seed data, or Route Handlers that depend on the database. Run `npm run build` for frontend or App Router changes.

## Commit & Pull Request Guidelines

Use Conventional Commits, for example `feat:`, `fix:`, `chore:`, and `docs:`. PRs should include a concise summary, linked issues when relevant, screenshots for UI changes, and the checks run. Note any skipped checks and why.

## Security & Data Notes

Keep secrets in environment variables and never expose server-only credentials through `NEXT_PUBLIC_*`. Validate and sanitize any new recipe or ingredient data added to `db/data.json`. Allergen handling is informational and should not be presented as a medical safety guarantee.

## Agent-Specific Notes

Keep changes minimal and aligned with the current take-home scope. Mirror existing defensive patterns when extending recipe data flows, update docs when behavior or setup changes, and preserve unrelated user changes in the working tree.
