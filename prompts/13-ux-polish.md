# Phase 13 — UX polish: simpler pages, "Needs attention", light mode

Read: CLAUDE.md, docs/SPEC.md sections 8 and 9, the Phase 12 auth code, and the
current Tasks and Merge Requests pages. Goal: a first-time user understands both
pages in 10 seconds and finds what needs their action without thinking.

Guiding rules:
- Show less by default; reveal details on hover, expand, or "More filters".
- One way to do each thing. No duplicated indicators.
- Plain words a developer would say out loud.
- Update docs/SPEC.md section 9 to describe the new behavior, so the spec stays the source of truth.

## 1. Bugs to fix first
1. Avatars: shared `Avatar` component with a fallback of initials on a colored
   circle (color derived from the name, readable in both themes). Use it when
   the image URL is missing, fails to load, or is blocked. Alt text must never
   render visibly. Seed data should use no external avatar URLs.
2. No horizontal page overflow at ≥ 1280px wide. Below that, hide low-priority
   columns in a defined order and show them in the expanded row instead.
   Header labels must never overlap.
3. Sorting and dates must agree: lists sort by "Updated" (newest first) and the
   date column shows "Updated" (relative, full date on hover). Sortable column
   headers for Updated and Created.
4. Sync status appears once: in the top bar. Remove the duplicate from the page
   header. When never synced, show "Not synced yet" plus a "Sync now" button.

## 2. Merge Requests page
- Replace the 5 stat cards with status tabs that show counts:
  **Needs attention** (default) · All · Open · In review · Draft · Merged · Closed.
  Tab state lives in the URL.
- Toolbar: search, **Only mine** toggle, and a single **More filters** button
  (popover with provider, repository, author, assignee, reviewer, target branch).
  Active filters show as removable chips with "Clear all".
- Columns: 
  - **MR**: provider icon + short repo name + number in one cell (e.g. `backend !23`),
    full path in a tooltip.
  - **Title** (+ the attention reason chip in the Needs attention tab).
  - **Author**: avatar + name.
  - **Reviewers**: avatars with a clear state mark — ✓ approved, ✗ changes requested,
    ○ waiting — and a tooltip listing names and states.
  - **Status** badge, **Target branch** (source → target on hover), **Updated**, **Linked task**.
- API: `view=attention` on `GET /api/merge-requests` returning a `reasons[]`
  field per item, and `GET /api/merge-requests/counts` for tab badges (same filters applied).

## 3. "Needs attention" rules (in packages/shared, fully unit tested)
An open/draft/in-review MR needs attention when any of these is true:
- **Waiting for your review**: current user is a reviewer with state REQUESTED.
- **Changes requested**: current user is the author and any reviewer requested changes.
- **No reviewer**: non-draft, open, and has no reviewers.
- **Stale**: not updated for more than `STALE_DAYS` (env, default 7). Chip shows "Stale 9d".
If the current user is unknown, apply only "No reviewer" and "Stale".
Order: your review first, then changes requested, then no reviewer, then stale (oldest first).
Empty state: "Nothing needs attention right now" with a link to All.

## 4. "Only mine"
- Current user = logged-in user (Phase 12) matched to `git_users` by provider + username.
- In password mode (no personal login): a one-time "Who are you?" picker
  (search git users, remember the choice in localStorage, changeable in the user menu).
- MRs: mine = I am author, assignee, or reviewer. Tasks: mine = assignee matches
  my username or display name (case-insensitive), or a linked MR is mine.

## 5. Tasks page — same principles
- Status tabs with counts: All (default) · Open · In review · Draft · Merged · Closed · No MR.
- Keep only 3 cards (Open MRs, Pending reviews, Merged today); clicking applies the tab.
- Search, Only mine, More filters (assignee, branch, type) with chips.
- Use the shared Avatar. Audit columns: show ID, Title (+ sub-bug count), Type,
  Assignee, Status, Linked MRs (count with popover), Updated. Move the rest into
  the drawer. No overflow, same breakpoint rules.

## 6. Light mode
- Full light palette in tokens.css; every component uses tokens only.
- Theme setting in the user menu: **System** (default) · Light · Dark, stored
  in localStorage, applied before first paint (inline script in index.html; no flash).
- Status badge colors, focus rings, chips, and charts readable in both themes;
  WCAG AA contrast in both.

## 7. Plain language
Review every label, tooltip, empty state, and error message on both pages.
Use: Needs attention, Needs review, Waiting for review, Changes requested,
No reviewer, Merged, Closed, Draft. Add a small "?" next to the status tabs that
explains each status in one sentence.

## Tests
- Unit: attention rules (each reason, ordering, unknown user), "mine" matching,
  avatar initials/colors, theme resolution.
- API: attention view + reasons, counts endpoint respects filters.
- Components: Avatar fallback on image error, tabs ↔ URL, More filters chips, theme toggle.
- E2E (Playwright): both pages in light and dark at 1280px and 375px — no
  horizontal scroll, axe passes; Needs attention shows correct reasons for seeded data.

## Screenshots for the owner
Save Playwright screenshots of both pages in light and dark (1280px and 375px)
to `docs/screenshots/` and list them in the phase report, so the owner can
review the look without running the app.

## Acceptance
- No broken avatars, no overflow, one sync indicator, sort matches dates.
- Needs attention is the default MR view and its reasons are correct.
- Only mine works with personal login and in password mode.
- Light, dark, and system themes work without flashing.
- All tests pass.

Stop after this phase and give the phase report.
