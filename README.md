# MR & Task Tracking Dashboard

A single-page dashboard that tracks merge/pull requests from GitLab and GitHub and the tasks
they belong to. MR status is synced on a schedule and updated live from webhooks (SSE), and task
status is derived from linked MRs by shared rules. Read-only against your repositories.

> Screenshots: run the app with the seed data (below) and open <http://localhost:5173>.
> The Tasks page shows the task tree with derived status; the Merge Requests page shows the live,
> filterable, virtualized MR table. (Binary screenshots are not committed by the automation agent.)

## Quick start (5 commands)

Requires Node 20, pnpm 9 (`corepack enable`) and Docker (for PostgreSQL 16).

```bash
git clone <repo-url> mr-task-dashboard && cd mr-task-dashboard
cp .env.example .env && docker compose up -d --wait   # Postgres on :5432
pnpm install                                           # also generates the Prisma client
pnpm db:migrate:deploy && pnpm db:seed                 # schema + demo data
pnpm dev                                               # web :5173, API :4000
```

Open <http://localhost:5173>. With an empty `DASHBOARD_PASSWORD` no login is required. To
require one, set `DASHBOARD_PASSWORD` and a `SESSION_SECRET` of at least 16 characters in `.env`.

To sync real data, set `GITLAB_TOKEN` / `GITHUB_TOKEN` (read-only) and configure webhooks, see
[docs/WEBHOOKS.md](docs/WEBHOOKS.md). `pnpm db:seed` replaces all data with demo data; do not
run it against a database you care about.

## Environment variables

Config is validated at boot by `apps/server/src/config/env.ts`; the server refuses to start on
invalid values.

| Variable                | Default                 | Description                                                                 |
| ----------------------- | ----------------------- | --------------------------------------------------------------------------- |
| `NODE_ENV`              | `development`           | `development`, `test` or `production`                                       |
| `PORT`                  | `4000`                  | API port                                                                    |
| `WEB_ORIGIN`            | `http://localhost:5173` | Allowed CORS origin (the URL users open)                                    |
| `DATABASE_URL`          | required                | PostgreSQL connection string                                                |
| `DATABASE_URL_TEST`     | -                       | Database for integration tests and E2E                                      |
| `APP_TIMEZONE`          | `Asia/Yerevan`          | IANA timezone for display and "today" boundaries                            |
| `DASHBOARD_PASSWORD`    | empty (no auth)         | Shared password protecting `/api/*`                                         |
| `SESSION_SECRET`        | empty                   | Cookie signing key, 16+ chars when a password is set                        |
| `GITLAB_BASE_URL`       | `https://gitlab.com`    | GitLab instance URL                                                         |
| `GITLAB_TOKEN`          | empty                   | Token with `read_api` scope                                                 |
| `GITLAB_WEBHOOK_SECRET` | empty                   | Secret token; empty rejects all GitLab webhooks                             |
| `GITHUB_TOKEN`          | empty                   | Fine-grained token: Pull requests read, Metadata read                       |
| `GITHUB_WEBHOOK_SECRET` | empty                   | HMAC secret; empty rejects all GitHub webhooks                              |
| `SYNC_INTERVAL_MINUTES` | `5`                     | Periodic sync interval per active repository                                |
| `RATE_LIMIT_MAX`        | `300`                   | Requests per minute per client (login is limited to 5/min)                  |
| `TRUST_PROXY_HOPS`      | `0`                     | Trusted reverse-proxy hops for client IP (rate limits); prod compose sets 1 |
| `LOG_LEVEL`             | `info`                  | pino level                                                                  |
| `POSTGRES_PASSWORD`     | required (prod compose) | Only read by `docker-compose.prod.yml`                                      |
| `WEB_PORT`              | `8080`                  | Only read by `docker-compose.prod.yml`: published web port                  |

## Scripts

