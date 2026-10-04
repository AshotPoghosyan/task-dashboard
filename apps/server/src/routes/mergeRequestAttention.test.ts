import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mergeRequestCountsSchema, mergeRequestSchema } from '@mrdash/shared';
import { disconnectPrisma } from '../db/prisma.js';
import { truncateAll } from '../test/db.js';
import { createMr, createRepo, createUser, makeApp, prisma } from '../test/factories.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await makeApp({ STALE_DAYS: '7' });
});
afterAll(async () => {
  await app.close();
  await disconnectPrisma();
});
beforeEach(() => truncateAll(prisma()));

const get = (url: string) => app.inject({ method: 'GET', url });
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

/** One MR for each rule, plus a fresh, reviewed MR that needs nothing. */
async function scenario() {
  const repo = await createRepo();
  const [me, other, rev] = [
    await createUser('me'),
    await createUser('other'),
    await createUser('rev'),
  ];
  const base = { repositoryId: repo.id, updatedAtRemote: daysAgo(1) };
  const review = await createMr({
    ...base,
    authorId: other.id,
    reviewerIds: [me.id],
    title: 'review',
  });
  const changes = await createMr({
    ...base,
    authorId: me.id,
    reviewerIds: [rev.id],
    title: 'changes',
  });
  await prisma().mergeRequestReviewer.updateMany({
    where: { mergeRequestId: changes.id },
    data: { state: 'CHANGES_REQUESTED' },
  });
  const noReviewer = await createMr({ ...base, authorId: other.id, title: 'no reviewer' });
  const stale = await createMr({
    ...base,
    updatedAtRemote: daysAgo(9),
    authorId: other.id,
    reviewerIds: [rev.id],
    title: 'stale',
  });
  const fine = await createMr({
    ...base,
    authorId: other.id,
    reviewerIds: [rev.id],
    title: 'fine',
  });
  await createMr({
    ...base,
    authorId: other.id,
    status: 'MERGED',
    title: 'merged',
    updatedAtRemote: daysAgo(30),
  });
  return { me, other, rev, review, changes, noReviewer, stale, fine };
}

const list = async (qs: string) => {
  const res = await get(`/api/merge-requests?${qs}`);
  expect(res.statusCode).toBe(200);
  return res.json().items.map((i: unknown) => mergeRequestSchema.parse(i));
};
const summary = (items: { title: string; reasons?: { kind: string; days?: number }[] }[]) =>
  items.map((i) => [i.title, i.reasons?.map((r) => r.kind)]);

