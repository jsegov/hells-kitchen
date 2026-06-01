# Recipe Manager - Full Stack Take-Home Exercise

## Overview

Create a recipe management application that allows users to view, search, and organize recipes. This exercise tests your ability to build a full-stack web application with a focus on data relationships and user experience.

## Current Implementation

- The app is a single Next.js App Router application at the repository root. Its JSON API is served by Next.js Route Handlers (the original Express `backend-app` has been folded in).
- `/` redirects to `/recipes`.
- `/recipes` displays recipe list cards and supports filtering by recipe name, tags, and ingredients through query parameters.
- `/recipes/:id` displays ingredients with quantities, cooking instructions, tags, and nutrition totals/per-serving values calculated from ingredients.
- Next.js Route Handlers expose `GET /api/recipes` for list-safe recipe data, `GET /api/recipes/:id` for full recipe detail data, and AI Overview endpoints for streamed prose plus server-side finalization. Server Components call the same data layer (`lib/recipes.js`) directly, with no internal HTTP hop.
- Runtime data is served from Neon Postgres. `db/data.json` is retained as seed data for local and preview databases.

## Tips

- Use whatever frameworks/tools you're most comfortable with
- Focus on creating a working MVP before adding advanced features
- Be sure to document any assumptions or known limitations
- Test your application with different scenarios

## Setup Instructions

#### Prerequisites

- Node.js 20.9.0 or newer.
- A Neon Postgres database. The app reads from `DATABASE_URL`; migrations and seeding use `DATABASE_URL_UNPOOLED`.
- Optional: Vercel CLI if you want to pull environment variables from a linked Vercel project.

#### Run locally

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create `.env.local` in the repository root:

   ```bash
   cp .env.local.example .env.local
   ```

   Then fill in the Neon connection strings. `AI_GATEWAY_API_KEY` is optional unless you want the AI Overview form to return successful LLM responses.

   If the project is linked to Vercel, you can instead pull these values:

   ```bash
   vercel env pull .env.local
   ```

3. Apply the database schema and seed data:

   ```bash
   npm run db:reset
   ```

   This runs `npm run db:migrate` and `npm run db:seed`. Seed data comes from `db/data.json`. The migration script uses `psql` when available and falls back to the Neon driver when `psql` is not installed.

4. Start the Next.js app:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000/recipes`. Next.js may choose the next available port if `3000` is already in use.

#### Environment variables

- `DATABASE_URL` is required for the app runtime and DB-backed tests.
- `DATABASE_URL_UNPOOLED` is required for `npm run db:migrate`, `npm run db:seed`, and `npm run db:reset`.
- `AI_GATEWAY_API_KEY` or Vercel OIDC (`VERCEL_OIDC_TOKEN` from `vercel link && vercel env pull`) is optional for core browsing and required only for successful LLM responses. The AI Overview recommendation box is always visible on `/recipes`; Gateway credentials are read server-side only and are never exposed to the browser. When credentials are absent or invalid, submitting the AI form returns an inline error and the rest of `/recipes` is unchanged.
- `API_BASE_URL` and `CORS_ORIGIN` are obsolete now that the API runs in-process within the Next.js app.

#### Local checks

```bash
npm test          # Unit and render tests
npm run check     # Typecheck, lint, format check, unit/render tests
npm run test:db   # DB-backed repository and API route tests; requires DATABASE_URL
npm run build     # Production build
```

Use `npm run check:full` before opening a PR. It combines `npm run check`, DB-backed tests, the production build, and `npm audit --omit=dev`.

**Note: The original Next.js + Express scaffold has been consolidated into a single Next.js app; the Express backend was folded into Route Handlers.**

## Requirements

#### Core Features (Required)

- Display a list of recipes with their basic information (`/recipes`)
- Implement recipe detail page (`/recipes/:id`) showing:
  - Ingredients with quantities
  - Cooking instructions
  - Tags
  - Nutritional information (calculated from ingredients)
- Add search/filter functionality on (`/recipes`) by:
  - Recipe name
  - Tags
  - Ingredients

#### Example Advanced Features (Bonus Points. Feel free to implement any of these or add your own. Some examples below)

- Implement dietary restriction filters (e.g., vegetarian, vegan, gluten-free)
- Create a calorie calculator based on serving size
- Add recipe scaling functionality (e.g., adjust ingredients for different serving sizes)
- Implement recipe favoriting/saving
- Add sorting options (prep time, difficulty, etc.)
- Add a "shopping list" generator for selected recipes
- Incorporate an LLM feature
- Types

## Evaluation Criteria

- Code organization and clarity
- UI/UX design and responsiveness
- API design and implementation
- Error handling and edge cases
- Performance considerations
- TypeScript/JavaScript best practices

## Submission

1. Update this README with a new section below called `Candidate Notes:
   - Setup instructions if you've added any requirements
   - Brief explanation of your implementation choices
   - List of completed features
   - Any assumptions made
   - Known limitations or bugs
   - Additional features you'd add with more time

