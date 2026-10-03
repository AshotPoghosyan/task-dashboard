import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectPrisma } from '../db/prisma.js';
import { eventBus } from '../events/bus.js';
import { purgeOldWebhookEvents } from '../jobs/webhookJobs.js';
import { buildApp } from '../app.js';
import { createWebhookHandlers } from '../providers/webhooks.js';
import { processWebhookEvent } from '../services/webhookProcessor.js';
import type { WebhookQueue } from '../services/webhookIngestService.js';
import { truncateAll } from '../test/db.js';
import { prisma, testEnv } from '../test/factories.js';

const env = testEnv({ GITLAB_WEBHOOK_SECRET: 'gl-secret', GITHUB_WEBHOOK_SECRET: 'gh-secret' });
const handlers = createWebhookHandlers(env);
const noop = (): void => undefined;
// Processes synchronously so tests can assert on the outcome right after the response.
const queue: WebhookQueue = {
  enqueue: async (id) => {
    await processWebhookEvent(id, { handlers, logger: { info: noop, warn: noop, error: noop } });
  },
};
const enqueue = vi.spyOn(queue, 'enqueue');

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(env, { webhookQueue: queue });
});
afterAll(async () => {
  await app.close();
  await disconnectPrisma();
});
beforeEach(async () => {
  await truncateAll(prisma());
  enqueue.mockClear();
});

const raw = (path: string): string =>
  readFileSync(new URL(`../providers/${path}`, import.meta.url), 'utf8');

let delivery = 0;
function gitlab(fixture: string, over: { token?: string; uuid?: string; event?: string } = {}) {
  return app.inject({
    method: 'POST',
    url: '/api/webhooks/gitlab',
    headers: {
      'content-type': 'application/json',
      'x-gitlab-token': over.token ?? 'gl-secret',
      'x-gitlab-event': over.event ?? 'Merge Request Hook',
      'x-gitlab-event-uuid': over.uuid ?? `uuid-${++delivery}`,
    },
    payload: raw(`gitlab/__fixtures__/webhook-${fixture}.json`),
  });
}

function github(fixture: string, over: { secret?: string; id?: string; event?: string } = {}) {
  const payload = raw(`github/__fixtures__/webhook-${fixture}.json`);
  const sig = createHmac('sha256', over.secret ?? 'gh-secret')
    .update(payload)
    .digest('hex');
  return app.inject({
    method: 'POST',
    url: '/api/webhooks/github',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': `sha256=${sig}`,
      'x-github-event': over.event ?? 'pull_request',
      'x-github-delivery': over.id ?? `gh-${++delivery}`,
    },
    payload,
  });
}

const glRepo = () =>
  prisma().repository.create({
    data: { provider: 'GITLAB', externalId: '4242', fullPath: 'acme/app', webUrl: 'https://x' },
  });
const ghRepo = () =>
  prisma().repository.create({
    data: { provider: 'GITHUB', externalId: 'acme/widgets', fullPath: 'acme/widgets', webUrl: 'x' },
  });

describe('webhook authentication', () => {
  it('rejects a wrong GitLab token with 401 and stores nothing', async () => {
    await glRepo();
    const res = await gitlab('open', { token: 'nope' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { code: 'INVALID_SIGNATURE' } });
    expect(await prisma().webhookEvent.count()).toBe(0);
  });

  it('rejects a bad GitHub signature with 401', async () => {
    await ghRepo();
    expect((await github('opened', { secret: 'wrong' })).statusCode).toBe(401);
    expect(await prisma().webhookEvent.count()).toBe(0);
  });

  it('accepts the alias path and requires no session even when a password is set', async () => {
    const guarded = await buildApp(
      testEnv({
        GITLAB_WEBHOOK_SECRET: 'gl-secret',
        DASHBOARD_PASSWORD: 'pw',
        SESSION_SECRET: 'x'.repeat(20),
      }),
      { webhookQueue: queue },
    );
    const res = await guarded.inject({
      method: 'POST',
      url: '/api/gitlab-webhook',
      headers: {
        'content-type': 'application/json',
        'x-gitlab-token': 'gl-secret',
        'x-gitlab-event': 'Merge Request Hook',
        'x-gitlab-event-uuid': 'alias-1',
      },
      payload: raw('gitlab/__fixtures__/webhook-open.json'),
    });
    await guarded.close();
    expect(res.statusCode).toBe(202);
  });
});

