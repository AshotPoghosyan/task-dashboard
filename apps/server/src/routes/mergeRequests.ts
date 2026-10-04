import {
  mergeRequestCountsSchema,
  mergeRequestFiltersSchema,
  mergeRequestSchema,
  paginatedSchema,
} from '@mrdash/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { Env } from '../config/env.js';
import {
  getMergeRequestCounts,
  listAttentionPage,
} from '../services/mergeRequestAttentionService.js';
import { listMergeRequestsPage } from '../services/mergeRequestService.js';

const pageSchema = paginatedSchema(mergeRequestSchema);

export const mergeRequestRoutes: FastifyPluginAsync<{ env: Env }> = async (app, { env }) => {
  app.get('/api/merge-requests', async (request) => {
    const filters = mergeRequestFiltersSchema.parse(request.query);
    return pageSchema.parse(
      filters.view === 'attention'
        ? await listAttentionPage(filters, env.STALE_DAYS)
        : await listMergeRequestsPage(filters),
    );
  });

  app.get('/api/merge-requests/counts', async (request) =>
    mergeRequestCountsSchema.parse(
      await getMergeRequestCounts(mergeRequestFiltersSchema.parse(request.query), env.STALE_DAYS),
    ),
  );
};
