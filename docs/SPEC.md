# Project: MR & Task Tracking Dashboard — Full Build Spec

You are building this project from an empty directory to a tested, production-quality
MVP. Follow this spec exactly. It is the source of truth.

---

## 0. Operating rules (read first)

1. Work autonomously through the phases in Section 11. Do not stop to ask questions.
   If something is not covered, choose the simplest robust option and record it in
   `docs/DECISIONS.md` (date, decision, reason).
2. After every phase: run lint, typecheck, tests, and build. Fix all failures. Commit
   using Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`) and push.
   Never start the next phase while anything is red.
3. Never hardcode secrets. Everything configurable goes through validated env vars.
4. Prefer boring, well-maintained libraries. Do not add a dependency for something
   that takes under 20 lines to write.
5. TypeScript `strict: true` everywhere. No `any` unless commented with a reason.
6. Keep files small and focused (aim for under 250 lines). One responsibility per module.

---

## 1. Goal

An internal dashboard that:

- Tracks features/tasks and their nested sub-bugs.
- Pulls merge requests from GitLab and pull requests from GitHub (API sync + webhooks).
- Updates statuses automatically and pushes changes to open browsers in real time.
- Looks like a polished professional tool (Linear / GitLab quality), dark mode, fast.

---

## 2. Repo setup (from zero)

- Create a PRIVATE GitHub repo `mr-task-dashboard` with `gh repo create --private`.
  If `gh` is not authenticated, run `gh auth status`, print instructions, and continue
  locally. Push once it is available.
- Monorepo with **pnpm workspaces**:

```
mr-task-dashboard/
├── apps/
│   ├── server/                 # Fastify API, jobs, webhooks
│   └── web/                    # React SPA
├── packages/
│   └── shared/                 # Zod schemas, shared types, enums, status logic
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   └── WEBHOOKS.md
├── .github/workflows/ci.yml
├── docker-compose.yml          # Postgres (dev + test databases)
├── .env.example
├── .editorconfig
├── .gitignore
├── package.json                # root scripts: dev, build, test, lint, typecheck, db:*
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

- Tooling: ESLint (typescript-eslint), Prettier, lint-staged + simple-git-hooks
  (pre-commit: lint + format staged files), Node 20 LTS pinned via `.nvmrc` and `engines`.
- Root `pnpm dev` starts Postgres check, server, and web concurrently.

---

## 3. Tech stack (fixed, do not substitute)

**Backend (`apps/server`)**

- Node.js 20, TypeScript, **Fastify** (with `@fastify/helmet`, `@fastify/cors`,
  `@fastify/rate-limit`, `@fastify/sensible`)
- **PostgreSQL 16** via Docker Compose
- **Prisma** ORM + migrations
- **Zod** for env, request, and response validation (schemas live in `packages/shared`)
- **pg-boss** for background jobs (uses Postgres, no Redis needed)
- **pino** structured logging (pretty in dev, JSON in prod), request IDs
- Real time: **Server-Sent Events** (`GET /api/events`)

**Frontend (`apps/web`)**

- React 18, Vite, TypeScript
- Tailwind CSS (latest stable) with design tokens as CSS variables
- **TanStack Query** (server state), **TanStack Table** (tables),
  **TanStack Virtual** (row virtualization)
- React Router (lazy-loaded routes)
- Radix UI primitives (dropdowns, dialogs, tooltips, popovers) for accessibility
- lucide-react icons, date-fns (+ date-fns-tz)

**Testing**

- Vitest (server + web + shared)
- Fastify `inject` for API tests
- Testing Library for components
- Playwright for E2E
- Real Postgres test database (from docker-compose) for integration tests, reset per test file

---

## 4. Architecture

### Backend layering (strict, one direction only)

```
routes (HTTP, validation) → services (business logic) → repositories (Prisma only)
                                   ↓
                    providers (GitLab / GitHub adapters)
                    jobs (pg-boss workers)
                    events (in-process event bus → SSE)
```

- Routes never touch Prisma directly. Repositories contain no business logic.
- All external API access goes through `providers/`.

```
apps/server/src/
├── app.ts                  # builds Fastify instance (used by tests)
├── server.ts               # starts it
├── config/env.ts           # Zod-validated env, fails fast on boot
├── db/prisma.ts
├── plugins/                # auth, error handler, sse, rate limit
├── routes/                 # tasks, merge-requests, stats, sync, webhooks, events, health
├── services/               # taskService, mrService, statusService, statsService, syncService
├── repositories/
├── providers/
│   ├── types.ts            # GitProvider interface + NormalizedMR
│   ├── gitlab/             # client, mapper, webhook parser
│   └── github/
├── jobs/                   # syncRepos job, schedule
├── events/bus.ts
└── utils/
```

