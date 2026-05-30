# AGENTS.md

## Project Overview

- Recipe Manager is a full-stack take-home app with a Next.js frontend and an Express backend.
- The app folders are `frontend-app` and `backend-app`.
- The mock database is `backend-app/db/data.json`.
- Core requirements are listed in `README.md`; implement only the requested requirement unless the user expands scope.

## Setup Commands

- Install backend dependencies: `cd backend-app && npm ci`
- Install frontend dependencies: `cd frontend-app && npm ci`
- Start backend: `cd backend-app && npm run dev`
- Start frontend: `cd frontend-app && npm run dev`
- Build frontend: `cd frontend-app && npm run build`

## Local Services

- Backend defaults to `http://localhost:8080`.
- Frontend defaults to `http://localhost:3000`; Next.js may choose another port if 3000 is already in use.
- Frontend server-side API calls should read `process.env.API_BASE_URL` and default to `http://localhost:8080`.
- Backend CORS should use the `CORS_ORIGIN` comma-separated allowlist when set, support `*` as an allow-any-origin wildcard, and otherwise allow local frontend origins on ports `3000` and `3001`.

## Architecture Notes

- `backend-app/src/server.js` owns Express routes and JSON data access.
- Keep backend response mapping in helper functions instead of returning raw JSON records directly.
- `GET /api/recipes` is the recipe list endpoint and returns list-safe fields only: id, title, description, servings, prep time, cook time, difficulty, tags, and ingredient count.
- `GET /api/recipes` supports `name`, `tag`, and `ingredient` query parameters. Preserve its list DTO shape when extending filters.
- `GET /api/recipes/:id` is the detail endpoint and returns ingredients, instructions, tags, and calculated nutrition.
- Backend list DTO mapping should reject records without non-empty string `id` and `title`, normalize malformed scalar fields, keep tags string-only, and count only valid ingredient references.
- `frontend-app/app` uses the Next.js App Router. Pages are Server Components by default unless interactivity requires a Client Component.
- Frontend API helpers should validate backend payload shapes at runtime before rendering and show visible error states for invalid data.
- Route-specific styles should use CSS modules. Keep `app/globals.css` limited to global tokens and resets.

## Code Style

- Match the existing JavaScript style: ES modules in the frontend, CommonJS in the backend.
- Prefer small, explicit helpers over broad abstractions.
- Keep UI copy concise and user-facing.
- Use semantic HTML for list/detail surfaces.
- Keep API errors JSON-shaped and frontend error states visible.
- Do not introduce TypeScript, state libraries, styling frameworks, or new build tools unless the user asks.

## Testing and Verification

- Unit tests use Jest in both apps.
- Run backend tests: `cd backend-app && npm test`
- Run frontend tests: `cd frontend-app && npm test`
- Run backend quality gates: `cd backend-app && npm run check`
- Run frontend quality gates: `cd frontend-app && npm run check`
- `npm run check` includes strict JavaScript typechecking, ESLint, Prettier format checking, and Jest.
- For backend API changes, smoke test with `curl` and inspect JSON with `jq` when available.
- For backend CORS changes, smoke test allowed and disallowed `Origin` headers.
- For frontend changes, also run `npm run build` in `frontend-app`.
- Frontend build-time linting is disabled in `next.config.mjs`; use `npm run lint` or `npm run check` instead.
- For UI changes, start both servers and verify the affected route in a browser at desktop and mobile widths.

## Dependency Notes

- Use `npm ci` from the existing lockfiles for reproducible installs.
- Do not run `npm audit fix` or upgrade dependencies automatically; those changes can alter lockfiles and app behavior outside the requested task.

## Git and Scope

- Preserve user changes. Do not revert unrelated work.
- Keep changes tightly scoped to the requested requirement.
- Do not update README Candidate Notes unless the user asks for submission documentation.
