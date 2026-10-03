import { filterOptionsSchema, repositoryListSchema, statsSchema } from '@mrdash/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { Env } from '../config/env.js';
import { getFilterOptions } from '../services/filterOptionsService.js';
import { listAllRepositories } from '../services/repositoryService.js';
import { getStats } from '../services/statsService.js';

/** Small read-only endpoints: stats, filter options, repositories. */
export const lookupRoutes: FastifyPluginAsync<{ env: Env }> = async (app, { env }) => {
  app.get('/api/stats', async () => statsSchema.parse(await getStats(env.APP_TIMEZONE)));

  app.get('/api/filters/options', async () => filterOptionsSchema.parse(await getFilterOptions()));

  app.get('/api/repositories', async () =>
    repositoryListSchema.parse({ items: await listAllRepositories() }),
  );
};