```
apps/web/src/
├── main.tsx / App.tsx / router.tsx
├── api/                    # typed fetch client + query hooks per resource
├── components/
│   ├── ui/                 # Button, Badge, Card, Input, Select, Skeleton, Tooltip, EmptyState
│   ├── layout/             # AppShell, Sidebar, TopBar
│   └── data/               # DataTable, FilterBar, StatCard, StatusBadge, ProviderIcon
├── features/
│   ├── tasks/              # TasksPage, TaskRow, SubBugRows, TaskDrawer, TaskForm
│   └── merge-requests/     # MergeRequestsPage, MrRow
├── hooks/                  # useUrlFilters, useDebounce, useSSE, useHotkeys
├── lib/                    # formatters, cn(), constants
└── styles/tokens.css
```

`packages/shared` exports: enums, Zod schemas, inferred types, the **status mapping
functions**, and the **task status aggregation** function, so frontend and backend agree
on the same rules.

---

## 5. Database design (PostgreSQL + Prisma)

Store all timestamps as `timestamptz` in UTC. Use `cuid`/`uuid` primary keys for app
entities. Add `createdAt` and `updatedAt` to every table.

### Enums

- `Provider`: GITLAB, GITHUB
- `MrStatus`: DRAFT, OPEN, IN_REVIEW, MERGED, CLOSED
- `TaskType`: FEATURE, TASK, BUG
- `TaskStatus`: same values as MrStatus plus NO_MR
- `SyncStatus`: RUNNING, SUCCESS, FAILED

### Tables

**repositories**

- id, provider, externalId (GitLab project id / GitHub `owner/repo`), fullPath, webUrl,
  defaultBranch, isActive, lastSyncedAt
- UNIQUE(provider, externalId)

**git_users**

- id, provider, externalId, username, displayName, avatarUrl
- UNIQUE(provider, externalId)

**merge_requests**

- id, repositoryId (FK), provider, externalId, number (iid / PR number), title,
  description, status, isDraft, sourceBranch, targetBranch, url, authorId (FK git_users),
  assigneeId (FK git_users, nullable), createdAtRemote, updatedAtRemote, mergedAt, closedAt
- UNIQUE(repositoryId, number)
- INDEX(status), INDEX(targetBranch), INDEX(assigneeId), INDEX(updatedAtRemote DESC),
  INDEX(mergedAt)
- GIN trigram index on title (enable `pg_trgm` in a migration) for fast search

**merge_request_reviewers** (join)

- mergeRequestId, gitUserId, state (REQUESTED, APPROVED, CHANGES_REQUESTED)
- PK(mergeRequestId, gitUserId)

**tasks**

- id, title, type, status, statusOverride (nullable, manual override), assigneeName,
  targetBranch, notes, parentId (self FK, nullable, ON DELETE CASCADE), sortOrder
- INDEX(parentId), INDEX(status), INDEX(targetBranch), trigram index on title
- Rule enforced in service layer: max one level of nesting (a sub-bug cannot have children)

**task_merge_requests** (join, a task can have several MRs)

- taskId, mergeRequestId, PK(taskId, mergeRequestId)

**webhook_events**

- id, provider, deliveryId (GitLab `X-Gitlab-Event-UUID` / GitHub `X-GitHub-Delivery`),
  eventType, receivedAt, processedAt, error, payload (jsonb)
- UNIQUE(provider, deliveryId)
- Retention: job deletes rows older than 30 days

**sync_runs**

- id, repositoryId, status, startedAt, finishedAt, itemsFetched, itemsUpserted, error

Seed script (`pnpm db:seed`): 2 repos, 8 users, ~40 MRs across all statuses,
12 tasks with sub-bugs, some linked to MRs. Include a `pnpm db:seed:large` that
creates 10,000 MRs and 2,000 tasks for performance testing.

---

## 6. Status rules (in `packages/shared`, fully unit tested)

### MR status mapping

**GitLab** (`state`, `draft`, reviewers):

- merged → MERGED
- closed → CLOSED
- opened + draft → DRAFT
- opened + at least one reviewer → IN_REVIEW
- opened otherwise → OPEN

**GitHub** (`state`, `merged_at`, `draft`, requested reviewers / reviews):