describe('webhook ingestion', () => {
  it('stores the event, enqueues it and answers 202', async () => {
    await glRepo();
    const res = await gitlab('open', { uuid: 'u1' });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ status: 'accepted' });
    expect(enqueue).toHaveBeenCalledOnce();
    const event = await prisma().webhookEvent.findFirstOrThrow();
    expect(event).toMatchObject({ provider: 'GITLAB', deliveryId: 'u1', error: null });
    expect(event.processedAt).not.toBeNull();
  });

  it('answers 200 and skips a duplicate delivery', async () => {
    await glRepo();
    expect((await gitlab('open', { uuid: 'dup' })).statusCode).toBe(202);
    const again = await gitlab('open', { uuid: 'dup' });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ status: 'duplicate' });
    expect(enqueue).toHaveBeenCalledOnce();
    expect(await prisma().webhookEvent.count()).toBe(1);
  });

  it('forgets the event when queueing fails so the provider retry is accepted', async () => {
    await glRepo();
    enqueue.mockRejectedValueOnce(new Error('queue down'));
    expect((await gitlab('open', { uuid: 'retry' })).statusCode).toBe(500);
    expect(await prisma().webhookEvent.count()).toBe(0);
    expect((await gitlab('open', { uuid: 'retry' })).statusCode).toBe(202);
  });

  it('ignores irrelevant event types with 200', async () => {
    await glRepo();
    const res = await gitlab('open', { event: 'Push Hook' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ignored' });
    expect(await prisma().webhookEvent.count()).toBe(0);
    expect((await github('opened', { event: 'ping' })).statusCode).toBe(200);
  });

  it('rejects a signed body that is not JSON', async () => {
    const body = 'not json';
    const sig = createHmac('sha256', 'gh-secret').update(body).digest('hex');
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/github',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': `sha256=${sig}`,
        'x-github-event': 'pull_request',
      },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
  });

  it('falls back to a body hash when no delivery id header is present', async () => {
    await glRepo();
    const send = () =>
      app.inject({
        method: 'POST',
        url: '/api/webhooks/gitlab',
        headers: {
          'content-type': 'application/json',
          'x-gitlab-token': 'gl-secret',
          'x-gitlab-event': 'Merge Request Hook',
        },
        payload: raw('gitlab/__fixtures__/webhook-open.json'),
      });
    expect((await send()).statusCode).toBe(202);
    expect((await send()).statusCode).toBe(200);
  });
});

