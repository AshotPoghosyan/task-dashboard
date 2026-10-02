import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { filterOptionsSchema, repositoryListSchema, statsSchema } from '@mrdash/shared';
import { disconnectPrisma } from '../db/prisma.js';
import { getStats, invalidateStatsCache } from '../services/statsService.js';
import { truncateAll } from '../test/db.js';
import {
  baseFixtures,
  createMr,
  createRepo,
  createUser,
  makeApp,
  prisma,
} from '../test/factories.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await makeApp({ APP_TIMEZONE: 'Asia/Yerevan' });
});
afterAll(async () => {
  await app.close();
  await disconnectPrisma();
});
beforeEach(async () => {
  invalidateStatsCache();
  await truncateAll(prisma());
});

describe('GET /api/stats', () => {
  it('counts by status', async () => {
    const { repo, author } = await baseFixtures();
    const mk = (status: 'DRAFT' | 'OPEN' | 'IN_REVIEW' | 'MERGED' | 'CLOSED', n: number) =>
      Promise.all(
        Array.from({ length: n }, () =>
          createMr({ repositoryId: repo.id, authorId: author.id, status }),
        ),
      );
    await mk('DRAFT', 1);
    await mk('OPEN', 2);
    await mk('IN_REVIEW', 3);
    await mk('MERGED', 4); // merged long ago (no mergedAt) so not "today"
    const res = await app.inject({ method: 'GET', url: '/api/stats' });
    expect(res.statusCode).toBe(200);
    expect(statsSchema.parse(res.json())).toEqual({
      openMrs: 6,
      pendingReviews: 3,
      mergedToday: 0,
      draft: 1,
      closedThisWeek: 0,
    });
  });

  it('computes "merged today" at timezone edges (Asia/Yerevan, UTC+4)', async () => {
    const { repo, author } = await baseFixtures();
    // "now" is 2026-10-02 01:00 in Yerevan == 2026-10-01 21:00 UTC. Today began 2026-10-01 20:00 UTC.
    const now = new Date('2026-10-01T21:00:00Z');
    const merged = (iso: string) =>
      createMr({
        repositoryId: repo.id,
        authorId: author.id,
        status: 'MERGED',
        mergedAt: new Date(iso),
      });
    await merged('2026-10-01T19:59:59Z'); // 23:59:59 yesterday locally -> not today
    await merged('2026-10-01T20:00:00Z'); // 00:00:00 today locally -> today
    await merged('2026-10-01T20:30:00Z'); // today
    // Same instants would be "yesterday" for a UTC day: 2026-10-01 20:30Z is still Oct 1 UTC.
    expect((await getStats('Asia/Yerevan', now)).mergedToday).toBe(2);
    invalidateStatsCache();
    // In UTC the current day began at 00:00Z, so all three count.
    expect((await getStats('UTC', now)).mergedToday).toBe(3);
    invalidateStatsCache();
    // Next local day: only merges from 2026-10-02 20:00Z onward count.
    expect((await getStats('Asia/Yerevan', new Date('2026-10-02T20:00:00Z'))).mergedToday).toBe(0);
  });

  it('counts closed MRs from the start of the local week', async () => {
    const { repo, author } = await baseFixtures();
    const closed = (iso: string) =>
      createMr({
        repositoryId: repo.id,
        authorId: author.id,
        status: 'CLOSED',
        closedAt: new Date(iso),
      });
    await closed('2026-09-27T19:59:00Z'); // Sunday 23:59 local -> previous week
    await closed('2026-09-27T20:00:00Z'); // Monday 00:00 local -> this week
    const now = new Date('2026-10-01T10:00:00Z'); // Thursday
    expect((await getStats('Asia/Yerevan', now)).closedThisWeek).toBe(1);
  });

  it('caches for 10 seconds until invalidated', async () => {
    const { repo, author } = await baseFixtures();
    const now = new Date('2026-10-01T10:00:00Z');
    expect((await getStats('Asia/Yerevan', now)).openMrs).toBe(0);
    await createMr({ repositoryId: repo.id, authorId: author.id, status: 'OPEN' });
    expect((await getStats('Asia/Yerevan', new Date(now.getTime() + 9_000))).openMrs).toBe(0);
    expect((await getStats('Asia/Yerevan', new Date(now.getTime() + 10_001))).openMrs).toBe(1);
    await createMr({ repositoryId: repo.id, authorId: author.id, status: 'OPEN' });
    invalidateStatsCache();
    expect((await getStats('Asia/Yerevan', new Date(now.getTime() + 10_002))).openMrs).toBe(2);
  });
});

describe('GET /api/filters/options', () => {
  it('returns distinct assignees, branches, repositories and users', async () => {
    const repo = await createRepo('GITHUB', 'org/app');
    const user = await createUser('zed');
    await createMr({ repositoryId: repo.id, authorId: user.id, targetBranch: 'release' });
    await createMr({ repositoryId: repo.id, authorId: user.id, targetBranch: 'release' });
    await prisma().task.createMany({
      data: [
        { title: 'a', assigneeName: 'Ann', targetBranch: 'main' },
        { title: 'b', assigneeName: 'Ann' },
        { title: 'c', assigneeName: 'Bob' },
      ],
    });
    const res = await app.inject({ method: 'GET', url: '/api/filters/options' });
    expect(res.statusCode).toBe(200);
    const body = filterOptionsSchema.parse(res.json());
    expect(body.assignees).toEqual(['Ann', 'Bob']);
    expect(body.branches).toEqual(['main', 'release']);
    expect(body.repositories).toEqual([{ id: repo.id, provider: 'GITHUB', fullPath: 'org/app' }]);
    expect(body.users.map((u) => u.username)).toEqual(['zed']);
  });

  it('returns empty lists on an empty database', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/filters/options' });
    expect(filterOptionsSchema.parse(res.json())).toEqual({
      assignees: [],
      branches: [],
      repositories: [],
      users: [],
    });
  });
});

describe('GET /api/repositories', () => {
  it('lists repositories', async () => {
    await createRepo('GITLAB', 'b/b');
    await createRepo('GITHUB', 'a/a');
    const res = await app.inject({ method: 'GET', url: '/api/repositories' });
    expect(res.statusCode).toBe(200);
    expect(repositoryListSchema.parse(res.json()).items.map((r) => r.fullPath)).toEqual([
      'a/a',
      'b/b',
    ]);
  });
});
