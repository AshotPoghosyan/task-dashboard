import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { resetDatabase } from '../db/seed/reset.js';

export function testDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('DATABASE_URL_TEST is not set');
  return url;
}

/** Applies all migrations to the test database (idempotent). */
export function migrateTestDb(): void {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: new URL('../../', import.meta.url),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'pipe',
  });
}

export function createTestPrisma(): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
}

/** Truncates every table; call in `beforeEach`/`beforeAll` of DB tests. */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await resetDatabase(prisma);
}
