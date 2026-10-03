import type { Repository } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventBus } from '../events/bus.js';
import { disconnectPrisma } from '../db/prisma.js';
import type { ProviderRegistry } from '../providers/registry.js';
import type { GitProvider, NormalizedMR, NormalizedUser } from '../providers/types.js';
import { truncateAll } from '../test/db.js';
import { createRepo, prisma } from '../test/factories.js';
import { syncAllRepositories, syncRepository, type SyncDeps } from './syncService.js';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const user = (n: number): NormalizedUser => ({
  externalId: String(n),
  username: `user${n}`,
  displayName: `User ${n}`,
  avatarUrl: null,
});

function mr(number: number, over: Partial<NormalizedMR> = {}): NormalizedMR {
  return {
    externalId: `x${number}`,
    number,
    title: `MR ${number}`,
    description: null,
    status: 'OPEN',
    isDraft: false,
    sourceBranch: `f/${number}`,
    targetBranch: 'main',
    url: `https://x/${number}`,
    author: user(1),
    assignee: null,
    reviewers: [],
    createdAtRemote: new Date('2026-09-01T00:00:00Z'),
    updatedAtRemote: new Date('2026-09-02T00:00:00Z'),
    mergedAt: null,
    closedAt: null,
    ...over,
  };
}

function staticProvider(items: NormalizedMR[]) {
  const calls: (Date | undefined)[] = [];
  const provider: GitProvider = {
    async *listMergeRequests(_repo, since) {
      calls.push(since);
      for (const item of items) yield item;
    },
  };
  return { provider, calls };
}

const deps = (providers: ProviderRegistry, extra: Partial<SyncDeps> = {}): SyncDeps => ({
  providers,
  logger,
  ...extra,
});

let repo: Repository;
beforeEach(async () => {
  vi.clearAllMocks();
  await truncateAll(prisma());
  repo = await createRepo('GITLAB');
});
afterAll(disconnectPrisma);

