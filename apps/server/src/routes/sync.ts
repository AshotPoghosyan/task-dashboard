import { syncStatusResponseSchema, triggerSyncResponseSchema } from '@mrdash/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { ProviderRegistry } from '../providers/registry.js';
import type { SyncTrigger } from '../services/syncService.js';
import { getSyncStatus } from '../services/syncStatusService.js';

interface Options {
  trigger: SyncTrigger;
  providers: ProviderRegistry;
}

export const syncRoutes: FastifyPluginAsync<Options> = async (app, { trigger, providers }) => {
  app.post('/api/sync', async (_request, reply) => {
    const queued = await trigger.enqueueAll();
    return reply.code(202).send(triggerSyncResponseSchema.parse({ queued }));
  });

  app.get('/api/sync/status', async () =>
    syncStatusResponseSchema.parse(await getSyncStatus(providers)),
  );
};
