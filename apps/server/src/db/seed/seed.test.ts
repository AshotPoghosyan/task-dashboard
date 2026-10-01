import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { disconnectPrisma, getPrisma } from '../prisma.js';
import { startOfTodayInZone } from './common.js';
import { seed } from './seed.js';

describe('seed', () => {
  const original = process.env.DATABASE_URL;

  beforeAll(() => {
    // Seeds run against the test database, never the dev one.
    process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  });

  afterAll(async () => {
    await disconnectPrisma();
    process.env.DATABASE_URL = original;
  });

  it('creates the documented dataset with MRs merged today in Asia/Yerevan', async () => {
    const now = new Date();
    await seed(now);
    const prisma = getPrisma();
    expect(await prisma.repository.count()).toBe(2);
    expect(await prisma.gitUser.count()).toBe(8);
    expect(await prisma.mergeRequest.count()).toBe(40);
    expect(await prisma.task.count()).toBe(12);
    expect(await prisma.task.count({ where: { parentId: { not: null } } })).toBe(4);
    const statuses = await prisma.mergeRequest.groupBy({ by: ['status'] });
    expect(statuses).toHaveLength(5);
    const mergedToday = await prisma.mergeRequest.count({
      where: { mergedAt: { gte: startOfTodayInZone('Asia/Yerevan', now) } },
    });
    expect(mergedToday).toBeGreaterThan(0);
  });

  it('computes start of day in a fixed-offset zone', () => {
    const start = startOfTodayInZone('Asia/Yerevan', new Date('2026-10-01T22:00:00Z'));
    expect(start.toISOString()).toBe('2026-10-01T20:00:00.000Z');
  });
});
