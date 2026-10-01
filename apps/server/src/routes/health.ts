import type { FastifyPluginAsync } from 'fastify';
import { getHealth } from '../services/healthService.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/health', async (_request, reply) => {
    const health = await getHealth();
    return reply.code(health.status === 'ok' ? 200 : 503).send(health);
  });
};