2. Send us (via email to scott.nguyen@sprx.tax & anthony.difalco@sprx.tax):
   - A zip file of the entire project (frontend and backend)
   - A link to a deployed version of the application (bonus points)

Good luck! We're excited to see your implementation.

## Candidate Notes

#### Starting point

This project started from the [SPRX-tax/hells-kitchen](https://github.com/SPRX-tax/hells-kitchen) scaffold: a split `frontend-app` Next.js app, a separate `backend-app` Express server, and `backend-app/db/data.json` as a mock database. The current implementation is a single root-level Next.js App Router app with Route Handlers, a Neon Postgres runtime data source, a larger seeded catalog, advanced browsing controls, and an AI Overview flow.

Compared with the starter repo, the current code removes the `frontend-app`/`backend-app` split, deletes the Express server package, moves the Next.js app to the repository root, adds `lib/` and `db/` as first-class layers, and adds focused Jest coverage for data helpers, Route Handlers, render states, database behavior, and AI flows.

The buildout was intentionally staged. I first got the required localhost MVP working against the original split app, then simplified deployment by removing Express, then moved the data source to Postgres, and only then layered on advanced UX and AI. That order kept each major decision constrained: requirements first, deployability second, data architecture third, and bonus features last.

#### Setup instructions

Use the setup instructions above. The main added requirement is a Neon database with `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in `.env.local`; `.env.local.example` documents the expected variables. `AI_GATEWAY_API_KEY` is optional for core browsing and only needed for successful AI Overview responses.

#### 1. Core localhost MVP

Reference PRs: [#1](https://github.com/jsegov/hells-kitchen/pull/1), [#2](https://github.com/jsegov/hells-kitchen/pull/2), [#3](https://github.com/jsegov/hells-kitchen/pull/3), [#4](https://github.com/jsegov/hells-kitchen/pull/4)

The first phase was about satisfying the README requirements without prematurely changing the scaffold. The frontend and Express backend remained separate, connected locally through `API_BASE_URL`, and I worked through the requirements one by one:

- `/recipes` list page with responsive recipe cards and a narrow list DTO.
- `/recipes/:id` detail page with ingredients, instructions, tags, and calculated nutrition.
- Name, tag, and ingredient filtering through URL query parameters.
- Loading, error, not-found, and empty states.
- Defensive DTO mapping and frontend runtime guards for malformed data.
- Backend/frontend Jest coverage, strict JS typechecking, linting, formatting, and local browser smoke tests.

The main trade-off was keeping the original Express boundary longer than I ultimately wanted. That added `API_BASE_URL` and CORS concerns, but it let me prove the product surface and API contracts before changing deployment architecture. It also made the first milestone easy to verify locally: run the backend on `8080`, run Next.js on `3000`, and walk each required route.

#### 2. Deploy as one Vercel app

Reference PRs: [#5](https://github.com/jsegov/hells-kitchen/pull/5), [#6](https://github.com/jsegov/hells-kitchen/pull/6)

Once the required experience worked locally, I consolidated the app for Vercel. The former Express route layer was thin: most real logic already lived in pure recipe helpers. I moved that logic into `lib/recipes.js`, recreated the JSON API as Next.js Route Handlers under `app/api/recipes`, and changed Server Components to call the data layer directly instead of making an internal HTTP request.

At this point the app was still backed by the original JSON catalog. The goal of this phase was deployment shape, not database behavior.

I did research whether keeping Express on Vercel made sense. Vercel supports Express, but the docs describe an Express app as a single Vercel Function where the normal Function limits apply, including bundle-size and lifecycle/error-handling concerns. For this project, that extra server layer did not buy much. Next.js Route Handlers were the more natural fit because they live in the same App Router tree, use standard Web `Request`/`Response` APIs, support the HTTP methods this app needed, and deploy with the rest of the Next.js app.

The trade-off is that the API is now coupled to the Next.js app instead of being a standalone Express service. I accepted that because the take-home app has one frontend, one JSON API, and one deployment target. In return, the repo became one npm package, one Vercel project, one environment-variable surface, no CORS allowlist, and no internal `API_BASE_URL` hop.

#### 3. Move runtime data from JSON to Neon Postgres

Reference PRs: [#7](https://github.com/jsegov/hells-kitchen/pull/7), [#8](https://github.com/jsegov/hells-kitchen/pull/8), [#9](https://github.com/jsegov/hells-kitchen/pull/9)

After deployment was working, I replaced JSON runtime reads with Neon Postgres. `db/data.json` stayed valuable as seed data, but it stopped being the runtime database. The new database layer added:

- `db/schema.sql`, `db/migrate.mjs`, `db/seed.mjs`, and `npm run db:reset`.
- `DATABASE_URL` for runtime reads and DB-backed tests.
- `DATABASE_URL_UNPOOLED` for migrations and seeding.
- A Neon serverless driver wrapper in `lib/db.js`.
- DB-backed Jest coverage through `npm run test:db`.
- Postgres filtering, trigram indexes, cache headers, ISR/static params for details, and transient Neon read retries.

This was a deliberate move even though the catalog is still mostly static. JSON is simpler, but Postgres gave the app query flexibility that later features needed: filtering by title, tags, ingredient ids/names/categories, diet/allergen metadata, parsed durations, difficulty ranks, and exact catalog ids. That same deterministic query layer later became important for AI Overview because the model can suggest recipe ids or filters, but the server still resolves cards, links, and nutrition from the real catalog.

The trade-off is operational complexity: a database has secrets, provisioning, migrations, seeding, network failures, cache invalidation, and DB-backed tests. I mitigated that with an example env file, explicit `db:*` scripts, retry logic for idempotent reads, SQL whitelisting for sort expressions, and unit tests that can still exercise the in-memory repository path without requiring Neon.

#### 4. Add advanced features after the foundation was deployed

Reference PRs: [#10](https://github.com/jsegov/hells-kitchen/pull/10), [#11](https://github.com/jsegov/hells-kitchen/pull/11)

I waited to build advanced features until the core app was deployed and the data layer was stable. If these had gone in before the Vercel and Neon decisions, they likely would have been rewritten during the backend consolidation and database migration.

The advanced feature phase turned the list into a catalog experience:

- Sort options for curated order, title, prep time, cook time, difficulty, servings, and date added.
- Uniform multi-select facets for tags, ingredients, diets, and allergens.
- Per-facet drill-down counts from `getRecipeFacets(filters)`.
- Active filter chips, a clear-all action, instant desktop filtering, and a mobile drawer.
- Exact ingredient-id filtering to avoid substring collisions such as "butter" matching "peanut butter".
- Dietary derivation from ingredient metadata instead of trusting recipe tags.
- Allergen exclusion using exact tokens and fail-safe behavior when metadata is missing.
- Nutrition conversion to a `per_100g` basis with unit weights.
- Serving-size controls that scale ingredients and total nutrition together.
- A catalog expansion from 15 recipes to 35 recipes with better breakfast, lunch, dinner, and snack coverage.

The main UX decision was to make filtering feel constrained and reliable rather than free-form everywhere. Name search remains text-based, but tags, ingredients, diets, and allergens are known vocabularies. That makes filters easier to scan, allows result counts, and avoids ambiguous matches. The trade-off is more metadata work in `db/data.json`, `lib/dietary.js`, and the seed pipeline, but that metadata supports both the UI and the AI grounding layer.

#### 5. Add AI Overview last

Reference PR: [#12](https://github.com/jsegov/hells-kitchen/pull/12)

The AI Overview feature was intentionally last because it depends on the earlier decisions. It needs a real catalog, deterministic filters, stable card DTOs, and a server-side finalization path.

The feature uses Vercel AI Gateway with `google/gemini-3-flash` and the AI SDK structured-output flow. The UI streams provisional overview prose, but final recipe cards are not model-authored. The model can name catalog ids and provide filter hints; `POST /api/recipes/overview/resolve` validates the completed object, strips invalid filters, ignores hallucinated ids, and resolves cards through the normal data layer.

That design keeps the LLM in a narrow role: it translates a natural-language request into a recommendation narrative and structured hints. Code remains responsible for catalog membership, URLs, recipe cards, filters, and nutrition. This avoids showing non-existent recipes while still giving the user a more conversational discovery surface.

The trade-offs are cost, latency, provider availability, and abuse controls. The implementation caps query length, uses `no-store` responses for AI routes, adds a per-client in-memory rate limiter, tags Gateway usage, and degrades gracefully when credentials are missing. The in-memory limiter is enough for a take-home demo but would need a shared durable store for production.

#### Completed features

- Core recipe list, detail, and search/filter requirements.
- Single Next.js App Router deployment with JSON API Route Handlers.
- Neon Postgres runtime data source with migration/seed scripts and DB-backed tests.
- Server-side filtering, sorting, cache headers, ISR/static params for detail pages, and transient read retries.
- Advanced catalog facets for tag, ingredient, diet, and allergen filters.
- Derived dietary badges and allergen summaries on cards/detail pages.
- Nutrition totals and per-serving values calculated from ingredient data.
- Serving-size scaling for ingredient amounts and nutrition totals.
- Expanded 35-recipe seed catalog with richer ingredient metadata.
- AI Overview recommendation box that streams provisional prose but resolves final cards from real catalog data.
- Test coverage across pure helpers, Route Handlers, render states, DB-backed paths, serving math, dietary/allergen derivation, facets, sorting, rate limiting, and AI Overview flows.

#### Assumptions and limitations

- Recipe scaling is linear. It works for quantities and nutrition, but seasonings, leavening, pan size, and cook time still require cook judgment.
- Allergen handling is informational and should not be treated as a medical safety guarantee.
- Diet and allergen claims fail closed when ingredient metadata is missing. That is safer, but it can hide recipes until metadata is completed.
- Some ambiguous ingredient amounts, such as ranges or mixed text, are displayed unchanged during scaling.
- Nutrition scaling starts from validated data-layer totals that are rounded to one decimal place.
- The AI Overview rate limiter is in-memory and therefore per-instance. A production version should use a shared durable store.
- The AI Overview depends on Vercel AI Gateway credentials for successful LLM responses, but the rest of the app works without them.

#### Additional features with more time

- Durable global rate limiting for AI requests, likely backed by Redis or Vercel KV.
- Persisted favorite recipes, saved filters, or user-specific recipe collections.
- A shopping-list generator that combines scaled ingredients across selected recipes.
- Parent/child allergen rules, such as optionally expanding nuts into peanuts and tree nuts.
- Admin tooling or CI checks for validating new seed recipes before they reach the database.
- Observability around slow database queries, AI latency/cost, and no-result searches.

#### Research references

- Starter repo: [SPRX-tax/hells-kitchen](https://github.com/SPRX-tax/hells-kitchen)
- Implementation PRs: [#1](https://github.com/jsegov/hells-kitchen/pull/1), [#2](https://github.com/jsegov/hells-kitchen/pull/2), [#3](https://github.com/jsegov/hells-kitchen/pull/3), [#4](https://github.com/jsegov/hells-kitchen/pull/4), [#5](https://github.com/jsegov/hells-kitchen/pull/5), [#6](https://github.com/jsegov/hells-kitchen/pull/6), [#7](https://github.com/jsegov/hells-kitchen/pull/7), [#8](https://github.com/jsegov/hells-kitchen/pull/8), [#9](https://github.com/jsegov/hells-kitchen/pull/9), [#10](https://github.com/jsegov/hells-kitchen/pull/10), [#11](https://github.com/jsegov/hells-kitchen/pull/11), [#12](https://github.com/jsegov/hells-kitchen/pull/12)
- Next.js Route Handlers: [route.js file convention](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- Vercel deployment trade-offs: [Express on Vercel](https://vercel.com/docs/frameworks/backend/express), [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- Neon/Postgres: [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver), [Neon with Vercel](https://neon.com/docs/guides/vercel/), [Neon connection pooling](https://neon.com/docs/connect/connection-pooling), [Postgres pattern matching](https://www.postgresql.org/docs/current/functions-matching.html), [Postgres trigram indexes](https://www.postgresql.org/docs/current/pgtrgm.html)
- Next.js caching: [caching and revalidating](https://nextjs.org/docs/app/getting-started/caching)
- AI: [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), [AI SDK `useObject`](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-object), [AI SDK structured output](https://ai-sdk.dev/docs/reference/ai-sdk-core/output)
