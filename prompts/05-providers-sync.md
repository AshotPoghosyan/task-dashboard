# Phase 5 — GitLab & GitHub providers + sync jobs

Read: CLAUDE.md, docs/SPEC.md sections 7 (Provider interface, Sync), 13.

Tasks:

1. `providers/types.ts`: GitProvider interface and NormalizedMR.
2. GitLab provider: REST v4 client (base URL from env), pagination,
   `updated_after` incremental fetch, mapper to NormalizedMR incl. reviewers.
3. GitHub provider: REST client, pagination, incremental strategy from spec,
   mapper incl. requested reviewers and review states.
4. Shared HTTP helper: timeouts, rate-limit header handling, exponential backoff
   on 429/403/5xx, max 3 retries.
5. pg-boss setup; per-repository sync job on SYNC_INTERVAL_MINUTES; batched upserts
   of users, MRs, reviewers in transactions; task status recalculation; sync_runs records.
6. `POST /api/sync` and `GET /api/sync/status`.
7. Missing token → provider skipped with a warning. One repo failing never blocks others.

Acceptance:

- Adapter tests use recorded JSON fixtures in `__fixtures__/` (no live network calls).
- Tests: multi-page pagination, incremental sync, 429 backoff, missing token,
  failed repo isolation, idempotent re-sync (no duplicates).

Stop after this phase and give the phase report.
