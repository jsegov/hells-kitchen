# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A complementary `AGENTS.md` exists with overlapping setup/style notes; this file focuses on the big-picture architecture and the commands you'll use most. Read `README.md` for the take-home requirements.

## Layout

A single npm package at the repository root:

- Next.js 16 App Router + React 19 (ES modules), Server Components by default. Serves both the pages and the JSON API (Route Handlers under `app/api`), backed by `db/data.json` as a mock database.

Run npm commands from the repository root.

> The Express `backend-app` package was folded into this Next.js app (see `VERCEL_DEPLOYMENT_PLAN.md`, Phase 1): its logic now lives in `lib/recipes.js` and its routes in `app/api/recipes`.

## Commands

```bash
# Run everything from the repository root
npm run dev          # next dev on :3000 (or next free port)
npm test             # jest
npm run build        # next build (run for any frontend change)
npm run check        # typecheck + lint + format:check + test
```

Run a single test (Jest):

```bash
npm test -- recipes.test.js          # one file
npm test -- -t "normalizes difficulty"   # by test name
```

`npm run check` is the quality gate. Run it before opening a PR.

## Type checking without TypeScript

The app is plain `.js` but type-checked under `tsc --noEmit` with `checkJs` + `strict`. Types come from JSDoc `@typedef`/`@param` annotations, not `.ts` files. **Do not add TypeScript source files** — keep the JSDoc-typed JS convention. A typecheck failure is a real error to fix, not a suggestion.

## Core architecture: defensive DTO mapping

The central design pattern is that `db/data.json` is treated as **untrusted, possibly-malformed input** at every boundary. Every layer validates and normalizes rather than trusting shapes.

**Data layer (`lib/recipes.js`)** — all logic lives here; the Route Handlers in `app/api/recipes` are a thin layer over it. Raw JSON records are never returned directly. Mapping helpers (`toRecipeListItem`, `toRecipeDetail`) reject records lacking a non-empty string `id`/`title`, coerce malformed scalars (`toSafeString`/`toSafeNumber`), keep `tags` string-only, and count only valid ingredient references. Two DTO shapes:

- `getRecipeList(filters)` → list-safe fields only (no ingredients/instructions/nutrition), plus `ingredientCount`. Supports repeatable/comma-separated `name`, `tag`, `ingredient` query filters (AND across categories, term-substring match).
- `getRecipeDetail(id)` → full detail incl. nutrition computed by joining recipe ingredients against the ingredient table, scaling per amount (`parseRecipeAmount` handles numbers, decimals, and fractions like `1/2`), summing totals, and dividing for per-serving. Unresolved ingredient refs are surfaced in `nutrition.missingIngredientIds`.

**Page data helpers (`app/recipes/recipeData.js`)** — `getRecipes`/`getRecipe` call the data layer directly through an injectable `dataLayer` seam (default = `lib/recipes.js`) and re-validate its output at runtime (`isRecipeListItem`, `isRecipeDetail`, etc.) before rendering. They never throw to the page; they return `{ recipes, error }` / `{ recipe, error, notFound }` so pages render visible error or not-found states. Filter normalization is intentionally duplicated between `recipeData.js` and the data layer.

## Frontend conventions

- App Router under `app/`. `/` redirects to `/recipes`. Pages are Server Components; add a Client Component only when interactivity requires it (e.g. `RecipeFilters`).
- Route-specific styling uses CSS Modules (`*.module.css`). Keep `app/globals.css` for tokens/resets only.
- Pages and Route Handlers share the in-process data layer (`lib/recipes.js`); there is no internal HTTP call or API base URL.

## Scope discipline

Implement only the requested requirement; keep changes tightly scoped and preserve unrelated user changes. Do not add TypeScript, state/styling libraries, or new build tools, run `npm audit fix`, or upgrade dependencies unless asked. Do not edit the README "Candidate Notes" section unless explicitly doing submission docs.
