# Backlog

Ideas outside the current spec. Format: idea, user value, rough effort (S/M/L).

- Include `lastSyncedAt` in `GET /api/stats` — UI can show data freshness without a second call — S
- Return total counts alongside paginated lists — "N tasks match" header and filter feedback — M
- Remember the page a user was on when the session expires, return there after login — avoids losing deep links — S
- Per-repo sync error popover on the sync indicator — see failures without leaving the page — S
- Merge date on tasks (API field and date filter) — "Merged Today" card and Merged column become accurate instead of using all merged tasks / last update — M
- Secondary stat lines ("3 more than yesterday") on stat cards — shows trend at a glance — S
- Show dropped columns (branch, dates) in an expanded row on small screens — tablet users see branch and dates without opening the drawer — M
- "N tasks match" count next to the filter bar — feedback that filters worked — S
- "Snooze" a Needs attention item for a few days — keeps the list actionable when a stale MR is known and waiting — M
- Per-user stale threshold — teams with slower review cycles see fewer false "Stale" chips — S
- Run the e2e job (Playwright + axe) in CI — catches overflow and contrast regressions before merge — M