describe('webhook processing', () => {
  it('ignores events for an unknown repository', async () => {
    const res = await gitlab('open');
    expect(res.statusCode).toBe(202);
    expect(await prisma().mergeRequest.count()).toBe(0);
    const event = await prisma().webhookEvent.findFirstOrThrow();
    expect(event.error).toBe('ignored: unknown repository');
    expect(event.processedAt).not.toBeNull();
  });

  it('creates an unknown MR on a known repository', async () => {
    const repo = await glRepo();
    await gitlab('reviewer-added');
    const mr = await prisma().mergeRequest.findFirstOrThrow({
      include: { reviewers: { include: { gitUser: true } }, author: true },
    });
    expect(mr).toMatchObject({ repositoryId: repo.id, number: 12, status: 'IN_REVIEW' });
    expect(mr.author.username).toBe('ada');
    expect(mr.reviewers.map((r) => r.gitUser.username)).toEqual(['grace']);
  });

  it('updates the MR through its lifecycle and ignores stale deliveries', async () => {
    await glRepo();
    await gitlab('open');
    await gitlab('merged');
    expect((await prisma().mergeRequest.findFirstOrThrow()).status).toBe('MERGED');
    await gitlab('draft'); // older than the merge
    const mr = await prisma().mergeRequest.findFirstOrThrow();
    expect(mr.status).toBe('MERGED');
    expect(mr.mergedAt?.toISOString()).toBe('2026-10-03T11:00:00.000Z');
    expect(await prisma().mergeRequest.count()).toBe(1);
  });

  it.each([
    ['opened', 'OPEN'],
    ['draft', 'DRAFT'],
    ['review-requested', 'IN_REVIEW'],
    ['closed-merged', 'MERGED'],
    ['closed-not-merged', 'CLOSED'],
  ])('stores the GitHub %s fixture as %s', async (fixture, status) => {
    await ghRepo();
    expect((await github(fixture)).statusCode).toBe(202);
    expect(await prisma().mergeRequest.findFirstOrThrow()).toMatchObject({ number: 34, status });
  });

  it('keeps a recorded GitHub approval when a later event lists no reviewers', async () => {
    const repo = await ghRepo();
    await github('review-requested');
    await prisma().mergeRequestReviewer.updateMany({ data: { state: 'APPROVED' } });
    await prisma().mergeRequest.updateMany({
      data: { updatedAtRemote: new Date('2026-10-03T10:00:00Z') },
    });
    await github('opened'); // payload has no requested reviewers
    const mr = await prisma().mergeRequest.findFirstOrThrow({
      where: { repositoryId: repo.id },
      include: { reviewers: true },
    });
    expect(mr.status).toBe('IN_REVIEW');
    expect(mr.reviewers.map((r) => r.state)).toEqual(['APPROVED']);
  });

  it('recalculates the status of linked tasks and emits events', async () => {
    const repo = await glRepo();
    await gitlab('open');
    const mr = await prisma().mergeRequest.findFirstOrThrow({ where: { repositoryId: repo.id } });
    const task = await prisma().task.create({
      data: {
        title: 'Login',
        status: 'OPEN',
        mergeRequests: { create: { mergeRequestId: mr.id } },
      },
    });
    const seen: string[] = [];
    const offs = [
      eventBus.on('mr.updated', (e) => seen.push(`mr:${e.id}`)),
      eventBus.on('task.updated', (e) => seen.push(`task:${e.id}`)),
    ];
    await gitlab('merged');
    offs.forEach((off) => off());
    expect((await prisma().task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe(
      'MERGED',
    );
    expect(seen).toEqual([`mr:${mr.id}`, `task:${task.id}`]);
  });

  it('links an MR to the task named by "Task: #id"', async () => {
    await glRepo();
    const task = await prisma().task.create({ data: { title: 'Login' } });
    const payload = JSON.parse(raw('gitlab/__fixtures__/webhook-open.json')) as {
      object_attributes: { description: string };
    };
    payload.object_attributes.description = `Adds login\nTask: #${task.id}`;
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/gitlab',
      headers: {
        'content-type': 'application/json',
        'x-gitlab-token': 'gl-secret',
        'x-gitlab-event': 'Merge Request Hook',
        'x-gitlab-event-uuid': 'task-link',
      },
      payload: JSON.stringify(payload),
    });
    const linked = await prisma().task.findUniqueOrThrow({
      where: { id: task.id },
      include: { mergeRequests: true },
    });
    expect(linked.mergeRequests).toHaveLength(1);
    expect(linked.status).toBe('OPEN');
  });

  it('creates a BUG sub-task under the task linked to the parent MR, once', async () => {
    const repo = await ghRepo();
    const author = await prisma().gitUser.create({
      data: { provider: 'GITHUB', externalId: '1', username: 'p', displayName: 'P' },
    });
    const parentMr = await prisma().mergeRequest.create({
      data: {
        repositoryId: repo.id,
        provider: 'GITHUB',
        externalId: 'p1',
        number: 30,
        title: 'Parent',
        status: 'OPEN',
        sourceBranch: 'a',
        targetBranch: 'main',
        url: 'u',
        authorId: author.id,
        createdAtRemote: new Date(),
        updatedAtRemote: new Date(),
      },
    });
    const top = await prisma().task.create({
      data: { title: 'Feature', mergeRequests: { create: { mergeRequestId: parentMr.id } } },
    });
    const payload = JSON.parse(raw('github/__fixtures__/webhook-opened.json')) as {
      pull_request: { body: string };
    };
    payload.pull_request.body = 'Fix for the feature\nParent: #30';
    const body = JSON.stringify(payload);
    const sig = createHmac('sha256', 'gh-secret').update(body).digest('hex');
    const send = (id: string) =>
      app.inject({
        method: 'POST',
        url: '/api/webhooks/github',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': `sha256=${sig}`,
          'x-github-event': 'pull_request',
          'x-github-delivery': id,
        },
        payload: body,
      });
    await send('p-1');
    await send('p-2'); // redelivered under a new id: must not create a second sub-task
    const children = await prisma().task.findMany({ where: { parentId: top.id } });
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ type: 'BUG', title: 'Add search box', status: 'OPEN' });
  });
});

describe('retention', () => {
  it('deletes webhook events older than 30 days only', async () => {
    const now = new Date('2026-10-03T00:00:00Z');
    const row = (deliveryId: string, receivedAt: Date) =>
      prisma().webhookEvent.create({
        data: {
          provider: 'GITLAB',
          deliveryId,
          eventType: 'merge_request',
          payload: {},
          receivedAt,
        },
      });
    await row('old', new Date('2026-09-01T00:00:00Z'));
    await row('fresh', new Date('2026-09-20T00:00:00Z'));
    expect(await purgeOldWebhookEvents(now)).toBe(1);
    expect((await prisma().webhookEvent.findMany()).map((e) => e.deliveryId)).toEqual(['fresh']);
  });
});
