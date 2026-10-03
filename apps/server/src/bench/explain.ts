/* Prints EXPLAIN (ANALYZE) plans for the main list/filter/search queries: `pnpm explain`. */
import { disconnectPrisma, getPrisma } from '../db/prisma.js';

const QUERIES: Record<string, string> = {
  'MR list (default order, keyset page 2)': `SELECT * FROM merge_requests
    WHERE ("updatedAtRemote" < now() - interval '30 days' OR ("updatedAtRemote" = now() - interval '30 days' AND id < 'x'))
    ORDER BY "updatedAtRemote" DESC, id DESC LIMIT 51`,
  'MR first page': `SELECT * FROM merge_requests ORDER BY "updatedAtRemote" DESC, id DESC LIMIT 51`,
  'MR filter by status': `SELECT * FROM merge_requests WHERE status IN ('OPEN','IN_REVIEW')
    ORDER BY "updatedAtRemote" DESC, id DESC LIMIT 51`,
  'MR filter by repository': `SELECT * FROM merge_requests WHERE "repositoryId" = (SELECT id FROM repositories LIMIT 1)
    ORDER BY "updatedAtRemote" DESC, id DESC LIMIT 51`,
  'MR filter by author': `SELECT * FROM merge_requests WHERE "authorId" = (SELECT id FROM git_users LIMIT 1)
    ORDER BY "updatedAtRemote" DESC, id DESC LIMIT 51`,
  'MR filter by assignee': `SELECT * FROM merge_requests WHERE "assigneeId" = (SELECT id FROM git_users LIMIT 1)
    ORDER BY "updatedAtRemote" DESC, id DESC LIMIT 51`,
  'MR search (trigram)': `SELECT * FROM merge_requests WHERE title ILIKE '%fix%'
    ORDER BY "updatedAtRemote" DESC, id DESC LIMIT 51`,
  'MR rare search (trigram)': `SELECT * FROM merge_requests WHERE title ILIKE '%authentication%'
    ORDER BY "updatedAtRemote" DESC, id DESC LIMIT 51`,
  'MR merged today (stats)': `SELECT count(*) FROM merge_requests WHERE status = 'MERGED' AND "mergedAt" >= now() - interval '1 day'`,
  'Task top-level page': `SELECT * FROM tasks WHERE "parentId" IS NULL ORDER BY "sortOrder", id LIMIT 51`,
  'Task children of a parent': `SELECT * FROM tasks WHERE "parentId" = (SELECT "parentId" FROM tasks WHERE "parentId" IS NOT NULL LIMIT 1)
    ORDER BY "sortOrder", id`,
  'Task filter by status': `SELECT * FROM tasks WHERE "parentId" IS NULL AND status = 'OPEN' ORDER BY "sortOrder", id LIMIT 51`,
  'Task filter by assignee': `SELECT * FROM tasks WHERE "assigneeName" = (SELECT "assigneeName" FROM tasks WHERE "assigneeName" IS NOT NULL LIMIT 1)`,
  'Task filter by type': `SELECT * FROM tasks WHERE type = 'BUG' LIMIT 51`,
  'Task search (trigram)': `SELECT * FROM tasks WHERE title ILIKE '%fix%' LIMIT 51`,
};

const prisma = getPrisma();
for (const [name, sql] of Object.entries(QUERIES)) {
  const rows = await prisma.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
    `EXPLAIN (ANALYZE, BUFFERS OFF) ${sql}`,
  );
  process.stdout.write(`\n## ${name}\n${rows.map((r) => r['QUERY PLAN']).join('\n')}\n`);
}
await disconnectPrisma();
