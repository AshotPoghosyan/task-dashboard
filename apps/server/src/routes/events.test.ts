import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { disconnectPrisma } from '../db/prisma.js';
import { eventBus } from '../events/bus.js';
import { getStats } from '../services/statsService.js';
import { testEnv } from '../test/factories.js';

let app: FastifyInstance;
let base: string;

beforeEach(async () => {
  app = await buildApp(testEnv(), { heartbeatMs: 50 });
  base = await app.listen({ port: 0, host: '127.0.0.1' });
});
afterEach(async () => {
  await app.close();
  await disconnectPrisma();
});

/** Reads the stream until `done` accepts the text received so far. */
async function readUntil(res: Response, done: (text: string) => boolean): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (!done(text)) {
    const chunk = await reader.read();
    if (chunk.done) break;
    text += decoder.decode(chunk.value);
  }
  await reader.cancel();
  return text;
}

describe('GET /api/events', () => {
  it('streams bus events as SSE', async () => {
    const res = await fetch(`${base}/api/events`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    setTimeout(() => {
      eventBus.emit('mr.updated', { id: 'mr1', repositoryId: 'r1' });
      eventBus.emit('task.updated', { id: 't1' });
      eventBus.emit('sync.finished', { repositoryId: 'r1', status: 'SUCCESS' });
    }, 20);
    const text = await readUntil(res, (t) => t.includes('event: sync.finished'));
    expect(text).toContain('event: mr.updated\ndata: {"id":"mr1","repositoryId":"r1"}\n\n');
    expect(text).toContain('event: task.updated\ndata: {"id":"t1"}\n\n');
    expect(text).toContain('event: sync.finished\ndata: {"repositoryId":"r1","status":"SUCCESS"}');
  });

  it('sends heartbeats', async () => {
    const res = await fetch(`${base}/api/events`);
    const text = await readUntil(res, (t) => t.includes(': heartbeat'));
    expect(text).toContain(': heartbeat\n\n');
  });

  it('stops listening once the client disconnects', async () => {
    const res = await fetch(`${base}/api/events`);
    await readUntil(res, (t) => t.includes(': connected'));
    await new Promise((r) => setTimeout(r, 50));
    expect(eventBus.listenerCount('mr.updated')).toBe(1); // only the stats invalidation remains
  });

  it('requires a session when a dashboard password is set', async () => {
    const guarded = await buildApp(
      testEnv({ DASHBOARD_PASSWORD: 'pw', SESSION_SECRET: 'x'.repeat(20) }),
    );
    const res = await guarded.inject({ method: 'GET', url: '/api/events' });
    await guarded.close();
    expect(res.statusCode).toBe(401);
  });

  it('invalidates the stats cache when merge requests change', async () => {
    const first = await getStats('UTC');
    expect(await getStats('UTC')).toBe(first); // cached object
    eventBus.emit('mr.updated', { id: 'x', repositoryId: 'y' });
    expect(await getStats('UTC')).not.toBe(first);
  });
});
