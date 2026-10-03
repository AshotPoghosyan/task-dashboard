import type { SyncStatusResponse } from '@mrdash/shared';
import type { ProviderRegistry } from '../providers/registry.js';
import { listRepositories } from '../repositories/repositoryRepository.js';
import { hasRunningSyncs, latestRunsByRepository } from '../repositories/syncRepository.js';

export async function getSyncStatus(providers: ProviderRegistry): Promise<SyncStatusResponse> {
  const [repos, runs, running] = await Promise.all([
    listRepositories(),
    latestRunsByRepository(),
    hasRunningSyncs(),
  ]);
  const runByRepo = new Map(runs.map((r) => [r.repositoryId, r]));
  return {
    running,
    providers: { GITLAB: !!providers.GITLAB, GITHUB: !!providers.GITHUB },
    repositories: repos.map((repo) => {
      const run = runByRepo.get(repo.id);
      return {
        repositoryId: repo.id,
        provider: repo.provider,
        fullPath: repo.fullPath,
        isActive: repo.isActive,
        lastSyncedAt: repo.lastSyncedAt?.toISOString() ?? null,
        lastRun: run
          ? {
              id: run.id,
              status: run.status,
              startedAt: run.startedAt.toISOString(),
              finishedAt: run.finishedAt?.toISOString() ?? null,
              itemsFetched: run.itemsFetched,
              itemsUpserted: run.itemsUpserted,
              error: run.error,
            }
          : null,
      };
    }),
  };
}
