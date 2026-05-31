# Repository Guidelines

## Project Structure & Module Organization

The repo is a single Next.js App Router app at the repository root: `app/` for pages and `app/api/` for Route Handlers, the data layer in `lib/recipes.js`, mock data in `db/data.json`, colocated styles, and Jest specs in `test/`. Shared agent guidance sits in `CLAUDE.md`; deployment planning lives in `VERCEL_DEPLOYMENT_PLAN.md`. (The former Express `backend-app/` has been folded in — see `VERCEL_DEPLOYMENT_PLAN.md`, Phase 1.)

## Build, Test, and Development Commands

From the repository root: `npm ci`, `npm run dev` (Turbopack at :3000), `npm run build`, `npm test`, and `npm run check` (typecheck + lint + format + tests). Run `npm run check` before opening a PR.

## Coding Style & Naming Conventions

The app uses 2-space indentation, double quotes, and semicolons enforced by Prettier (`prettier.config.mjs`). ESLint (`eslint.config.mjs`) extends the Next.js core-web-vitals and Prettier configs. Use `camelCase` for variables/functions, `PascalCase` for React components, and keep modules small and focused. Components are Server Components unless they need interactivity (`"use client"`).

## Testing Guidelines

Jest powers the app. Co-locate specs under `test/` and name them `*.test.js`. Specs cover the data layer/helpers, the Route Handlers, data fetching, filters, and rendering. Run `npm test` (or `npm run check`) before pushing, and add coverage for new branches/edge cases.

## Commit & Pull Request Guidelines

Use Conventional Commits (e.g., `feat:`, `fix:`, `chore:`) as in the existing history. PRs should include a concise summary, linked issues, and screenshots for UI changes. Confirm `npm run check` passes and note any skipped checks.

## Security & Configuration Tips

Keep secrets in environment variables; never commit `.env` files. Validate and sanitize any new recipe data added to `db/data.json`.

## Agent-Specific Notes

Mirror existing defensive patterns (input validation, typed helpers) when extending recipe data flows. Keep changes minimal and aligned with the take-home requirements, and update docs when behavior changes.
