# Team sign-in (GitHub / GitLab)

Each team member signs in with their own GitHub or GitLab account. Only people on the allowlist
get in. Admins see and manage users at **Settings → Users** (`/settings/users`). The shared
password from earlier phases still works.

## Modes

`AUTH_MODE` is `password`, `oauth` or `both`. When unset it is `oauth` if at least one provider is
configured, otherwise `password`.

| Mode       | Who can sign in                                | Notes                                               |
| ---------- | ---------------------------------------------- | --------------------------------------------------- |
| `password` | Anyone with `DASHBOARD_PASSWORD`               | Unchanged. Empty password = no login at all.        |
| `oauth`    | GitHub/GitLab accounts that pass the allowlist | The password form is off.                           |
| `both`     | Either of the above                            | Needs `DASHBOARD_PASSWORD` too. Good for migrating. |

Password sessions have no personal identity: they are never admins and do not show up in
"Last edited by".

Webhooks (`/api/webhooks/*`, `/api/gitlab-webhook`) and `/api/health` never need a login.

## 1. Create the OAuth apps

Set `WEB_ORIGIN` first. It must be the URL people open in the browser (for example
`https://dash.example.com`, or `http://localhost:5173` in development). The callback URLs are
`${WEB_ORIGIN}/api/auth/callback/<provider>`, and the browser reaches the API through the same
origin (Vite proxy in development, nginx in Docker), so cookies work without CORS tricks.

### GitHub

1. GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App** (for an organisation:
   the organisation's Settings → Developer settings).
2. Application name: anything. Homepage URL: your `WEB_ORIGIN`.
3. **Authorization callback URL:** `https://dash.example.com/api/auth/callback/github`
4. Register, then **Generate a new client secret**.
5. Put the values in `.env`:
   ```
   GITHUB_OAUTH_CLIENT_ID=...
   GITHUB_OAUTH_CLIENT_SECRET=...
   ```
6. If you use `AUTH_ALLOWED_GITHUB_ORG` and the organisation restricts third-party apps, an
   organisation owner must **approve** the app (Organization → Settings → Third-party access),
   otherwise members are reported as non-members.

Scopes requested: `read:user user:email`, plus `read:org` only when `AUTH_ALLOWED_GITHUB_ORG` is set.

### GitLab (gitlab.com or self-hosted)

1. GitLab → User Settings → Applications (or Group → Settings → Applications, or Admin Area →
   Applications for an instance-wide app) → **Add new application**.
2. Name: anything. **Redirect URI:** `https://dash.example.com/api/auth/callback/gitlab`
3. Leave **Confidential** ticked (the server keeps the secret). Scopes: tick `read_user`, and also
   `read_api` only when you use `AUTH_ALLOWED_GITLAB_GROUP`.
4. Save, then copy the Application ID and Secret:
   ```
   GITLAB_BASE_URL=https://gitlab.example.com   # omit for gitlab.com
   GITLAB_OAUTH_CLIENT_ID=...
   GITLAB_OAUTH_CLIENT_SECRET=...
   ```

A provider is enabled only when both its client ID and secret are set. Both flows use the
authorization-code grant with `state` and PKCE. Provider access tokens are used once during the
callback (identity and membership) and then discarded; they are never stored.

## 2. Decide who may sign in

At least one of these must be set when OAuth is on. Otherwise the server refuses to start.

| Variable                    | Meaning                                                                   |
| --------------------------- | ------------------------------------------------------------------------- |
| `AUTH_ALLOWED_USERS`        | Comma-separated usernames or emails, case-insensitive                     |
| `AUTH_ALLOWED_GITHUB_ORG`   | Active members of this GitHub organisation                                |
| `AUTH_ALLOWED_GITLAB_GROUP` | Members (including inherited) of this GitLab group, full path `acme/team` |
| `AUTH_ADMINS`               | Become **ADMIN** on first login; they are also allowed in                 |

A person is allowed if **any** rule matches. Anyone else sees an "Access denied" page that tells
them to ask an admin.

- A username on GitHub and the same string on GitLab are different people. Prefix an entry with
  `github:` or `gitlab:` to limit it to one provider (`github:octocat,gitlab:tanuki`).
- Emails only match verified addresses (GitHub primary verified email, GitLab account email).
- `AUTH_ADMINS` only decides the role **on first login**. Later, change roles in the Users screen.

Other required settings: `SESSION_SECRET` (16+ random characters, for example
`openssl rand -hex 32`) and a `WEB_ORIGIN` that matches the public URL.

## Adding and removing team members

- **Add:** add them to `AUTH_ALLOWED_USERS` (or to the GitHub org / GitLab group) and restart the
  server for env changes. Org/group membership changes need no restart. They sign in and appear in
  the Users list.
- **Remove (immediately):** Users → **Disable**. All their sessions are deleted at once, and they
  cannot sign in again. Remove them from the allowlist too, or they are only blocked while
  disabled.
- **Re-enable:** Users → **Enable**.
- **Change role:** Users → role dropdown → confirm. The last active admin cannot be demoted or
  disabled.

## Switching from password mode to OAuth

1. Create the OAuth app(s) and set the allowlist and `SESSION_SECRET` (see above). Set
   `AUTH_ADMINS` to yourself.
2. Set `AUTH_MODE=both` and keep `DASHBOARD_PASSWORD`. Restart. Everyone keeps working with the
   password; you now also see the sign-in buttons.
3. Sign in with your account; check Settings → Users shows you as Admin.
4. Ask the team to sign in with their own accounts.
5. Set `AUTH_MODE=oauth` (or remove `DASHBOARD_PASSWORD`) and restart. Old password cookies stop
   working.

To go back, set `AUTH_MODE=password`. Nothing is lost: users and sessions stay in the database.

## Sessions and security

- Server-side sessions: the cookie holds a random token (signed, `httpOnly`, `SameSite=Lax`,
  `Secure` in production). Only a SHA-256 hash of the token is stored.
- 14-day sliding expiry, new token on every login, logout deletes the session, and a daily job
  deletes expired sessions.
- Disabling a user deletes their sessions immediately.
- CSRF: every `POST`/`PATCH`/`PUT`/`DELETE` to `/api` must carry an `Origin` (or `Referer`) equal to
  `WEB_ORIGIN`. Requests that carry cookies but no origin are rejected. Webhooks are exempt
  because they are signature-verified.
- Login and callback routes are rate limited (10 per minute per client).
- `AUTH_TEST_HELPER` enables `POST /api/auth/test-login` for the E2E suite. The server **refuses to
  start** if it is set while `NODE_ENV=production`. Never set it anywhere real.

## API

| Route                                    | Access | Purpose                                        |
| ---------------------------------------- | ------ | ---------------------------------------------- |
| `GET /api/auth/providers`                | public | Which buttons / password form to show          |
| `GET /api/auth/login/:provider`          | public | Redirects to GitHub/GitLab (`github`/`gitlab`) |
| `GET /api/auth/callback/:provider`       | public | Finishes sign-in, sets the cookie, redirects   |
| `POST /api/auth/logout`                  | any    | Ends the session                               |
| `GET /api/auth/me`                       | user   | The signed-in user                             |
| `GET /api/users`, `PATCH /api/users/:id` | admin  | List users; change `role` / `disabled`         |

## Troubleshooting

- **"expired or was not started here" after the provider redirect:** the state cookie was lost.
  Check `WEB_ORIGIN` equals the URL in the address bar and that the callback URL in the OAuth app
  matches exactly.
- **Everyone gets "Access denied":** check the allowlist spelling, and for orgs/groups the app
  approval and scopes above. The server logs the reason at `info` level (`sign-in refused`).
- **Server will not start:** the error lists the missing item (provider, allowlist, or
  `SESSION_SECRET`).
