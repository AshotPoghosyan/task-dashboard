# Review prompt (run in a fresh session after each phase)

You are reviewing the most recent phase, not writing new features.
Read CLAUDE.md, the relevant docs/SPEC.md sections, and the diff of the last phase
(`git log` / `git diff` since the previous phase commit).

Check and report:

1. Spec compliance: anything missing or different from the spec.
2. Architecture rule violations (layering, duplicated shared logic, hardcoded config).
3. Bugs and edge cases: timezones, null handling, race conditions, transactions.
4. Security: validation gaps, secret handling, signature checks, injection, auth bypass.
5. Performance: N+1 queries, missing indexes, unnecessary re-renders.
6. Test quality: weak assertions, missing cases, mocks that hide real behavior.

Output a prioritized list: 🔴 must fix · 🟡 should fix · 🟢 nice to have,
each with file:line and a concrete fix. Then fix all 🔴 and 🟡 items, re-run
all checks, commit as `fix: review phase N`, and summarize.
