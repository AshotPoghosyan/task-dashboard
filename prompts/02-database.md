# Phase 2 — Database schema, migrations, seeds

Read: CLAUDE.md, docs/SPEC.md sections 5 and 6.

Tasks:

1. Prisma schema for every table in section 5: enums, relations, unique constraints,
   indexes, cascade rules, createdAt/updatedAt everywhere, timestamptz.
2. Migration enabling `pg_trgm` and adding GIN trigram indexes on
   merge_requests.title and tasks.title.
3. Prisma client singleton in `apps/server/src/db/prisma.ts`.
4. `pnpm db:seed`: realistic data as described in section 5 (varied statuses,
   sub-bugs, reviewers, linked MRs, some merged today in Asia/Yerevan time).
5. `pnpm db:seed:large`: 10,000 MRs and 2,000 tasks using batched inserts
   (must finish in under 60s).
6. Test DB helper: migrate + truncate between test files.
7. Add an ER diagram (Mermaid) to docs/ARCHITECTURE.md.

Acceptance:

- Migrations apply cleanly on an empty database and are reversible by reset.
- Both seeds run. A test verifies unique constraints and the parent cascade delete.

Stop after this phase and give the phase report.