- merged_at set → MERGED
- closed → CLOSED
- open + draft → DRAFT
- open + requested reviewers or any review submitted → IN_REVIEW
- open otherwise → OPEN

### Task status aggregation (from linked MRs)

- `statusOverride` set → use it
- No linked MRs → NO_MR
- All linked MRs MERGED → MERGED
- All linked MRs CLOSED/MERGED with at least one CLOSED and none open → CLOSED
- Otherwise use the "least advanced" open status, in this priority:
  DRAFT < OPEN < IN_REVIEW
- Recalculate a task's status whenever any linked MR changes (in the same transaction).

---

## 7. Integrations

### Provider interface

```ts
interface GitProvider {
  listMergeRequests(repo: Repository, updatedSince?: Date): AsyncIterable<NormalizedMR>;
  parseWebhook(headers, body): NormalizedMR | null;
  verifyWebhook(headers, rawBody): boolean;
}
```

### Sync

- pg-boss job per active repository every `SYNC_INTERVAL_MINUTES` (default 5).
- First run: full sync. Later runs: incremental (`updated_after` on GitLab, `sort=updated`
  plus stop when older than last sync on GitHub).
- Handle pagination, respect rate-limit headers, exponential backoff on 429/403/5xx,
  max 3 retries. One repo failing must not stop the others.
- Upsert MRs, users, and reviewers in batched transactions.
- Record each run in `sync_runs`. Emit `mr.updated` / `sync.finished` events.
- Missing token for a provider → skip with a warning, never crash.

### Webhooks

- `POST /api/webhooks/gitlab` and `POST /api/webhooks/github`
  (keep `/api/gitlab-webhook` as an alias of the GitLab route).
- GitLab: verify `X-Gitlab-Token` against `GITLAB_WEBHOOK_SECRET` using constant-time compare.
- GitHub: verify `X-Hub-Signature-256` HMAC over the raw body with `GITHUB_WEBHOOK_SECRET`.
- Invalid signature → 401. Irrelevant event types → 200, ignored.
- Idempotency: insert into `webhook_events` first. If the delivery ID already exists → 200, skip.
- Respond within 1 second: store the event, enqueue a pg-boss job, return 202.
  The worker does the upsert, recalculates task status, and emits events.
- Unknown MR on a known repo → create it. Unknown repo → log and ignore.
- Parent linking from MR description: `Task: #<taskId>` links the MR to that task.
  `Parent: !<number>` (GitLab) or `Parent: #<number>` (GitHub) creates/links a BUG sub-task
  under the task linked to the parent MR.

---

## 8. REST API

All responses validated with shared Zod schemas. Errors use one shape:
`{ error: { code, message, details? } }`. Cursor-based pagination
(`?cursor=&limit=`, default 50, max 200).

- `GET /api/health`: DB + job queue status
- `GET /api/tasks`: top-level tasks with nested sub-bugs and linked MR summaries.
  Filters: status, assignee, targetBranch, type, q
- `GET /api/tasks/:id`
- `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/merge-requests` / `DELETE /api/tasks/:id/merge-requests/:mrId`: link/unlink
- `GET /api/merge-requests`: filters provider, repositoryId, status, authorId,
  assigneeId, reviewerId, targetBranch, q. Sort: updatedAt desc (default), createdAt, title
- `GET /api/stats`: `{ openMrs, pendingReviews, mergedToday, draft, closedThisWeek }`
  - openMrs = DRAFT + OPEN + IN_REVIEW
  - pendingReviews = IN_REVIEW
  - mergedToday = mergedAt within the current day in `APP_TIMEZONE` (default `Asia/Yerevan`)
- `GET /api/filters/options`: distinct assignees, branches, repos (for dropdowns)
- `GET /api/repositories`, `POST /api/sync` (manual trigger), `GET /api/sync/status`
- `GET /api/events`: SSE stream (`mr.updated`, `task.updated`, `sync.finished`),
  with a heartbeat every 25s

### Access control (MVP)

- If `DASHBOARD_PASSWORD` is set, require login: a simple password form issues an
  httpOnly, secure, sameSite=strict session cookie signed with `SESSION_SECRET`.
- Webhook routes are exempt (they use signatures instead).
- Rate limit the login route and all APIs (sensible defaults).

---

## 9. UI / UX design

### Visual language

