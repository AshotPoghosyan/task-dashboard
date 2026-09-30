# Phase 3 — Shared domain logic

Read: CLAUDE.md, docs/SPEC.md sections 5, 6, 8.

Tasks (all in packages/shared):
1. Enums matching the Prisma enums (single source for the frontend).
2. Zod schemas + inferred types for: Task, SubTask, MergeRequest, GitUser,
   Repository, Stats, filter query params, pagination, error response,
   create/update task payloads.
3. `mapGitLabStatus()` and `mapGitHubStatus()` per section 6.
4. `aggregateTaskStatus(override, linkedMrStatuses)` per section 6.
5. Status display metadata (label, icon name, color token) for the UI.

Acceptance:
- 100% line and branch coverage on status functions, including: empty lists,
  mixed merged/closed, override precedence, draft + reviewers, GitHub merged vs closed.
- Both apps import from `@app/shared` successfully (build passes).

Stop after this phase and give the phase report.
