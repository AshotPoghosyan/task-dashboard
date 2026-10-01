import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from './config/env.js';
import { createDatabase, type Database } from './db/pool.js';
import errorHandler from './plugins/errorHandler.js';
import { healthRoutes } from './routes/health.js';

export interface BuildAppOptions {
  env: Env;
  db?: Database;
}

export async function buildApp({ env, db }: BuildAppOptions): Promise<FastifyInstance> {
  const database = db ?? createDatabase(env.DATABASE_URL);
  const app = Fastify({
    genReqId: (req) => {
      const header = req.headers['x-request-id'];
      return typeof header === 'string' && header ? header : randomUUID();
    },
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
    },
  });

  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });
  app.addHook('onClose', async () => {
    await database.close();
  });

  await app.register(helmet);
  await app.register(cors, { origin: env.WEB_ORIGIN });
  await app.register(rateLimit, { max: 600, timeWindow: '1 minute' });
  await app.register(sensible);
  await app.register(errorHandler);
  await app.register(healthRoutes(database));

  return app;
}