- Dark mode only. Calm, dense, professional. Reference quality: Linear, Vercel dashboard.
- Tokens in `styles/tokens.css`, mapped into the Tailwind theme:
  - Background `#0B0D12`, surface `#12151C`, raised `#181C25`, border `#232837`
  - Text primary `#E6E8EE`, secondary `#9AA3B2`, muted `#6B7385`
  - Accent (brand) `#6E7BFF`
- Status colors (subtle tinted background + colored text + 1px border, WCAG AA contrast):
  MERGED purple, IN_REVIEW amber, OPEN green, DRAFT slate, CLOSED red, NO_MR neutral.
  Each badge also has an icon, so status is never communicated by color alone.
- Typography: Inter (self-hosted via `@fontsource/inter`), tabular numbers for counts and dates.
- 4px spacing grid, 8px radius on cards, 6px on inputs and badges. No heavy shadows,
  use borders and surface steps instead.
- Motion: 150ms ease-out for expand/collapse and hovers. Respect `prefers-reduced-motion`.

### Layout

- App shell: collapsible left sidebar (Tasks, Merge Requests, Sync status),
  top bar with global search and a sync indicator.
- Responsive: full layout ≥ 1024px. On tablet/mobile the sidebar becomes a drawer and
  tables drop low-priority columns (branch, dates) into the expanded row.

### Tasks page (`/`)

- Stat cards row: Total Open MRs, Pending Reviews, Merged Today (+ small secondary
  line such as "3 more than yesterday" when available). Clicking a card applies that filter.
- Filter bar: search (debounced 250ms, `/` shortcut focuses it), multi-select filters
  for status, assignee, target branch, type. Active filters shown as removable chips.
  "Clear all". All filter state stored in URL query params (shareable links).
- Table: chevron to expand/collapse sub-bugs, sub-bug count pill, expand-all/collapse-all,
  columns: ID, Title, Type, Assignee (avatar + name), Status, Target branch, Linked MRs,
  Created, Merged, Notes preview.
- Sub-bug rows indented with a subtle left guide line.
- Clicking a row opens a right-side drawer with full details, linked MRs, editable
  notes (autosave, debounced), status override, and link/unlink MR.
- "New task" button opens a dialog form with validation.

### Merge Requests page (`/merge-requests`)

- Stat cards per status. Filter bar: provider, repo, status, author, assignee,
  reviewer, target branch, search.
- Virtualized table: provider icon, repo, !number / #number, title, author, reviewers
  (avatar stack with approval state), status, source → target branch, age
  ("3d ago", full date on hover), linked task.
- "Sync now" button with last-synced time and per-repo errors in a popover.

### States and polish

- Skeleton loaders that match the final layout (no layout shift).
- Designed empty states (e.g. "No merge requests match these filters", plus a clear-filters action).
- Error states with retry. Toast notifications for mutations and live updates.
- Rows updated via SSE briefly highlight.
- Keyboard: `/` search, `j`/`k` move selection, `Enter` open drawer, `Esc` close,
  `e` expand/collapse row. Visible focus rings everywhere.
- Accessibility: semantic table markup, aria-expanded on row toggles, labeled inputs,
  full keyboard navigation, passes axe checks.

---

## 10. Performance requirements (measured, not assumed)

**Backend**

- `GET /api/merge-requests` and `GET /api/tasks` p95 < 100ms locally with the large seed.
- No N+1 queries: use Prisma `include`/`select` deliberately and select only needed columns.
- Verify with `EXPLAIN ANALYZE` that list/filter/search queries use indexes. Document
  results in `docs/ARCHITECTURE.md`.
- gzip/brotli compression, ETag on GET list endpoints.
- `/api/stats` cached in memory for 10s and invalidated on MR events.

**Frontend**

- Initial JS < 200KB gzipped. Routes code-split with `React.lazy`.
  Add `rollup-plugin-visualizer` report.
- Tables virtualized: 10,000 rows scroll at 60fps.
- TanStack Query: sensible `staleTime` (30s), placeholder data while filtering
  (no flashing), SSE events invalidate only affected queries.
- Memoize row components. No re-rendering of the whole table on expand/collapse.
- Lighthouse (desktop) ≥ 90 for Performance and Accessibility.

---

## 11. Build phases and acceptance criteria

**Phase 1: Foundation**
Repo, workspaces, tooling, docker-compose Postgres, env validation, Fastify skeleton
with health route, Vite app shell, CI workflow.
✅ `pnpm dev` runs both apps. `pnpm lint typecheck test build` all pass in CI.

**Phase 2: Database**
Prisma schema, migrations (including pg_trgm and indexes), seed + large seed.
✅ Migrations apply cleanly on an empty DB. Seeds run. Schema matches Section 5.

