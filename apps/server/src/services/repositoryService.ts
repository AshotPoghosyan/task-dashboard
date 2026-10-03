import type { Repository } from '@mrdash/shared';
import { listRepositories } from '../repositories/repositoryRepository.js';

export async function listAllRepositories(): Promise<Repository[]> {
  const rows = await listRepositories();
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    externalId: r.externalId,
    fullPath: r.fullPath,
    webUrl: r.webUrl,
    defaultBranch: r.defaultBranch,
    isActive: r.isActive,
    lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
  }));
}
