# Phase 8 — Tasks page

Read: CLAUDE.md, docs/SPEC.md section 9 (Tasks page, States and polish), 10 (frontend).

Tasks:

1. Stat cards (Total Open MRs, Pending Reviews, Merged Today); clicking applies a filter.
2. Filter bar: debounced search with `/` shortcut; multi-select status, assignee,
   target branch, type; chips; clear all; state in URL.
3. Tasks table (TanStack Table + Virtual): expand/collapse sub-bugs with animation,
   sub-bug count pill, expand-all/collapse-all, indented sub-rows with guide line,
   all columns from spec, memoized rows.
4. Task drawer: details, linked MRs, autosaving notes, status override,
   link/unlink MR (searchable picker).
5. New task / edit task dialogs with Zod validation. Optimistic updates with rollback.
6. Skeletons, empty state, error state with retry, toasts.
7. Keyboard: j/k, Enter, Esc, e.

Acceptance:

- Component tests: expand/collapse, filter → URL sync, drawer notes autosave,
  form validation.
- Expanding a row re-renders only that row (verify with React Profiler, note result).

Stop after this phase and give the phase report.
