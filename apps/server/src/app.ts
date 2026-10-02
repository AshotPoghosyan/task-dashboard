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
import { healthRoutes } from './routes/health.js';
import { lookupRoutes } from './routes/lookups.js';
import { mergeRequestRoutes } from './routes/mergeRequests.js';
import { taskRoutes } from './routes/tasks.js';

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
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
  await app.register(cors, { origin: env.WEB_ORIGIN });
  await app.register(sensible);
  await app.register(rateLimit, { max: env.RATE_LIMIT_MAX, timeWindow: '1 minute' });
  await app.register(errorHandlerPlugin);
  await app.register(etagPlugin);
  await app.register(compress, { threshold: 1024 });
  await app.register(authPlugin, { env });
  await app.register(healthRoutes);
  await app.register(authRoutes, { env });
  await app.register(taskRoutes);
  await app.register(mergeRequestRoutes);
  await app.register(lookupRoutes, { env });

  app.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  return app;
}
