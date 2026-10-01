# Phase 4 — Core REST API

Read: CLAUDE.md, docs/SPEC.md sections 4, 8, 10 (backend part).

Tasks:

1. Repositories and services for tasks, merge requests, stats, filter options,
   repositories. Keep the routes → services → repositories layering.
2. All endpoints in section 8 except sync, webhooks, and events.
3. Validation with shared Zod schemas for params, query, body, and responses.
   Consistent error shape. Cursor pagination.
4. Task rules: max one nesting level, status recalculated on MR link/unlink.
5. Stats: timezone-correct "merged today", 10s in-memory cache with invalidation hook.
6. Auth plugin: password login + signed httpOnly session cookie when
   DASHBOARD_PASSWORD is set; rate limiting; helmet; CORS for WEB_ORIGIN.
7. Compression and ETag on list endpoints.
8. Check list/search queries with EXPLAIN ANALYZE on the large seed; add indexes
   if needed; record results in docs/ARCHITECTURE.md.

Acceptance:

- Integration tests for every endpoint: happy path, validation error, each filter,
  search, pagination, auth on/off, nesting rule, "merged today" at timezone edges.
- List endpoints p95 < 100ms on the large seed (write a small benchmark script).

Stop after this phase and give the phase report. I will review the API and DB
before any UI is built.
