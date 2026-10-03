import type { FastifyPluginAsync } from 'fastify';
import type { Env } from '../config/env.js';
import { eventBus, type AppEvents } from '../events/bus.js';

export const HEARTBEAT_MS = 25_000;
const EVENT_NAMES: (keyof AppEvents)[] = ['mr.updated', 'task.updated', 'sync.finished'];

interface Options {
  env: Pick<Env, 'WEB_ORIGIN'>;
  heartbeatMs?: number;
}

/** `GET /api/events`: Server-Sent Events stream of bus events plus a keep-alive comment. */
export const eventsRoutes: FastifyPluginAsync<Options> = async (
  app,
  { env, heartbeatMs = HEARTBEAT_MS },
) => {
  const closers = new Set<() => void>();

  app.get('/api/events', (request, reply) => {
    // Hijacked responses skip Fastify's onSend/CORS hooks, so set what the browser needs here.
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      'access-control-allow-origin': env.WEB_ORIGIN,
      'access-control-allow-credentials': 'true',
      vary: 'Origin',
      'x-request-id': request.id,
    });
    res.write('retry: 5000\n: connected\n\n');

    const offs = EVENT_NAMES.map((name) =>
      eventBus.on(name, (payload) => {
        res.write(`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`);
      }),
    );
    const timer = setInterval(() => res.write(': heartbeat\n\n'), heartbeatMs);
    timer.unref();

    const close = (): void => {
      clearInterval(timer);
      for (const off of offs) off();
      closers.delete(close);
      if (!res.writableEnded) res.end();
    };
    closers.add(close);
    request.raw.on('close', close);
  });

  // Open streams never finish on their own and would keep `app.close()` waiting.
  app.addHook('preClose', async () => {
    for (const close of [...closers]) close();
  });
};
