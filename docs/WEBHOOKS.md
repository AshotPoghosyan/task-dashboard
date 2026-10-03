# Webhooks

The server accepts merge/pull request events from GitLab and GitHub. Each delivery is verified,
stored in `webhook_events` (unique per provider + delivery id), queued on pg-boss and answered
with `202` immediately. A worker then upserts the MR, recalculates linked tasks, and emits
`mr.updated` / `task.updated` on the SSE stream (`GET /api/events`). Webhooks complement the
periodic sync: they make changes appear within seconds.

| Provider | URL                                                            | Secret env var          |
| -------- | -------------------------------------------------------------- | ----------------------- |
| GitLab   | `POST /api/webhooks/gitlab` (alias `POST /api/gitlab-webhook`) | `GITLAB_WEBHOOK_SECRET` |
| GitHub   | `POST /api/webhooks/github`                                    | `GITHUB_WEBHOOK_SECRET` |

If a secret is empty, every request for that provider is rejected with `401`.
Generate secrets with `openssl rand -hex 32`. Webhook routes need no dashboard session.
The repository must already exist in the dashboard (`repositories`), otherwise events are
logged and ignored. For GitLab `repositories.externalId` is the numeric project id; for GitHub it is `owner/repo`.

## GitLab setup

1. Project → **Settings → Webhooks → Add new webhook**.
2. **URL:** `https://<your-host>/api/webhooks/gitlab`
3. **Secret token:** the value of `GITLAB_WEBHOOK_SECRET`.
4. **Trigger:** enable only **Merge request events**.
5. Enable SSL verification, then **Add webhook**. Use **Test → Merge request events** to try it.

## GitHub setup

1. Repository → **Settings → Webhooks → Add webhook**.
2. **Payload URL:** `https://<your-host>/api/webhooks/github`
3. **Content type:** `application/json` (form-encoded is not supported).
4. **Secret:** the value of `GITHUB_WEBHOOK_SECRET`.
5. **Events:** choose _Let me select individual events_ and tick only **Pull requests**.
6. Keep **Active** ticked, then **Add webhook**. The initial `ping` is answered `200` and ignored.

## Responses

| Status | Meaning                                                                           |
| ------ | --------------------------------------------------------------------------------- |
| 202    | Accepted and queued                                                               |
| 200    | Ignored event type (`{"status":"ignored"}`) or duplicate delivery (`"duplicate"`) |
| 400    | Signed body is not valid JSON                                                     |
| 401    | Missing/invalid token or signature                                                |

Processing outcomes are stored on the `webhook_events` row (`processedAt`, `error`), for example
`ignored: unknown repository`. Rows older than 30 days are deleted daily.

## Linking from the MR description

- `Task: #<taskId>` links the MR to that task.
- `Parent: !<number>` (GitLab) / `Parent: #<number>` (GitHub) creates a BUG sub-task for this MR
  under the task linked to the parent MR (once per MR).

## Local development with a tunnel

```sh
pnpm dev                                  # server on :4000
ngrok http 4000                           # or: cloudflared tunnel --url http://localhost:4000
```

Use the printed `https://…` host in the provider's webhook settings. GitLab (self-hosted) may
need _Admin → Settings → Network → Outbound requests_ to allow your tunnel host.

## Replaying the fixtures with curl

Fixtures live in `apps/server/src/providers/{gitlab,github}/__fixtures__/webhook-*.json`. Create
a matching repository first (GitLab project id `4242`, GitHub `acme/widgets`), e.g. via
`psql` or the seed data. Each delivery id must be unique, otherwise it is treated as a duplicate.

GitLab (`open`, `draft`, `reviewer-added`, `merged`, `closed`):

```sh
F=apps/server/src/providers/gitlab/__fixtures__/webhook-open.json
curl -i -X POST http://localhost:4000/api/webhooks/gitlab \
  -H 'Content-Type: application/json' \
  -H "X-Gitlab-Token: $GITLAB_WEBHOOK_SECRET" \
  -H 'X-Gitlab-Event: Merge Request Hook' \
  -H "X-Gitlab-Event-UUID: $(uuidgen)" \
  --data-binary @"$F"
```

GitHub (`opened`, `draft`, `review-requested`, `closed-merged`, `closed-not-merged`). The
signature is an HMAC-SHA256 of the exact bytes sent:

```sh
F=apps/server/src/providers/github/__fixtures__/webhook-opened.json
SIG=$(openssl dgst -sha256 -hmac "$GITHUB_WEBHOOK_SECRET" < "$F" | sed 's/^.* //')
curl -i -X POST http://localhost:4000/api/webhooks/github \
  -H 'Content-Type: application/json' \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -H 'X-GitHub-Event: pull_request' \
  -H "X-GitHub-Delivery: $(uuidgen)" \
  --data-binary @"$F"
```

Fixtures of one provider describe the same MR at increasing `updated_at`; replaying them out
of order is safe because older events than the stored state are ignored.

## Watching events

```sh
curl -N http://localhost:4000/api/events      # add -H 'Cookie: mrdash_session=…' when a password is set
```

Events: `mr.updated`, `task.updated`, `sync.finished`; a `: heartbeat` comment is sent every 25 s.

## Manual check: a webhook updates the browser live

1. `pnpm dev`, run `pnpm db:seed` and open `http://localhost:5173/merge-requests`.
2. Make sure a repository exists whose `externalId` matches the fixture's `project.id`
   (GitLab fixtures in `apps/server/src/providers/gitlab/__fixtures__/webhook-*.json`).
3. Post the fixture with the secret token:

   ```sh
   curl -i -X POST http://localhost:4000/api/webhooks/gitlab \
     -H "content-type: application/json" \
     -H "x-gitlab-token: $GITLAB_WEBHOOK_SECRET" \
     --data @apps/server/src/providers/gitlab/__fixtures__/webhook-merged.json
   ```

4. Expect `202`. Within a second the matching row flashes, its status badge changes, the
   "Merged today" card updates and a toast "!N is now Merged" appears (the stream is
   `GET /api/events`; check it in the browser's Network tab as an `EventStream`).
5. Stop the server: the browser retries with backoff (1s, 2s, 4s … 30s) and resumes on restart.
