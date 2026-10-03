import { mergeRequestFiltersSchema, mergeRequestSchema, paginatedSchema } from '@mrdash/shared';
import type { FastifyPluginAsync } from 'fastify';
import { listMergeRequestsPage } from '../services/mergeRequestService.js';

const pageSchema = paginatedSchema(mergeRequestSchema);

export const mergeRequestRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/merge-requests', async (request) =>
    pageSchema.parse(await listMergeRequestsPage(mergeRequestFiltersSchema.parse(request.query))),
  );
};
