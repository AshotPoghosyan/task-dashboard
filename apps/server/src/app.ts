import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from './config/env.js';
import { errorHandlerPlugin } from './plugins/errorHandler.js';
import { healthRoutes } from './routes/health.js';

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
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(errorHandlerPlugin);
  await app.register(healthRoutes);

  app.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  return app;
}
