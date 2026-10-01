# Phase 6 — Webhooks + real-time events

Read: CLAUDE.md, docs/SPEC.md sections 7 (Webhooks), 8 (events).

Tasks:

1. `POST /api/webhooks/gitlab` (+ alias `/api/gitlab-webhook`) and
   `POST /api/webhooks/github`. Raw body access for signature checks.
2. Verification: GitLab token (constant-time), GitHub `X-Hub-Signature-256` HMAC.
3. Idempotency via webhook_events unique(provider, deliveryId).
4. Store event → enqueue pg-boss job → return 202 within 1s. Worker upserts MR,
   recalculates linked task status, handles parent linking rules from the spec.
5. In-process event bus + `GET /api/events` SSE with 25s heartbeat, emitting
   mr.updated, task.updated, sync.finished. Stats cache invalidated on events.
6. Retention job deleting webhook_events older than 30 days.
7. docs/WEBHOOKS.md: exact GitLab and GitHub setup steps, events to enable,
   secrets, local tunneling with ngrok or cloudflared, curl examples per fixture.

Acceptance:

- Fixtures for GitLab (open, draft, reviewer added, merged, closed) and GitHub
  (opened, draft, review_requested, closed+merged, closed-not-merged).
- Tests: valid/invalid signature, duplicate delivery, irrelevant event type,
  unknown repo, unknown MR creation, parent linking, task status recalculation,
  SSE client receives the event.

Stop after this phase and give the phase report.
