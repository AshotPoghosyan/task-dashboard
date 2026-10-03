# Phase 12 — Team login (GitLab / GitHub sign-in)

Read: CLAUDE.md, docs/SPEC.md sections 4, 5, 8 (Access control), 9, 13, and the
current auth plugin. This phase replaces "one shared password" with personal
accounts, while keeping the password mode as a fallback.

## Goal
Each team member signs in with their own GitLab or GitHub account. Only allowed
people get in. Admins can see and remove users. Nothing breaks for an existing
password-only deployment.

## Auth modes
- `AUTH_MODE` = `password` | `oauth` | `both`.
  Default: `oauth` if at least one provider is configured, else `password`.
- Password mode keeps working exactly as today (shared `DASHBOARD_PASSWORD`).
- Webhook routes stay exempt (they use signatures).

## Providers (each enabled only if its client ID and secret are set)
- GitHub OAuth app: scopes `read:user user:email` (+ `read:org` only if an org allowlist is set).
- GitLab OAuth app (supports self-hosted via `GITLAB_BASE_URL`): scope `read_user`
  (+ `read_api` only if a group allowlist is set).
- Use the authorization code flow with `state` and PKCE.
- Never store provider access tokens after login. Use them once for identity and
  membership checks, then discard.
- Library: prefer `@fastify/oauth2` or `arctic`. Pick one, log it in DECISIONS.md.

## Who may sign in (allowlist; at least one must be set when OAuth is on)
- `AUTH_ALLOWED_USERS`: comma-separated usernames or emails (case-insensitive).
- `AUTH_ALLOWED_GITHUB_ORG`: members of this GitHub org.
- `AUTH_ALLOWED_GITLAB_GROUP`: members of this GitLab group (full path).
- `AUTH_ADMINS`: comma-separated usernames/emails who become ADMIN on first login.
- Anyone else sees a friendly "Access denied" page explaining who to ask.
- If OAuth is on and no allowlist is set, the server refuses to start with a clear error.

## Database (new migration)
- `users`: id, provider, externalId, username, email (nullable), displayName,
  avatarUrl, role (ADMIN | MEMBER), lastLoginAt, disabledAt (nullable),
  createdAt, updatedAt. UNIQUE(provider, externalId). INDEX(email).
- `sessions`: id, userId (FK, cascade), tokenHash (store only a SHA-256 hash),
  expiresAt, lastSeenAt, userAgent, ip, createdAt. INDEX(userId), INDEX(expiresAt).
- `tasks.updatedById` (nullable FK to users, SET NULL) so the UI can show
  "last edited by" on notes and task changes.
- Job: delete expired sessions daily.

## Sessions and security
- Server-side sessions; cookie holds a random token only: httpOnly, secure in
  production, `sameSite=lax` (needed for the OAuth redirect), signed.
- 14-day sliding expiry; rotate the token on login; logout deletes the session.
- Disabling a user deletes all their sessions immediately.
- CSRF: all state-changing requests must pass an Origin/Referer check against
  `WEB_ORIGIN`.
- Rate limit login and callback routes.
- Any test-only auth helper must be impossible to enable when NODE_ENV=production
  (the server fails to start if it is set).

## API
- `GET /api/auth/providers` (which login buttons to show), `GET /api/auth/login/:provider`,
  `GET /api/auth/callback/:provider`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Admin only: `GET /api/users`, `PATCH /api/users/:id` (role, disabled).
- Admins cannot disable or demote themselves if they are the last active admin.

## UI
- Login page: provider buttons (and password field when mode allows it), app name, short help text.
- Top bar: avatar + name menu with "Sign out".
- `/settings/users` (admins only): table of users with avatar, provider, role,
  last login, status; actions to change role and disable/enable, with confirmation.
- Show "Last edited by <name>, <time>" in the task drawer.
- Access denied and session-expired pages with clear next steps.
- Same design tokens, keyboard and accessibility rules as the rest of the app.

## Docs
- `docs/AUTH.md`: step-by-step creation of the GitHub and GitLab OAuth apps,
  exact callback URLs, every env var, how to add and remove team members,
  how to switch from password mode to OAuth.
- Update README and `.env.example` with all new variables.

## Tests
- OAuth flow with mocked provider endpoints (no live network): success, wrong
  `state`, provider error, user not on allowlist, org/group membership allow and deny.
- Sessions: expiry, sliding renewal, logout, disabled user loses access immediately.
- Authorization: member gets 403 on admin routes; last-admin protection.
- CSRF origin check on mutations; webhooks still work without login.
- Password mode and `both` mode still pass all existing tests.
- E2E: sign in (via the test-only helper), see own name, admin disables a user,
  that user's next request is rejected.

## Acceptance
- With only `DASHBOARD_PASSWORD` set, the app behaves exactly as before.
- With GitHub or GitLab configured plus an allowlist, allowed users can sign in
  and others cannot.
- All tests pass; docs let me set up both providers without help.

Stop after this phase and give the phase report.
