# Phase 7 — Design system + app shell

Read: CLAUDE.md, docs/SPEC.md sections 3 (frontend), 4 (web structure), 9 (Visual language, Layout).

Tasks:
1. `styles/tokens.css` with all color, radius, spacing tokens; map into Tailwind theme.
   Self-host Inter; tabular numbers utility.
2. UI components in `components/ui`: Button, Badge, Card, Input, Select/MultiSelect
   (Radix), Tooltip, Popover, Dialog, Drawer, Skeleton, EmptyState, Toast.
3. Data components: StatCard, StatusBadge (color + icon + label), ProviderIcon,
   Avatar/AvatarStack, FilterBar with removable chips.
4. AppShell: collapsible sidebar (Tasks, Merge Requests, Sync), top bar with search
   and sync indicator; mobile drawer below 1024px.
5. Typed API client + TanStack Query setup (staleTime 30s), login page, route guard,
   lazy-loaded routes, `useUrlFilters`, `useDebounce`, `useHotkeys`.
6. Visible focus rings, reduced-motion support.

Acceptance:
- Component tests for StatusBadge, FilterBar chips, MultiSelect keyboard use.
- A `/dev/components` route (dev only) showing every component in every state.
- Axe reports no violations on the shell. No raw hex colors outside tokens.css.

Stop after this phase and give the phase report.