**Phase 3: Shared domain logic**
Enums, Zod schemas, status mapping, task aggregation.
✅ 100% test coverage on status functions, including edge cases.

**Phase 4: Core API**
Tasks, merge requests, stats, filters, repositories. Error handling, pagination, auth.
✅ Integration tests for every endpoint (happy path, validation errors, filters, pagination).

**Phase 5: Providers + sync**
GitLab and GitHub adapters, pg-boss sync job, manual sync endpoints.
✅ Adapter tests use recorded JSON fixtures (no live network). Pagination, rate-limit
backoff, incremental sync, and missing-token behavior are tested.

**Phase 6: Webhooks + real time**
Both webhook routes, verification, idempotency, queue processing, SSE.
✅ Fixture payloads for GitLab (open, draft, reviewer added, merged, closed) and GitHub
(opened, draft, review_requested, closed+merged, closed). Tests cover bad signature,
duplicate delivery, unknown repo, parent linking, and task status recalculation.

**Phase 7: Frontend: Tasks page**
Design tokens, UI components, app shell, Tasks page complete per Section 9.
✅ Component tests for StatusBadge, FilterBar, expandable rows, drawer.

**Phase 8: Frontend: Merge Requests page + live updates**
MR page, sync UI, SSE integration, toasts, keyboard shortcuts.
✅ Component tests plus a manual check that updates from a curl'd webhook appear live.

**Phase 9: E2E, performance, hardening**
Playwright flows: login, filter tasks, expand sub-bugs, edit notes, receive a webhook
update, MR page filters. Run large-seed performance checks. Axe accessibility checks.
✅ All E2E pass. Performance targets in Section 10 met and documented.

**Phase 10: Documentation + containers**
README (setup in under 5 commands, env vars table, scripts), `docs/WEBHOOKS.md`
(expose with ngrok/cloudflared, GitLab and GitHub webhook setup step by step, which
events to tick, secrets), `docs/ARCHITECTURE.md` (diagram in Mermaid, layers, data flow),
production Dockerfiles for server and web, `docker-compose.prod.yml`.
✅ A fresh clone runs by following the README only.

---

## 12. Testing strategy summary

| Layer                 | Tool                      | What                                  |
| --------------------- | ------------------------- | ------------------------------------- |
| Shared logic          | Vitest                    | Status mapping, aggregation, schemas  |
| Repositories/services | Vitest + real Postgres    | Queries, transactions, upserts        |
| API                   | Fastify inject            | Every route, auth, errors, pagination |
| Providers             | Vitest + fixtures         | Mapping, pagination, backoff          |
| Webhooks              | Fastify inject + fixtures | Signatures, idempotency, processing   |
| Components            | Testing Library           | Badges, filters, rows, drawer, forms  |
| E2E                   | Playwright                | Critical user flows                   |

- Coverage target: ≥ 80% lines on `apps/server/src/services` and `packages/shared`.
- CI (GitHub Actions): install with cache → lint → typecheck → unit + integration
  (Postgres service container) → build → Playwright (on main branch and PRs).

---

## 13. Environment variables (`.env.example`)

```
NODE_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://app:app@localhost:5432/mrdash
DATABASE_URL_TEST=postgresql://app:app@localhost:5432/mrdash_test
APP_TIMEZONE=Asia/Yerevan
SESSION_SECRET=
DASHBOARD_PASSWORD=
GITLAB_BASE_URL=https://gitlab.com
GITLAB_TOKEN=                # scope: read_api
GITLAB_WEBHOOK_SECRET=
GITHUB_TOKEN=                # fine-grained, Pull requests: read, Metadata: read
GITHUB_WEBHOOK_SECRET=
SYNC_INTERVAL_MINUTES=5
LOG_LEVEL=info
```

Tokens must be read-only. Nothing in this app needs write access to repositories.

---

## 14. Out of scope (MVP)

Multi-user accounts and roles, writing back to GitLab/GitHub, Bitbucket, light theme,
cloud deployment automation. Keep the provider interface and auth plugin structured so
these can be added without refactoring.

---

## 15. Definition of done

- Every phase's acceptance criteria met, CI green, everything pushed.
- Fresh clone → README steps → working app with seeded data.
- Curl-ing each webhook fixture updates the UI live.
- Performance and accessibility results recorded in `docs/ARCHITECTURE.md`.
- `docs/DECISIONS.md` lists every choice made that this spec did not cover.