describe('syncRepository', () => {
  it('upserts users, MRs and reviewers and records a sync run', async () => {
    const { provider } = staticProvider([
      mr(1, { reviewers: [{ user: user(2), state: 'APPROVED' }], assignee: user(3) }),
      mr(2),
    ]);
    const out = await syncRepository(repo, deps({ GITLAB: provider }));
    expect(out).toMatchObject({ status: 'SUCCESS', itemsFetched: 2, itemsUpserted: 2 });

    const rows = await prisma().mergeRequest.findMany({
      include: { reviewers: true },
      orderBy: { number: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.reviewers).toMatchObject([{ state: 'APPROVED' }]);
    expect(await prisma().gitUser.count()).toBe(3);

    const [run] = await prisma().syncRun.findMany();
    expect(run).toMatchObject({
      status: 'SUCCESS',
      itemsFetched: 2,
      itemsUpserted: 2,
      error: null,
    });
    expect(run?.finishedAt).not.toBeNull();
    expect(
      (await prisma().repository.findUnique({ where: { id: repo.id } }))?.lastSyncedAt,
    ).not.toBeNull();
  });

  it('is idempotent: re-syncing creates no duplicates and reflects changes', async () => {
    const first = [mr(1, { reviewers: [{ user: user(2), state: 'REQUESTED' }] }), mr(2)];
    await syncRepository(repo, deps({ GITLAB: staticProvider(first).provider }));
    const again = [
      mr(1, {
        title: 'Renamed',
        status: 'IN_REVIEW',
        reviewers: [{ user: user(2), state: 'APPROVED' }],
      }),
      mr(2),
    ];
    const fresh = (await prisma().repository.findUnique({ where: { id: repo.id } })) as Repository;
    await syncRepository(fresh, deps({ GITLAB: staticProvider(again).provider }));
    await syncRepository(fresh, deps({ GITLAB: staticProvider(again).provider }));

    expect(await prisma().mergeRequest.count()).toBe(2);
    expect(await prisma().gitUser.count()).toBe(2);
    expect(await prisma().mergeRequestReviewer.count()).toBe(1);
    const one = await prisma().mergeRequest.findFirstOrThrow({
      where: { number: 1 },
      include: { reviewers: true },
    });
    expect(one).toMatchObject({ title: 'Renamed', status: 'IN_REVIEW' });
    expect(one.reviewers[0]?.state).toBe('APPROVED');
    expect(await prisma().syncRun.count()).toBe(3);
  });

  it('runs a full sync first, then incremental from the previous start time', async () => {
    const { provider, calls } = staticProvider([mr(1)]);
    await syncRepository(repo, deps({ GITLAB: provider }));
    expect(calls[0]).toBeUndefined();
    const synced = (await prisma().repository.findUnique({ where: { id: repo.id } })) as Repository;
    await syncRepository(synced, deps({ GITLAB: provider }));
    expect(calls[1]).toEqual(synced.lastSyncedAt);
  });

  it('batches large result sets across several transactions', async () => {
    const items = Array.from({ length: 7 }, (_, i) => mr(i + 1));
    const out = await syncRepository(
      repo,
      deps({ GITLAB: staticProvider(items).provider }, { batchSize: 3 }),
    );
    expect(out.itemsUpserted).toBe(7);
    expect(await prisma().mergeRequest.count()).toBe(7);
  });

  it('skips a provider without a token, with a warning and no run', async () => {
    const out = await syncRepository(repo, deps({}));
    expect(out.status).toBe('SKIPPED');
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(await prisma().syncRun.count()).toBe(0);
  });

  it('records FAILED, keeps lastSyncedAt unset, and emits sync.finished on error', async () => {
    const provider: GitProvider = {
      // eslint-disable-next-line require-yield -- throws before yielding by design
      async *listMergeRequests() {
        throw new Error('boom');
      },
    };
    const events: string[] = [];
    const off = eventBus.on('sync.finished', (e) => events.push(e.status));
    const out = await syncRepository(repo, deps({ GITLAB: provider }));
    off();
    expect(out).toMatchObject({ status: 'FAILED', error: 'boom' });
    expect(events).toEqual(['FAILED']);
    expect(await prisma().syncRun.findFirstOrThrow()).toMatchObject({
      status: 'FAILED',
      error: 'boom',
    });
    expect(
      (await prisma().repository.findUnique({ where: { id: repo.id } }))?.lastSyncedAt,
    ).toBeNull();
  });

  it('recalculates the status of tasks linked to a changed MR in the same sync', async () => {
    await syncRepository(repo, deps({ GITLAB: staticProvider([mr(1)]).provider }));
    const row = await prisma().mergeRequest.findFirstOrThrow();
    const task = await prisma().task.create({
      data: { title: 'T', status: 'OPEN', mergeRequests: { create: { mergeRequestId: row.id } } },
    });
    const merged = mr(1, { status: 'MERGED', mergedAt: new Date('2026-09-03T00:00:00Z') });
    const events: string[] = [];
    const off = eventBus.on('task.updated', (e) => events.push(e.id));
    await syncRepository(repo, deps({ GITLAB: staticProvider([merged]).provider }));
    off();
    expect((await prisma().task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe(
      'MERGED',
    );
    expect(events).toEqual([task.id]);
  });
});

describe('syncAllRepositories', () => {
  it('one failing repository never blocks the others', async () => {
    const bad = await createRepo('GITHUB', 'a/bad');
    const good = await createRepo('GITLAB', 'z/good');
    const providers: ProviderRegistry = {
      GITHUB: {
        // eslint-disable-next-line require-yield -- throws before yielding by design
        async *listMergeRequests() {
          throw new Error('github down');
        },
      },
      GITLAB: staticProvider([mr(1)]).provider,
    };
    const outcomes = await syncAllRepositories(deps(providers));
    const by = new Map(outcomes.map((o) => [o.repositoryId, o.status]));
    expect(by.get(bad.id)).toBe('FAILED');
    expect(by.get(good.id)).toBe('SUCCESS');
    expect(by.get(repo.id)).toBe('SUCCESS');
    expect(await prisma().mergeRequest.count({ where: { repositoryId: good.id } })).toBe(1);
  });

  it('ignores inactive repositories', async () => {
    await prisma().repository.update({ where: { id: repo.id }, data: { isActive: false } });
    expect(await syncAllRepositories(deps({ GITLAB: staticProvider([mr(1)]).provider }))).toEqual(
      [],
    );
  });
});
