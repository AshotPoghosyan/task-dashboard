import type { PrismaClient } from '@prisma/client';

const TABLES = [
  'task_merge_requests',
  'tasks',
  'merge_request_reviewers',
  'merge_requests',
  'git_users',
  'sync_runs',
  'webhook_events',
  'repositories',
];

/** Empties every application table (keeps the schema and `_prisma_migrations`). */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const list = TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
