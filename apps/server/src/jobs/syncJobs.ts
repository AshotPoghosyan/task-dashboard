import PgBoss from 'pg-boss';
import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../config/env.js';
import type { ProviderRegistry } from '../providers/registry.js';
import {
  failStaleRuns,
  findRepository,
  listActiveRepositories,
} from '../repositories/syncRepository.js';
import { syncRepository, type SyncTrigger } from '../services/syncService.js';

export const SYNC_QUEUE = 'sync-repository';
const STALE_RUN_MS = 60 * 60 * 1000;

export interface SyncScheduler extends SyncTrigger {
  start(logger: FastifyBaseLogger): Promise<void>;
  stop(): Promise<void>;
}

/**
 * pg-boss powered scheduler: every `SYNC_INTERVAL_MINUTES` one job per active repository is
 * queued. The queue policy `short` plus a per-repository singleton key means a repository never
 * has two queued jobs, so a slow sync cannot pile up work.
 */
export function createSyncScheduler(env: Env, providers: ProviderRegistry): SyncScheduler {
  const boss = new PgBoss(env.DATABASE_URL);
  let timer: NodeJS.Timeout | undefined;

  async function enqueueAll(): Promise<number> {
    const repos = await listActiveRepositories();
    for (const repo of repos) {
      await boss.send(
        SYNC_QUEUE,
        { repositoryId: repo.id },
        { singletonKey: repo.id, retryLimit: 0 },
      );
    }
    return repos.length;
  }

  return {
    enqueueAll,
    async start(logger) {
      boss.on('error', (err) => logger.error({ err }, 'pg-boss error'));
      await boss.start();
      await boss.createQueue(SYNC_QUEUE, { name: SYNC_QUEUE, policy: 'short' });
      await failStaleRuns(new Date(Date.now() - STALE_RUN_MS));

      await boss.work<{ repositoryId: string }>(SYNC_QUEUE, async (jobs) => {
        for (const job of jobs) {
          const repo = await findRepository(job.data.repositoryId);
          if (repo?.isActive) await syncRepository(repo, { providers, logger });
        }
      });

      const tick = (): void => {
        enqueueAll().catch((err: unknown) => logger.error({ err }, 'failed to enqueue sync jobs'));
      };
      timer = setInterval(tick, env.SYNC_INTERVAL_MINUTES * 60_000);
      timer.unref();
      tick();
      logger.info({ everyMinutes: env.SYNC_INTERVAL_MINUTES }, 'sync scheduler started');
    },
    async stop() {
      if (timer) clearInterval(timer);
      await boss.stop({ graceful: true, timeout: 10_000 });
    },
  };
}
