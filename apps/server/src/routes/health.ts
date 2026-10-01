import type { FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@mrdash/shared';
import type { Database } from '../db/pool.js';

export const healthRoutes =
  (db: Database): FastifyPluginAsync =>
  async (app) => {
    app.get('/api/health', async (_req, reply) => {
      const dbUp = await db.ping();
      const body: HealthResponse = {
        status: dbUp ? 'ok' : 'degraded',
        db: dbUp ? 'up' : 'down',
        uptime: process.uptime(),
      };
      return reply.status(dbUp ? 200 : 503).send(body);
    });
  };
