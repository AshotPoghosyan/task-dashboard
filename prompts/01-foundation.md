# Phase 1 — Foundation & repo setup

Read: CLAUDE.md, docs/SPEC.md sections 0, 2, 3, 4, 13.

Tasks:
1. Initialize git. Create a PRIVATE GitHub repo `mr-task-dashboard` with
   `gh repo create --private --source=. --push`. If gh is not authenticated,
   print the exact commands I need to run and continue locally.
2. Set up the pnpm monorepo exactly as the folder structure in section 2
   (apps/server, apps/web, packages/shared, docs/).
3. Tooling: tsconfig.base.json (strict), ESLint, Prettier, .editorconfig, .nvmrc,
   lint-staged + simple-git-hooks.
4. docker-compose.yml with Postgres 16, creating both `mrdash` and `mrdash_test`.
5. Server: Fastify app factory (`app.ts`) + entry (`server.ts`), Zod env config,
   pino logging with request IDs, error handler plugin, `GET /api/health`.
6. Web: Vite + React + TS + Tailwind, empty app shell rendering "Dashboard".
7. Root scripts: dev (runs both), build, test, lint, typecheck.
8. `.env.example` from section 13. GitHub Actions CI: install (cached), lint,
   typecheck, test (with Postgres service), build.
9. Create empty docs/DECISIONS.md and docs/ARCHITECTURE.md.

Acceptance:
- `pnpm dev` starts server and web; `/api/health` returns 200 with DB status.
- One passing test in each workspace. CI green on GitHub.

Stop after this phase and give the phase report.
