import { z } from 'zod';
import { providerSchema, syncStatusSchema } from '../enums.js';

const isoDate = z.string().datetime({ offset: true });

export const syncRunSchema = z.object({
  id: z.string(),
  status: syncStatusSchema,
  startedAt: isoDate,
  finishedAt: isoDate.nullable(),
  itemsFetched: z.number().int(),
  itemsUpserted: z.number().int(),
  error: z.string().nullable(),
});
export type SyncRun = z.infer<typeof syncRunSchema>;

export const repositorySyncStatusSchema = z.object({
  repositoryId: z.string(),
  provider: providerSchema,
  fullPath: z.string(),
  isActive: z.boolean(),
  lastSyncedAt: isoDate.nullable(),
  lastRun: syncRunSchema.nullable(),
});
export type RepositorySyncStatus = z.infer<typeof repositorySyncStatusSchema>;

export const syncStatusResponseSchema = z.object({
  running: z.boolean(),
  /** Which providers have a token configured (others are skipped during sync). */
  providers: z.object({ GITLAB: z.boolean(), GITHUB: z.boolean() }),
  repositories: z.array(repositorySyncStatusSchema),
});
export type SyncStatusResponse = z.infer<typeof syncStatusResponseSchema>;

export const triggerSyncResponseSchema = z.object({ queued: z.number().int() });
export type TriggerSyncResponse = z.infer<typeof triggerSyncResponseSchema>;
