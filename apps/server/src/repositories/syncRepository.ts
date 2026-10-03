import type { Repository, SyncRun } from '@prisma/client';
import { getPrisma } from '../db/prisma.js';

export function listActiveRepositories(): Promise<Repository[]> {
  return getPrisma().repository.findMany({
    where: { isActive: true },
    orderBy: [{ fullPath: 'asc' }, { id: 'asc' }],
  });
}

export function findRepository(id: string): Promise<Repository | null> {
  return getPrisma().repository.findUnique({ where: { id } });
}

export function createSyncRun(repositoryId: string): Promise<SyncRun> {
  return getPrisma().syncRun.create({ data: { repositoryId } });
}

export interface SyncRunResult {
  status: 'SUCCESS' | 'FAILED';
  itemsFetched: number;
  itemsUpserted: number;
  error?: string | null;
}

export function finishSyncRun(id: string, r: SyncRunResult): Promise<SyncRun> {
  return getPrisma().syncRun.update({
    where: { id },
    data: {
      status: r.status,
      finishedAt: new Date(),
      itemsFetched: r.itemsFetched,
      itemsUpserted: r.itemsUpserted,
      error: r.error ?? null,
    },
  });
}

export function setLastSyncedAt(repositoryId: string, at: Date): Promise<Repository> {
  return getPrisma().repository.update({ where: { id: repositoryId }, data: { lastSyncedAt: at } });
}

/** Most recent run per repository (one query, no N+1). */
export function latestRunsByRepository(): Promise<SyncRun[]> {
  return getPrisma().syncRun.findMany({
    distinct: ['repositoryId'],
    orderBy: [{ repositoryId: 'asc' }, { startedAt: 'desc' }, { id: 'desc' }],
  });
}

export async function hasRunningSyncs(): Promise<boolean> {
  return (await getPrisma().syncRun.count({ where: { status: 'RUNNING' } })) > 0;
}

/** Marks runs left RUNNING by a crashed process as failed. */
export function failStaleRuns(olderThan: Date): Promise<{ count: number }> {
  return getPrisma().syncRun.updateMany({
    where: { status: 'RUNNING', startedAt: { lt: olderThan } },
    data: { status: 'FAILED', finishedAt: new Date(), error: 'interrupted' },
  });
}
