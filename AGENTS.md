# AGENTS.md

## Project Overview

- Recipe Manager is a full-stack take-home app with a Next.js frontend and an Express backend.
- The actual app folders are `frontend-app` and `backend-app`. Some README setup text still refers to `frontend` and `backend`.
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

## Architecture Notes

- `backend-app/src/server.js` owns Express routes and JSON data access.
- Keep backend response mapping in helper functions instead of returning raw JSON records directly.
- `GET /api/recipes` is the recipe list endpoint and should return list-safe fields, not full detail-only data.
- Future detail work should add `GET /api/recipes/:id` rather than overloading the list endpoint.
- Future search/filter work should extend `GET /api/recipes` with query parameters while preserving the list DTO shape.
- `frontend-app/app` uses the Next.js App Router. Pages are Server Components by default unless interactivity requires a Client Component.
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