describe('GET /api/merge-requests?view=attention', () => {
  it('lists reasons for the current user, most urgent first', async () => {
    const { me } = await scenario();
    const items = await list(`view=attention&me=${me.id}`);
    expect(summary(items)).toEqual([
      ['review', ['REVIEW_REQUESTED']],
      ['changes', ['CHANGES_REQUESTED']],
      ['no reviewer', ['NO_REVIEWER']],
      ['stale', ['STALE']],
    ]);
    expect(items.at(-1)?.reasons).toEqual([{ kind: 'STALE', days: 9 }]);
  });

  it('applies only "No reviewer" and "Stale" when the user is unknown', async () => {
    await scenario();
    expect(summary(await list('view=attention'))).toEqual([
      ['no reviewer', ['NO_REVIEWER']],
      ['stale', ['STALE']],
    ]);
  });

  it('shows what is waiting on whoever the current user is', async () => {
    const { rev } = await scenario();
    // `rev` has been asked to review "fine" and "stale"; changes were requested by them, not from them.
    expect(summary(await list(`view=attention&me=${rev.id}`))).toEqual([
      ['fine', ['REVIEW_REQUESTED']],
      ['stale', ['REVIEW_REQUESTED', 'STALE']],
      ['no reviewer', ['NO_REVIEWER']],
    ]);
  });

  it('respects the other filters and "only mine"', async () => {
    const { me } = await scenario();
    expect(
      (await list(`view=attention&me=${me.id}&q=stale`)).map((m: { title: string }) => m.title),
    ).toEqual(['stale']);
    const mine = await list(`view=attention&me=${me.id}&mine=1`);
    expect(mine.map((m: { title: string }) => m.title)).toEqual(['review', 'changes']);
  });

  it('pages through the list with a cursor', async () => {
    const { me } = await scenario();
    const first = await get(`/api/merge-requests?view=attention&me=${me.id}&limit=3`);
    expect(first.json().items).toHaveLength(3);
    const second = await get(
      `/api/merge-requests?view=attention&me=${me.id}&limit=3&cursor=${first.json().nextCursor}`,
    );
    expect(second.json().items.map((m: { title: string }) => m.title)).toEqual(['stale']);
    expect(second.json().nextCursor).toBeNull();
  });

  it('rejects a bad cursor', async () => {
    expect((await get('/api/merge-requests?view=attention&cursor=garbage')).statusCode).toBe(400);
  });

  it('rejects negative, fractional and non-numeric offset cursors', async () => {
    const enc = (v: unknown) =>
      Buffer.from(JSON.stringify({ v, id: 'attention' })).toString('base64url');
    for (const v of [-1, 1.5, 'abc']) {
      const res = await get(`/api/merge-requests?view=attention&cursor=${enc(v)}`);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('INVALID_CURSOR');
    }
  });

  it('returns an empty page for an offset past the end', async () => {
    await scenario();
    const cursor = Buffer.from(JSON.stringify({ v: 100, id: 'attention' })).toString('base64url');
    const res = await get(`/api/merge-requests?view=attention&cursor=${cursor}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ items: [], nextCursor: null });
  });

  it('keeps the Needs attention badge equal to the list length', async () => {
    const { me } = await scenario();
    const items = await list(`view=attention&me=${me.id}`);
    const counts = mergeRequestCountsSchema.parse(
      (await get(`/api/merge-requests/counts?me=${me.id}`)).json(),
    );
    expect(counts.attention).toBe(items.length);
  });

  it('leaves reasons out of the normal list', async () => {
    await scenario();
    const [first] = await list('');
    expect(first.reasons).toBeUndefined();
  });
});

describe('GET /api/merge-requests?mine=1', () => {
  it('matches author, assignee and reviewer', async () => {
    const repo = await createRepo();
    const [me, other] = [await createUser('me'), await createUser('other')];
    await createMr({ repositoryId: repo.id, authorId: me.id, title: 'authored' });
    await createMr({
      repositoryId: repo.id,
      authorId: other.id,
      assigneeId: me.id,
      title: 'assigned',
    });
    await createMr({
      repositoryId: repo.id,
      authorId: other.id,
      reviewerIds: [me.id],
      title: 'reviewing',
    });
    await createMr({ repositoryId: repo.id, authorId: other.id, title: 'not mine' });
    const mine = await list(`mine=1&me=${me.id}&sort=title&order=asc`);
    expect(mine.map((m: { title: string }) => m.title)).toEqual([
      'assigned',
      'authored',
      'reviewing',
    ]);
    // Without a known user the toggle cannot narrow anything.
    expect(await list('mine=1')).toHaveLength(4);
  });
});

describe('GET /api/merge-requests/counts', () => {
  it('counts every tab', async () => {
    const { me } = await scenario();
    const res = await get(`/api/merge-requests/counts?me=${me.id}`);
    expect(mergeRequestCountsSchema.parse(res.json())).toEqual({
      attention: 4,
      all: 6,
      open: 5,
      inReview: 0,
      draft: 0,
      merged: 1,
      closed: 0,
    });
  });

  it('applies the same filters as the list but ignores status', async () => {
    const { me, other } = await scenario();
    const counts = async (qs: string) =>
      mergeRequestCountsSchema.parse((await get(`/api/merge-requests/counts?${qs}`)).json());
    expect(await counts(`me=${me.id}&mine=1`)).toMatchObject({
      attention: 2,
      all: 2,
      open: 2,
      merged: 0,
    });
    expect(await counts(`authorId=${other.id}&status=MERGED`)).toMatchObject({ all: 5, merged: 1 });
    expect(await counts('q=stale')).toMatchObject({ all: 1, attention: 1 });
  });
});
