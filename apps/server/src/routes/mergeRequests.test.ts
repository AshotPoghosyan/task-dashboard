import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mergeRequestSchema } from '@mrdash/shared';
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

const get = (qs = '') => app.inject({ method: 'GET', url: `/api/merge-requests${qs}` });
const titles = (res: { json: () => { items: { title: string }[] } }) =>
  res.json().items.map((m) => m.title);

describe('GET /api/merge-requests', () => {
  it('returns MRs with author, assignee and reviewers', async () => {
    const repo = await createRepo();
    const [author, assignee, reviewer] = [
      await createUser('a'),
      await createUser('b'),
      await createUser('c'),
    ];
    await createMr({
      repositoryId: repo.id,
      authorId: author.id,
      assigneeId: assignee.id,
      reviewerIds: [reviewer.id],
      title: 'one',
    });
    const res = await get();
    expect(res.statusCode).toBe(200);
    const mr = mergeRequestSchema.parse(res.json().items[0]);
    expect(mr.author.username).toBe('a');
    expect(mr.assignee?.username).toBe('b');
    expect(mr.reviewers).toEqual([expect.objectContaining({ state: 'REQUESTED' })]);
  });

  it('includes the linked tasks of each MR', async () => {
    const repo = await createRepo();
    const author = await createUser('a');
    const mr = await createMr({ repositoryId: repo.id, authorId: author.id, title: 'linked' });
    const task = await prisma().task.create({ data: { title: 'Ship it', type: 'TASK' } });
    await prisma().taskMergeRequest.create({ data: { taskId: task.id, mergeRequestId: mr.id } });
    const [item] = (await get()).json().items;
    expect(item.tasks).toEqual([{ id: task.id, title: 'Ship it' }]);
  });

  it('filters by every supported field', async () => {
    const [r1, r2] = [await createRepo('GITLAB'), await createRepo('GITHUB')];
    const [u1, u2, rev] = [await createUser('u1'), await createUser('u2'), await createUser('rev')];
    await createMr({
      repositoryId: r1.id,
      authorId: u1.id,
      provider: 'GITLAB',
      status: 'OPEN',
      title: 'alpha',
      targetBranch: 'main',
    });
    await createMr({
      repositoryId: r2.id,
      authorId: u2.id,
      provider: 'GITHUB',
      status: 'MERGED',
      title: 'beta',
      targetBranch: 'dev',
      assigneeId: u1.id,
      reviewerIds: [rev.id],
    });

    expect(titles(await get('?provider=GITHUB'))).toEqual(['beta']);
    expect(titles(await get(`?repositoryId=${r1.id}`))).toEqual(['alpha']);
    expect(titles(await get('?status=MERGED'))).toEqual(['beta']);
    expect(titles(await get(`?authorId=${u2.id}`))).toEqual(['beta']);
    expect(titles(await get(`?assigneeId=${u1.id}`))).toEqual(['beta']);
    expect(titles(await get(`?reviewerId=${rev.id}`))).toEqual(['beta']);
    expect(titles(await get('?targetBranch=main'))).toEqual(['alpha']);
    expect(titles(await get('?q=ALP'))).toEqual(['alpha']);
    expect(titles(await get('?status=OPEN,MERGED'))).toHaveLength(2);
    expect(titles(await get('?status=OPEN&provider=GITHUB'))).toEqual([]);
  });

  it('sorts by updatedAt desc by default and supports createdAt / title / order', async () => {
    const repo = await createRepo();
    const u = await createUser();
    const mk = (title: string, day: number, created: number) =>
      createMr({
        repositoryId: repo.id,
        authorId: u.id,
        title,
        updatedAtRemote: new Date(`2026-02-0${day}T00:00:00Z`),
        createdAtRemote: new Date(`2026-01-0${created}T00:00:00Z`),
      });
    await mk('b', 1, 3);
    await mk('c', 3, 1);
    await mk('a', 2, 2);
    expect(titles(await get())).toEqual(['c', 'a', 'b']);
    expect(titles(await get('?sort=updatedAt&order=asc'))).toEqual(['b', 'a', 'c']);
    expect(titles(await get('?sort=createdAt'))).toEqual(['b', 'a', 'c']);
    expect(titles(await get('?sort=title&order=asc'))).toEqual(['a', 'b', 'c']);
  });

  it.each([
    ['updatedAt', 'desc'],
    ['updatedAt', 'asc'],
    ['createdAt', 'desc'],
    ['title', 'asc'],
    ['title', 'desc'],
  ])('paginates through ties without gaps or duplicates (%s %s)', async (sort, order) => {
    const repo = await createRepo();
    const u = await createUser();
    const sameTime = new Date('2026-03-01T00:00:00Z');
    for (let i = 0; i < 7; i++) {
      await createMr({
        repositoryId: repo.id,
        authorId: u.id,
        title: `t${i % 3}`,
        updatedAtRemote: sameTime,
        createdAtRemote: sameTime,
      });
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 10; page++) {
      const qs: string = `?limit=3&sort=${sort}&order=${order}${cursor ? `&cursor=${cursor}` : ''}`;
      const res = await get(qs);
      expect(res.statusCode).toBe(200);
      const body = res.json() as { items: { id: string }[]; nextCursor: string | null };
      seen.push(...body.items.map((m) => m.id));
      cursor = body.nextCursor;
      if (!cursor) break;
    }
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
  });

  it('validates query params and cursors', async () => {
    expect((await get('?provider=BITBUCKET')).statusCode).toBe(400);
    expect((await get('?sort=bogus')).statusCode).toBe(400);
    expect((await get('?limit=0')).statusCode).toBe(400);
    expect((await get('?cursor=garbage')).json().error.code).toBe('INVALID_CURSOR');
    const badDate = Buffer.from(JSON.stringify({ v: 'not-a-date', id: 'x' })).toString('base64url');
    expect((await get(`?cursor=${badDate}`)).json().error.code).toBe('INVALID_CURSOR');
  });

  it('compresses large responses and supports ETag revalidation', async () => {
    const repo = await createRepo();
    const u = await createUser();
    for (let i = 0; i < 20; i++) {
      await createMr({
        repositoryId: repo.id,
        authorId: u.id,
        title: `A reasonably long merge request title ${i}`,
      });
    }
    const res = await app.inject({
      method: 'GET',
      url: '/api/merge-requests',
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(res.headers['content-encoding']).toBe('gzip');
    const etag = res.headers.etag as string;
    expect(etag).toBeTruthy();
    const cached = await app.inject({
      method: 'GET',
      url: '/api/merge-requests',
      headers: { 'if-none-match': etag },
    });
    expect(cached.statusCode).toBe(304);
  });
});
