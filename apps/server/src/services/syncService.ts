import type { Repository } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import { eventBus, type EventBus } from '../events/bus.js';
import type { ProviderRegistry } from '../providers/registry.js';
import type { NormalizedMR } from '../providers/types.js';
import { inTransaction } from '../repositories/db.js';
import { upsertMergeRequestBatch } from '../repositories/mergeRequestSyncRepository.js';
import {
  createSyncRun,
  finishSyncRun,
  listActiveRepositories,
  setLastSyncedAt,
} from '../repositories/syncRepository.js';
import { recalculateTasksForMergeRequest } from './taskStatusService.js';

export const SYNC_BATCH_SIZE = 50;
const TRANSACTION_TIMEOUT_MS = 60_000;
/** Re-fetch this much before lastSyncedAt so clock skew with the remote cannot drop updates. */
export const INCREMENTAL_OVERLAP_MS = 60_000;

export interface SyncDeps {
  providers: ProviderRegistry;
  logger: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;
  bus?: EventBus;
  batchSize?: number;
}

export interface SyncOutcome {
  repositoryId: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  itemsFetched: number;
  itemsUpserted: number;
  error?: string;
}

/** Starts a sync of every active repository; resolves to the number of repositories queued. */
export interface SyncTrigger {
  enqueueAll(): Promise<number>;
}

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * One transaction per batch: MRs, users, reviewers and the status of every linked task commit
 * together. Events are emitted only after the commit.
 */
async function persistBatch(repo: Repository, batch: NormalizedMR[], bus: EventBus) {
  const { mrIds, taskIds } = await inTransaction(
    async (db) => {
      const ids = await upsertMergeRequestBatch(db, repo, batch);
      const tasks = new Set<string>();
      for (const id of ids) {
        for (const t of await recalculateTasksForMergeRequest(id, db)) tasks.add(t);
      }
      return { mrIds: ids, taskIds: [...tasks] };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
  for (const id of mrIds) bus.emit('mr.updated', { id, repositoryId: repo.id });
  for (const id of taskIds) bus.emit('task.updated', { id });
  return mrIds.length;
}

/** Syncs one repository. Never throws for provider/API failures: they are recorded as FAILED. */
export async function syncRepository(repo: Repository, deps: SyncDeps): Promise<SyncOutcome> {
  const { logger } = deps;
  const bus = deps.bus ?? eventBus;
  const provider = deps.providers[repo.provider];
  if (!provider) {
    logger.warn(
      { repository: repo.fullPath, provider: repo.provider },
      'no token configured for provider; skipping repository',
    );
    return { repositoryId: repo.id, status: 'SKIPPED', itemsFetched: 0, itemsUpserted: 0 };
  }

  const startedAt = new Date();
  const run = await createSyncRun(repo.id);
  const size = deps.batchSize ?? SYNC_BATCH_SIZE;
  let fetched = 0;
  let upserted = 0;
  try {
    let batch: NormalizedMR[] = [];
    const flush = async (): Promise<void> => {
      if (batch.length === 0) return;
      upserted += await persistBatch(repo, batch, bus);
      batch = [];
    };
    // First run (no lastSyncedAt) is a full sync; later runs are incremental.
    const since = repo.lastSyncedAt
      ? new Date(repo.lastSyncedAt.getTime() - INCREMENTAL_OVERLAP_MS)
      : undefined;
    for await (const mr of provider.listMergeRequests(repo, since)) {
      fetched++;
      batch.push(mr);
      if (batch.length >= size) await flush();
    }
    await flush();
    // Stamp with the start time so changes made during the run are picked up next time.
    await setLastSyncedAt(repo.id, startedAt);
    await finishSyncRun(run.id, {
      status: 'SUCCESS',
      itemsFetched: fetched,
      itemsUpserted: upserted,
    });
    bus.emit('sync.finished', { repositoryId: repo.id, status: 'SUCCESS' });
    logger.info({ repository: repo.fullPath, fetched, upserted }, 'repository synced');
    return {
      repositoryId: repo.id,
      status: 'SUCCESS',
      itemsFetched: fetched,
      itemsUpserted: upserted,
    };
  } catch (err) {
    const error = errorMessage(err);
    logger.error({ repository: repo.fullPath, err }, 'repository sync failed');
    await finishSyncRun(run.id, {
      status: 'FAILED',
      itemsFetched: fetched,
      itemsUpserted: upserted,
      error,
    });
    bus.emit('sync.finished', { repositoryId: repo.id, status: 'FAILED' });
    return {
      repositoryId: repo.id,
      status: 'FAILED',
      itemsFetched: fetched,
      itemsUpserted: upserted,
      error,
    };
  }
}

/** Syncs every active repository in turn; one failing never blocks the others. */
export async function syncAllRepositories(deps: SyncDeps): Promise<SyncOutcome[]> {
  const outcomes: SyncOutcome[] = [];
  for (const repo of await listActiveRepositories()) {
    try {
      outcomes.push(await syncRepository(repo, deps));
    } catch (err) {
      deps.logger.error({ repository: repo.fullPath, err }, 'unexpected sync error');
      outcomes.push({
        repositoryId: repo.id,
        status: 'FAILED',
        itemsFetched: 0,
        itemsUpserted: 0,
        error: errorMessage(err),
      });
    }
  }
  return outcomes;
}

/** Fallback trigger without a job queue: runs the sync in the background of this process. */
export function createInlineTrigger(deps: SyncDeps): SyncTrigger {
  let running = false;
  return {
    async enqueueAll() {
      const count = (await listActiveRepositories()).length;
      // A sync already in flight covers this request; never run two over the same repositories.
      if (running) return count;
      running = true;
      void syncAllRepositories(deps)
        .catch((err: unknown) => deps.logger.error({ err }, 'background sync failed'))
        .finally(() => {
          running = false;
        });
      return count;
    },
  };
}
