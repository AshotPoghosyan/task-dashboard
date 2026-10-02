import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { errorResponseSchema, taskSchema } from '@mrdash/shared';
import { disconnectPrisma } from '../db/prisma.js';
import { truncateAll } from '../test/db.js';
import { baseFixtures, createMr, makeApp, prisma } from '../test/factories.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
  await disconnectPrisma();
});
beforeEach(() => truncateAll(prisma()));

const post = (url: string, payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url, payload });
const create = async (body: Record<string, unknown>) => {
  const res = await post('/api/tasks', body);
  expect(res.statusCode).toBe(201);
  return taskSchema.parse(res.json());
};

describe('POST /api/tasks', () => {
  it('creates a task with defaults and NO_MR status', async () => {
    const task = await create({ title: '  Build login ' });
    expect(task).toMatchObject({
      title: 'Build login',
      type: 'TASK',
      status: 'NO_MR',
      children: [],
    });
  });

  it('honours a status override', async () => {
    const task = await create({ title: 'x', statusOverride: 'MERGED' });
    expect(task.status).toBe('MERGED');
  });

  it('returns a validation error with the standard shape', async () => {
    const res = await post('/api/tasks', { title: '' });
    expect(res.statusCode).toBe(400);
    const body = errorResponseSchema.parse(res.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates a sub-bug under a parent', async () => {
    const parent = await create({ title: 'parent', type: 'FEATURE' });
    const child = await create({ title: 'bug', type: 'BUG', parentId: parent.id });
    expect(child.parentId).toBe(parent.id);
  });

  it('rejects an unknown parent', async () => {
    const res = await post('/api/tasks', { title: 'x', parentId: 'nope' });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('PARENT_NOT_FOUND');
  });

  it('rejects nesting deeper than one level on create', async () => {
    const parent = await create({ title: 'parent' });
    const child = await create({ title: 'child', parentId: parent.id });
    const res = await post('/api/tasks', { title: 'grandchild', parentId: child.id });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('NESTING_TOO_DEEP');
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns the task with children and linked MRs', async () => {
    const { repo, author } = await baseFixtures();
    const mr = await createMr({ repositoryId: repo.id, authorId: author.id, status: 'IN_REVIEW' });
    const parent = await create({ title: 'parent' });
    await create({ title: 'child', parentId: parent.id });
    await post(`/api/tasks/${parent.id}/merge-requests`, { mergeRequestId: mr.id });
    const res = await app.inject({ method: 'GET', url: `/api/tasks/${parent.id}` });
    expect(res.statusCode).toBe(200);
    const body = taskSchema.parse(res.json());
    expect(body.children).toHaveLength(1);
    expect(body.mergeRequests.map((m) => m.id)).toEqual([mr.id]);
  });

  it('404s for unknown ids', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks/missing' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('updates fields', async () => {
    const task = await create({ title: 'old' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      payload: { title: 'new', notes: 'hello', assigneeName: 'Ann' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ title: 'new', notes: 'hello', assigneeName: 'Ann' });
  });

  it('rejects an empty body and unknown tasks', async () => {
    const task = await create({ title: 't' });
    const empty = await app.inject({ method: 'PATCH', url: `/api/tasks/${task.id}`, payload: {} });
    expect(empty.statusCode).toBe(400);
    const missing = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/nope',
      payload: { title: 'x' },
    });
    expect(missing.statusCode).toBe(404);
  });

  it('applies and clears a status override, recomputing status', async () => {
    const { repo, author } = await baseFixtures();
    const mr = await createMr({ repositoryId: repo.id, authorId: author.id, status: 'OPEN' });
    const task = await create({ title: 't' });
    await post(`/api/tasks/${task.id}/merge-requests`, { mergeRequestId: mr.id });
    const url = `/api/tasks/${task.id}`;
    const over = await app.inject({ method: 'PATCH', url, payload: { statusOverride: 'CLOSED' } });
    expect(over.json().status).toBe('CLOSED');
    const clear = await app.inject({ method: 'PATCH', url, payload: { statusOverride: null } });
    expect(clear.json().status).toBe('OPEN');
  });

  it('never produces a two-level tree when re-parenting concurrently', async () => {
    const a = await create({ title: 'a' });
    const b = await create({ title: 'b' });
    const patch = (id: string, parentId: string) =>
      app.inject({ method: 'PATCH', url: `/api/tasks/${id}`, payload: { parentId } });
    const results = await Promise.all([patch(a.id, b.id), patch(b.id, a.id)]);
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 422)).toHaveLength(1);
  });

  it('enforces the nesting rule when re-parenting', async () => {
    const a = await create({ title: 'a' });
    const b = await create({ title: 'b' });
    const child = await create({ title: 'child', parentId: a.id });
    const patch = (id: string, parentId: string) =>
      app.inject({ method: 'PATCH', url: `/api/tasks/${id}`, payload: { parentId } });

    expect((await patch(a.id, a.id)).json().error.code).toBe('INVALID_PARENT');
    // a has children, so it cannot become a sub-bug
    expect((await patch(a.id, b.id)).json().error.code).toBe('NESTING_TOO_DEEP');
    // a sub-bug cannot be a parent
    expect((await patch(b.id, child.id)).json().error.code).toBe('NESTING_TOO_DEEP');
    // valid move
    const ok = await patch(child.id, b.id);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().parentId).toBe(b.id);
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('deletes a task and cascades to its sub-bugs', async () => {
    const parent = await create({ title: 'p' });
    const child = await create({ title: 'c', parentId: parent.id });
    const res = await app.inject({ method: 'DELETE', url: `/api/tasks/${parent.id}` });
    expect(res.statusCode).toBe(204);
    expect(await prisma().task.findUnique({ where: { id: child.id } })).toBeNull();
  });

  it('404s for unknown tasks', async () => {
    expect((await app.inject({ method: 'DELETE', url: '/api/tasks/nope' })).statusCode).toBe(404);
  });
});

