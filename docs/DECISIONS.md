# Decisions

- 2026-10-01 — Health check uses `pg` directly (`SELECT 1`) in `db/pool.ts`. Reason: Prisma and the schema arrive in Phase 2; `pg` is already a Prisma/pg-boss transitive dependency. Phase 2 may replace it with Prisma.
- 2026-10-01 — Added `fastify-plugin` (needed to share the error handler across encapsulation) and `pino-pretty` (spec'd dev logging). Reason: required by the spec'd stack.
- 2026-10-01 — `@mrdash/shared` is built to `dist/` with `tsc`; root `test`/`typecheck`/`dev` build it first. Reason: simplest setup that works for tsx, Vite, Vitest and tsc consumers.
- 2026-10-01 — `pnpm dev` uses `pnpm --parallel` instead of adding `concurrently`. Reason: avoids a dependency.
- 2026-10-01 — Env vars from `.env.example` with empty values are treated as unset; `.env` at repo root is loaded via `process.loadEnvFile`. Reason: no `dotenv` dependency needed on Node 20.12+.
- 2026-10-01 — Tailwind v4 via `@tailwindcss/vite`, design tokens as CSS variables in `styles/tokens.css`. Reason: "latest stable" per spec.
- 2026-10-01 — `db:migrate*`/`db:seed*`/`e2e` scripts are no-ops until Phase 2/10. Reason: CI calls them; the implementations come later.
