import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from './config/env.js';
import compress from '@fastify/compress';
import { authPlugin } from './plugins/auth.js';
import { errorHandlerPlugin } from './plugins/errorHandler.js';
import { etagPlugin } from './plugins/etag.js';
import { authRoutes } from './routes/auth.js';
import { eventsRoutes } from './routes/events.js';
import { healthRoutes } from './routes/health.js';
import { lookupRoutes } from './routes/lookups.js';
import { mergeRequestRoutes } from './routes/mergeRequests.js';
import { syncRoutes } from './routes/sync.js';
import { taskRoutes } from './routes/tasks.js';
import { userRoutes } from './routes/users.js';
import { createOAuthRegistry, type OAuthRegistry } from './providers/oauth/index.js';
import { webhookRoutes } from './routes/webhooks.js';
import { eventBus } from './events/bus.js';
import { createInlineWebhookQueue } from './jobs/webhookJobs.js';
import { createWebhookHandlers } from './providers/webhooks.js';
import { invalidateStatsCache } from './services/statsService.js';
import type { WebhookQueue } from './services/webhookIngestService.js';
import { createProviderRegistry, type ProviderRegistry } from './providers/registry.js';
import { createInlineTrigger, type SyncTrigger } from './services/syncService.js';

export interface AppDeps {
  providers?: ProviderRegistry;
  /** Sign-in providers; tests inject ones backed by a fake `fetch`. */
  oauth?: OAuthRegistry;
  /** Defaults to running syncs in-process; `server.ts` injects the pg-boss scheduler. */
  syncTrigger?: SyncTrigger;
  /** Defaults to processing webhooks in-process; `server.ts` injects the pg-boss queue. */
  webhookQueue?: WebhookQueue;
  /** SSE keep-alive interval; tests shorten it. */
  heartbeatMs?: number;
}

export async function buildApp(env: Env, deps: AppDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: env.TRUST_PROXY_HOPS > 0 ? (_address, hop) => hop < env.TRUST_PROXY_HOPS : false,
    genReqId: (req) => {
      const header = req.headers['x-request-id'];
      return typeof header === 'string' && header ? header : randomUUID();
    },
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
        : {}),
    },
  });

  await app.register(helmet);
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(sensible);
  await app.register(rateLimit, { max: env.RATE_LIMIT_MAX, timeWindow: '1 minute' });
  await app.register(errorHandlerPlugin);
  await app.register(etagPlugin);
  await app.register(compress, { threshold: 1024 });
  await app.register(authPlugin, { env });
  await app.register(healthRoutes);
  await app.register(authRoutes, { env, oauth: deps.oauth ?? createOAuthRegistry(env) });
  await app.register(userRoutes);
  await app.register(taskRoutes);
  await app.register(mergeRequestRoutes);
  await app.register(lookupRoutes, { env });
  const providers = deps.providers ?? createProviderRegistry(env);
  const trigger = deps.syncTrigger ?? createInlineTrigger({ providers, logger: app.log });
  await app.register(syncRoutes, { trigger, providers });

  const handlers = createWebhookHandlers(env);
  const webhookQueue = deps.webhookQueue ?? createInlineWebhookQueue({ handlers, logger: app.log });
  await app.register(webhookRoutes, { handlers, queue: webhookQueue });
  await app.register(eventsRoutes, {
    env,
    ...(deps.heartbeatMs !== undefined && { heartbeatMs: deps.heartbeatMs }),
  });

  // Any change announced on the bus makes the cached stats stale.
  const offStats = [
    eventBus.on('mr.updated', invalidateStatsCache),
    eventBus.on('sync.finished', invalidateStatsCache),
  ];
  app.addHook('onClose', async () => offStats.forEach((off) => off()));

  app.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  return app;
}
