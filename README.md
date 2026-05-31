# Recipe Manager - Full Stack Take-Home Exercise

## Overview

Create a recipe management application that allows users to view, search, and organize recipes. This exercise tests your ability to build a full-stack web application with a focus on data relationships and user experience.

## Current Implementation

- The app is a single Next.js App Router application at the repository root. Its JSON API is served by Next.js Route Handlers (the original Express `backend-app` has been folded in).
- `/` redirects to `/recipes`.
- `/recipes` displays recipe list cards and supports filtering by recipe name, tags, and ingredients through query parameters.
- `/recipes/:id` displays ingredients with quantities, cooking instructions, tags, and nutrition totals/per-serving values calculated from ingredients.
- Next.js Route Handlers expose `GET /api/recipes` for list-safe recipe data and `GET /api/recipes/:id` for full recipe detail data. Server Components call the same data layer (`lib/recipes.js`) directly, with no internal HTTP hop.
- Runtime data is served from Neon Postgres. `db/data.json` is retained as seed data for local and preview databases.

## Tips

- Use whatever frameworks/tools you're most comfortable with
- Focus on creating a working MVP before adding advanced features
- Be sure to document any assumptions or known limitations
- Test your application with different scenarios

## Setup Instructions

#### Setup

```
npm ci
npm run db:reset # Applies schema and seeds Neon from db/data.json
npm run dev # Starts the Next.js app (pages + API) on port 3000, or the next available port
```

Requires Node.js 20.9.0 or newer. For Vercel-linked projects, pull environment variables with `vercel env pull .env.local` before running database commands.

#### Database setup

The application uses Neon Postgres at runtime. `db/data.json` is the seed source of truth, and `npm run db:reset` runs both `db:migrate` and `db:seed`.

#### Environment variables

- `DATABASE_URL` is required for the app runtime and DB-backed tests.
- `DATABASE_URL_UNPOOLED` is required for `npm run db:migrate`, `npm run db:seed`, and `npm run db:reset`.
- `API_BASE_URL` and `CORS_ORIGIN` are obsolete now that the API runs in-process within the Next.js app.

#### Quality gates

```
npm run check      # Fast non-DB gate: typecheck, lint, format check, unit/render tests
npm run test:db    # DB-backed repository and API route tests; requires DATABASE_URL
npm run build
npm audit --omit=dev
npm run check:full # Full deploy/PR gate combining all of the above
```

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

#### Setup instructions

No new setup requirements were added. Use the existing commands documented above.

#### Implementation choices

- Advanced list features share one `getRecipeList(filters, sort)` contract across the in-memory repository, Neon-backed repository, API route, and `/recipes` page.
- Sort keys are defensively normalized and mapped to whitelisted SQL expressions; in-memory sorting uses matching parsers/comparators with nulls sorted last and stable curated-order tie breaks.
- Dietary suitability is derived from ingredient metadata rather than recipe tags. Vegan ingredients imply vegetarian suitability; positive diet claims fail closed when ingredient metadata is missing.
- Allergen exclusion uses exact tokens, not substring matching, and missing ingredient metadata fails safe when an allergen exclusion is active.
- Serving-size scaling lives in a browser-safe pure math module and one client component that owns the target serving count for both ingredient quantities and nutrition totals.

#### Completed features

- Sorting by curated order, title, prep time, cook time, difficulty, servings, and date added, with ascending/descending order.
- Dietary filters for vegetarian, vegan, gluten-free, keto, and high-protein.
- Allergen exclusion for dairy, eggs, fish, gluten, nuts, peanuts, sesame, shellfish, soy, tree nuts, and wheat.
- Derived dietary badges on recipe cards and detail pages.
- Detail-page allergen summary with a verification note.
- Serving-size control with presets and numeric input that scales ingredients and nutrition together.
- Additional unit/render/API/DB coverage for sorting, dietary derivation, allergen filtering, and serving-size math.

#### Assumptions

- Recipe scaling is linear. Seasoning, leavening, and cook times still require cook judgment.
- Current seed data is small enough that dietary/allergen post-filtering after SQL text filtering is appropriate and keeps derivation logic shared.
- The hardcoded diet/allergen option lists intentionally define the public filter surface; tests guard against seed-data drift.

#### Known limitations or bugs

- Ingredient amounts that are ambiguous or not safely parseable, such as ranges or mixed numbers, are displayed unchanged during scaling.
- Nutrition scaling starts from the validated recipe total exposed by the data layer, which is already rounded to one decimal place.
- Allergen handling is informational and should not be treated as a medical safety guarantee.

#### Additional features with more time

- Parent/child allergen rules, such as optionally expanding nuts into peanuts and tree nuts.
- Persisted favorite recipes or saved filter presets.
- A shopping-list generator that combines scaled ingredients across selected recipes.
