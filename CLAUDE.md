# CLAUDE.md — Project rules (always apply)

Project: MR & Task Tracking Dashboard. The full specification is `docs/SPEC.md`.
It is the source of truth. Read the sections a task references before writing code.

## How we work
- Work only on the phase you were given. Do not start later phases.
- Do not ask questions. If the spec does not cover something, choose the simplest
  robust option and add an entry to `docs/DECISIONS.md` (date, decision, reason).
- Before finishing a phase, run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
  Fix every failure. Never skip, disable, or weaken a test to make it pass.
- Commit with Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`), then push.
- Finish every phase with the report format below.

## Stack (fixed)
pnpm workspaces · Node 20 · TypeScript strict · Fastify · PostgreSQL 16 · Prisma ·
Zod · pg-boss · pino · SSE · React 18 + Vite · Tailwind · TanStack Query/Table/Virtual ·
React Router · Radix UI · Vitest · Testing Library · Playwright.
Do not add or swap libraries without logging it in DECISIONS.md.

## Architecture rules
- Backend flow: routes → services → repositories. Routes never import Prisma.
  Repositories contain no business logic. External APIs only via `providers/`.
- Shared Zod schemas, enums, and status logic live in `packages/shared` and are
  imported by both apps. Never duplicate them.
- Files focused and under ~250 lines. No `any` without a comment explaining why.
- All config through `apps/server/src/config/env.ts` (Zod-validated). No hardcoded secrets.
- Timestamps stored in UTC; display in `APP_TIMEZONE`.

## Code quality
- Tests next to code (`*.test.ts`) or in `__tests__`. Every bug fix gets a regression test.
- Integration tests use the real Postgres test database, never mocks of Prisma.
- No `console.log` in committed code; use the pino logger.
- Frontend: use design tokens only (no raw hex in components), accessible markup,
  keyboard support.

## Commands
- `pnpm dev` · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm build`
- `pnpm db:migrate` · `pnpm db:seed` · `pnpm db:seed:large` · `pnpm e2e`

## Phase report format
```
## Phase N report
Done: <what was built>
Tests: <counts, coverage where relevant>
Decisions: <new DECISIONS.md entries>
Deviations from spec: <none / list with reason>
Known issues / follow-ups: <list>
Commit: <hash>
```