| Command                                | What it does                                                          |
| -------------------------------------- | --------------------------------------------------------------------- |
| `pnpm dev`                             | Builds `shared`, then runs API and web with reload                    |
| `pnpm build`                           | Builds every package                                                  |
| `pnpm test`                            | Unit and integration tests (needs `DATABASE_URL_TEST`, see below)     |
| `pnpm lint` / `pnpm typecheck`         | ESLint + Prettier check / TypeScript strict across the workspace      |
| `pnpm db:migrate`                      | Create/apply a migration in development (`prisma migrate dev`)        |
| `pnpm db:migrate:deploy`               | Apply existing migrations (production-safe)                           |
| `pnpm db:seed` / `pnpm db:seed:large`  | Demo data / 10,000 MRs and 2,000 tasks for performance work           |
| `pnpm e2e`                             | Playwright E2E against production builds and the large seed           |
| `pnpm bench` / `pnpm db:explain`       | API p95 benchmark / `EXPLAIN ANALYZE` of list queries                 |
| `pnpm bundle:size` / `pnpm lighthouse` | Initial-JS budget check / Lighthouse (see ARCHITECTURE → Performance) |

Tests use the real database in `DATABASE_URL_TEST`. `docker compose up` creates `mrdash_test`
next to `mrdash`; the test URL is already in `.env.example`. E2E needs
`pnpm exec playwright install chromium` once.

## Production with Docker

```bash
cp .env.example .env     # set DASHBOARD_PASSWORD, SESSION_SECRET, tokens, webhook secrets
export POSTGRES_PASSWORD=$(openssl rand -hex 16)   # keep it: the database volume uses it
docker compose -f docker-compose.prod.yml up -d --build
```

Starts Postgres, a one-shot `migrate` job, the API (non-root, `/api/health` healthcheck) and
nginx serving the SPA on <http://localhost:8080> and proxying `/api` (including SSE). Set
`WEB_ORIGIN` to the public URL. Terminate TLS in a reverse proxy in front of the `web`
service; session cookies are `Secure` outside development. Webhook URLs are then
`https://<host>/api/webhooks/{gitlab,github}`. `DATABASE_URL` is set by the compose file.

Load demo data into the prod stack (destructive, only for trials):
`docker compose -f docker-compose.prod.yml run --rm migrate pnpm db:seed`.

## Documentation

- [docs/SPEC.md](docs/SPEC.md): specification (source of truth)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): diagrams, layering, ER, performance results
- [docs/WEBHOOKS.md](docs/WEBHOOKS.md): webhook setup and payload handling
- [docs/DECISIONS.md](docs/DECISIONS.md): choices the spec did not cover
- [docs/BACKLOG.md](docs/BACKLOG.md): ideas beyond the MVP

## Troubleshooting

- **`Invalid environment: ...` on boot**: the message lists each bad variable. A common one is
  `SESSION_SECRET` shorter than 16 characters while `DASHBOARD_PASSWORD` is set.
- **`@prisma/client did not initialize` / no `PrismaClient` export**: run
  `pnpm --filter @mrdash/server exec prisma generate` (normally done by `pnpm install`).
- **Cannot connect to Postgres**: `docker compose ps` should show `healthy`; check the port
  5432 is free and `DATABASE_URL` matches `app:app@localhost:5432/mrdash`.
- **`mrdash_test` does not exist**: the init script only runs on a fresh volume. Run
  `docker compose exec postgres createdb -U app mrdash_test`, or `docker compose down -v`.
- **Webhook returns 401**: the secret env var for that provider is empty or does not match.
  **Returns 202 but nothing appears**: the repository is not in the dashboard yet.
- **Login blocked (429)**: login is limited to 5 attempts per minute; wait and retry.
- **Wrong times or "today" boundaries**: set `APP_TIMEZONE` to your IANA zone.
- **Prod stack: `POSTGRES_PASSWORD` error**: export it before `docker compose`. If you change it
  after the first start, the existing volume keeps the old one (`down -v` resets data).