describe('link / unlink merge requests', () => {
  it('recalculates status on link and unlink', async () => {
    const { repo, author } = await baseFixtures();
    const draft = await createMr({ repositoryId: repo.id, authorId: author.id, status: 'DRAFT' });
    const review = await createMr({
      repositoryId: repo.id,
      authorId: author.id,
      status: 'IN_REVIEW',
    });
    const task = await create({ title: 't' });

    const l1 = await post(`/api/tasks/${task.id}/merge-requests`, { mergeRequestId: review.id });
    expect(l1.json().status).toBe('IN_REVIEW');
    const l2 = await post(`/api/tasks/${task.id}/merge-requests`, { mergeRequestId: draft.id });
    expect(l2.json().status).toBe('DRAFT');
    // linking twice is idempotent
    const again = await post(`/api/tasks/${task.id}/merge-requests`, { mergeRequestId: draft.id });
    expect(again.json().mergeRequests).toHaveLength(2);

    const u1 = await app.inject({
      method: 'DELETE',
      url: `/api/tasks/${task.id}/merge-requests/${draft.id}`,
    });
    expect(u1.json().status).toBe('IN_REVIEW');
    const u2 = await app.inject({
      method: 'DELETE',
      url: `/api/tasks/${task.id}/merge-requests/${review.id}`,
    });
    expect(u2.json().status).toBe('NO_MR');
  });

  it('validates body and 404s on unknown task, MR or link', async () => {
    const { repo, author } = await baseFixtures();
    const mr = await createMr({ repositoryId: repo.id, authorId: author.id });
    const task = await create({ title: 't' });
    expect((await post(`/api/tasks/${task.id}/merge-requests`, {})).statusCode).toBe(400);
    expect(
      (await post('/api/tasks/nope/merge-requests', { mergeRequestId: mr.id })).statusCode,
    ).toBe(404);
    expect(
      (await post(`/api/tasks/${task.id}/merge-requests`, { mergeRequestId: 'nope' })).statusCode,
    ).toBe(404);
    const unlink = await app.inject({
      method: 'DELETE',
      url: `/api/tasks/${task.id}/merge-requests/${mr.id}`,
    });
    expect(unlink.statusCode).toBe(404);
  });
});

