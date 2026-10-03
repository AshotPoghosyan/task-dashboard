import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { disconnectPrisma } from '../db/prisma.js';
import { createWebhookHandlers } from '../providers/webhooks.js';
import type { WebhookQueue } from '../services/webhookIngestService.js';
import { processWebhookEvent } from '../services/webhookProcessor.js';
import { truncateAll } from '../test/db.js';
import { prisma, testEnv } from '../test/factories.js';

const env = testEnv({ GITLAB_WEBHOOK_SECRET: 'gl-secret', GITHUB_WEBHOOK_SECRET: 'gh-secret' });
const handlers = createWebhookHandlers(env);
const noop = (): void => undefined;
const queue: WebhookQueue = {
  enqueue: async (id) => {
    await processWebhookEvent(id, { handlers, logger: { info: noop, warn: noop, error: noop } });
  },
};

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
});

function signedGithub(body: string, id: string) {
  const sig = createHmac('sha256', 'gh-secret').update(body).digest('hex');
  return app.inject({
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
}

const fixture = (): string =>
  readFileSync(
    new URL('../providers/github/__fixtures__/webhook-opened.json', import.meta.url),
    'utf8',
  );

describe('webhook edge cases', () => {
  it.each(['null', '[]', '42', '"text"'])(
    'accepts signed JSON body %s and the worker ignores it without failing',
    async (body) => {
      const res = await signedGithub(body, `edge-${body}`);
      expect(res.statusCode).toBe(202);
      const event = await prisma().webhookEvent.findFirstOrThrow();
      expect(event.processedAt).not.toBeNull();
      expect(event.error).toBe('ignored: unsupported payload');
    },
  );

  it('stores unicode titles intact', async () => {
    await prisma().repository.create({
      data: {
        provider: 'GITHUB',
        externalId: 'acme/widgets',
        fullPath: 'acme/widgets',
        webUrl: 'x',
      },
    });
    const payload = JSON.parse(fixture()) as { pull_request: { title: string } };
    payload.pull_request.title = 'Ուղղում 🐛 — «naïve» 日本語';
    expect((await signedGithub(JSON.stringify(payload), 'uni-1')).statusCode).toBe(202);
    const mr = await prisma().mergeRequest.findFirstOrThrow();
    expect(mr.title).toBe('Ուղղում 🐛 — «naïve» 日本語');
  });

  it('rejects an oversized body with 413 before doing any work', async () => {
    const res = await signedGithub(' '.repeat(6 * 1024 * 1024), 'big-1');
    expect(res.statusCode).toBe(413);
    expect(await prisma().webhookEvent.count()).toBe(0);
  });

  it('handles concurrent identical deliveries: one accepted, rest duplicates', async () => {
    await prisma().repository.create({
      data: {
        provider: 'GITHUB',
        externalId: 'acme/widgets',
        fullPath: 'acme/widgets',
        webUrl: 'x',
      },
    });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => signedGithub(fixture(), 'same-delivery')),
    );
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes).toEqual([200, 200, 200, 200, 202]);
    expect(await prisma().mergeRequest.count()).toBe(1);
  });
});
