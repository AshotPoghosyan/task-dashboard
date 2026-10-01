# Phase 10 — E2E, performance, hardening

Read: CLAUDE.md, docs/SPEC.md sections 10, 12.

Tasks:

1. Playwright E2E: login, filter + search tasks, expand sub-bugs, edit notes,
   create task, webhook fixture updates UI live, MR page filters + infinite scroll.
2. Axe checks inside E2E for both pages.
3. Bundle analysis (rollup-plugin-visualizer); keep initial JS < 200KB gzip.
4. Lighthouse desktop: Performance and Accessibility ≥ 90.
5. Backend benchmark re-run on the large seed.
6. Coverage ≥ 80% on services and shared. Add E2E to CI.
7. Record all numbers in docs/ARCHITECTURE.md (Performance section).

Acceptance: all targets met or each miss explained with a fix plan. CI green.

Stop after this phase and give the phase report.