describe('GET /api/tasks', () => {
  const ids = (res: { json: () => { items: { id: string }[] } }) =>
    res.json().items.map((t) => t.id);
  const get = (qs = '') => app.inject({ method: 'GET', url: `/api/tasks${qs}` });

  it('returns only top-level tasks with nested sub-bugs', async () => {
    const p = await create({ title: 'parent' });
    await create({ title: 'child', parentId: p.id });
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(ids(res)).toEqual([p.id]);
    expect(res.json().items[0].children).toHaveLength(1);
    expect(res.json().nextCursor).toBeNull();
  });

  it('filters by type, assignee, targetBranch, status and q', async () => {
    const a = await create({
      title: 'Alpha login',
      type: 'BUG',
      assigneeName: 'Ann',
      targetBranch: 'main',
    });
    const b = await create({
      title: 'Beta',
      type: 'FEATURE',
      assigneeName: 'Bob',
      targetBranch: 'dev',
      statusOverride: 'MERGED',
    });
    expect(ids(await get('?type=BUG'))).toEqual([a.id]);
    expect(ids(await get('?assignee=Bob'))).toEqual([b.id]);
    expect(ids(await get('?targetBranch=main'))).toEqual([a.id]);
    expect(ids(await get('?status=MERGED'))).toEqual([b.id]);
    expect(ids(await get('?q=LOGIN'))).toEqual([a.id]);
    expect(ids(await get('?type=BUG,FEATURE')).sort()).toEqual([a.id, b.id].sort());
    expect(ids(await get('?type=BUG&assignee=Bob'))).toEqual([]);
    expect(ids(await get('?q='))).toHaveLength(2);
  });

  it('treats LIKE wildcards in the search term literally', async () => {
    const a = await create({ title: '100% done' });
    await create({ title: 'plain' });
    expect(ids(await get('?q=%25'))).toEqual([a.id]);
    expect(ids(await get('?q=_'))).toEqual([]);
  });

  it('lists a parent when only a sub-bug matches, keeping all its children', async () => {
    const p = await create({ title: 'parent' });
    await create({ title: 'quiet', parentId: p.id });
    await create({ title: 'needle bug', type: 'BUG', parentId: p.id });
    const res = await get('?q=needle');
    expect(ids(res)).toEqual([p.id]);
    expect(res.json().items[0].children).toHaveLength(2);
  });

  it('paginates with cursors', async () => {
    const created = [];
    for (let i = 0; i < 5; i++) created.push(await create({ title: `t${i}` }));
    const p1 = await get('?limit=2');
    expect(ids(p1)).toHaveLength(2);
    const p2 = await get(`?limit=2&cursor=${p1.json().nextCursor}`);
    const p3 = await get(`?limit=2&cursor=${p2.json().nextCursor}`);
    expect(ids(p3)).toHaveLength(1);
    expect(p3.json().nextCursor).toBeNull();
    expect([...ids(p1), ...ids(p2), ...ids(p3)].sort()).toEqual(created.map((t) => t.id).sort());
  });

  it('respects sortOrder ordering', async () => {
    const a = await create({ title: 'a' });
    const b = await create({ title: 'b' });
    await app.inject({ method: 'PATCH', url: `/api/tasks/${b.id}`, payload: { sortOrder: -1 } });
    expect(ids(await get())).toEqual([b.id, a.id]);
  });

  it('rejects invalid query params and cursors', async () => {
    expect((await get('?status=BOGUS')).statusCode).toBe(400);
    expect((await get('?limit=500')).statusCode).toBe(400);
    const bad = await get('?cursor=garbage');
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('INVALID_CURSOR');
  });

  it('sets an ETag and answers 304 on a matching If-None-Match', async () => {
    await create({ title: 't' });
    const first = await get();
    const etag = first.headers.etag as string;
    expect(etag).toBeTruthy();
    const second = await app.inject({
      method: 'GET',
      url: '/api/tasks',
      headers: { 'if-none-match': etag },
    });
    expect(second.statusCode).toBe(304);
  });
});
