import { syncStatusResponseSchema, triggerSyncResponseSchema } from '@mrdash/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { disconnectPrisma } from '../db/prisma.js';
import type { GitProvider } from '../providers/types.js';
import { truncateAll } from '../test/db.js';
import { createRepo, prisma, testEnv } from '../test/factories.js';

const enqueueAll = vi.fn(() => Promise.resolve(2));
let app: FastifyInstance;

beforeAll(async () => {
  const providers = { GITLAB: { listMergeRequests: async function* () {} } satisfies GitProvider };
  app = await buildApp(testEnv(), { providers, syncTrigger: { enqueueAll } });
});
afterAll(async () => {
  await app.close();
  await disconnectPrisma();
});
beforeEach(() => truncateAll(prisma()));

describe('sync routes', () => {
  it('POST /api/sync queues a sync and answers 202', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/sync' });
    expect(res.statusCode).toBe(202);
    expect(triggerSyncResponseSchema.parse(res.json())).toEqual({ queued: 2 });
    expect(enqueueAll).toHaveBeenCalledOnce();
  });

  it('GET /api/sync/status reports providers, repositories and latest runs', async () => {
    const repo = await createRepo('GITLAB', 'g/app');
    await createRepo('GITHUB', 'o/never-synced');
    await prisma().syncRun.create({
      data: { repositoryId: repo.id, status: 'SUCCESS', finishedAt: new Date(), itemsFetched: 3 },
    });
    const last = await prisma().syncRun.create({
      data: {
        repositoryId: repo.id,
        status: 'FAILED',
        error: 'nope',
        startedAt: new Date(Date.now() + 1000),
      },
    });
    const res = await app.inject({ method: 'GET', url: '/api/sync/status' });
    expect(res.statusCode).toBe(200);
    const body = syncStatusResponseSchema.parse(res.json());
    expect(body.providers).toEqual({ GITLAB: true, GITHUB: false });
    expect(body.running).toBe(false);
    expect(body.repositories).toHaveLength(2);
    const app_ = body.repositories.find((r) => r.fullPath === 'g/app');
    expect(app_?.lastRun).toMatchObject({ id: last.id, status: 'FAILED', error: 'nope' });
    expect(body.repositories.find((r) => r.fullPath === 'o/never-synced')?.lastRun).toBeNull();
  });

  it('GET /api/sync/status reports running syncs', async () => {
    const repo = await createRepo();
    await prisma().syncRun.create({ data: { repositoryId: repo.id } });
    const res = await app.inject({ method: 'GET', url: '/api/sync/status' });
    expect(syncStatusResponseSchema.parse(res.json()).running).toBe(true);
  });
});
