import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { taskCountsSchema } from '@mrdash/shared';
import { disconnectPrisma } from '../db/prisma.js';
import { truncateAll } from '../test/db.js';
import { createMr, createRepo, createUser, makeApp, prisma } from '../test/factories.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
  await disconnectPrisma();
});
beforeEach(() => truncateAll(prisma()));

const get = (url: string) => app.inject({ method: 'GET', url });
const titles = (res: { json: () => { items: { title: string }[] } }) =>
  res
    .json()
    .items.map((t) => t.title)
    .sort();

describe('"Only mine" on tasks', () => {
  it('matches assignee by username or display name, or a linked MR that is mine', async () => {
    const repo = await createRepo();
    const [me, other] = [await createUser('ann'), await createUser('bob')];
    const mr = await createMr({ repositoryId: repo.id, authorId: other.id, reviewerIds: [me.id] });
    const task = (title: string, assigneeName: string | null) =>
      prisma().task.create({ data: { title, type: 'TASK', assigneeName } });
    await task('by username', 'ANN');
    await task('by display name', 'ann'); // displayName is "ANN" in factories; compared ignoring case
    await task('not mine', 'bob');
    await task('unassigned', null);
    const linked = await task('by linked mr', 'bob');
    await prisma().taskMergeRequest.create({ data: { taskId: linked.id, mergeRequestId: mr.id } });

    const res = await get(`/api/tasks?mine=1&me=${me.id}`);
    expect(titles(res)).toEqual(['by display name', 'by linked mr', 'by username']);
    expect(titles(await get('/api/tasks?mine=1'))).toHaveLength(5);
  });
});

describe('GET /api/tasks/counts', () => {
  it('counts each status tab and applies the other filters', async () => {
    const make = (title: string, status: 'OPEN' | 'MERGED' | 'NO_MR', assigneeName?: string) =>
      prisma().task.create({
        data: {
          title,
          type: 'TASK',
          status,
          statusOverride: status,
          assigneeName: assigneeName ?? null,
        },
      });
    await make('a', 'OPEN', 'ann');
    await make('b', 'OPEN');
    await make('c', 'MERGED', 'ann');
    await make('d', 'NO_MR');
    const counts = async (qs = '') =>
      taskCountsSchema.parse((await get(`/api/tasks/counts${qs}`)).json());
    expect(await counts()).toEqual({
      all: 4,
      open: 2,
      inReview: 0,
      draft: 0,
      merged: 1,
      closed: 0,
      noMr: 1,
    });
    expect(await counts('?assignee=ann&status=OPEN')).toMatchObject({ all: 2, open: 1, merged: 1 });
  });
});

describe('task pagination cursor validation (regression)', () => {
  const enc = (v: unknown) => Buffer.from(JSON.stringify({ v, id: 'x' })).toString('base64url');

  it('rejects a numeric cursor for the default date sort', async () => {
    const res = await get(`/api/tasks?cursor=${enc(5)}`);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_CURSOR');
  });

  it('rejects an unparsable date and a string for the sortOrder sort', async () => {
    expect((await get(`/api/tasks?cursor=${enc('not-a-date')}`)).statusCode).toBe(400);
    expect((await get(`/api/tasks?sort=sortOrder&cursor=${enc('2026-01-01')}`)).statusCode).toBe(
      400,
    );
  });

  it('pages through tasks by Updated, newest first, without gaps or repeats', async () => {
    for (let i = 0; i < 5; i++) {
      await prisma().task.create({ data: { title: `t${i}`, type: 'TASK' } });
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res = await get(`/api/tasks?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      expect(res.statusCode).toBe(200);
      seen.push(...res.json().items.map((t: { title: string }) => t.title));
      cursor = res.json().nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });
});
