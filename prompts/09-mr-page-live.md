# Phase 9 — Merge Requests page + live updates

Read: CLAUDE.md, docs/SPEC.md section 9 (Merge Requests page, States and polish), 10.

Tasks:

1. Stat cards per status. Filter bar: provider, repo, status, author, assignee,
   reviewer, target branch, search.
2. Virtualized MR table with all columns from spec; reviewer avatar stack with
   approval state; relative age with full date tooltip; linked task link.
3. Infinite scroll using cursor pagination; placeholder data while filtering.
4. Sync now button, last-synced time, per-repo error popover.
5. `useSSE` hook: reconnect with backoff; invalidate only affected queries;
   highlight updated rows briefly; toast on status change.

Acceptance:

- 10,000-row large seed scrolls smoothly (no dropped frames in a Performance trace; note result).
- Manual check documented: curl a webhook fixture → row updates live in the browser.
- Component tests for filters and SSE invalidation logic.

Stop after this phase and give the phase report.
