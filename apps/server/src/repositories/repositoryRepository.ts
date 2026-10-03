import type { Provider, Repository } from '@prisma/client';
import { getPrisma } from '../db/prisma.js';

export function listRepositories(): Promise<Repository[]> {
  return getPrisma().repository.findMany({ orderBy: [{ fullPath: 'asc' }, { id: 'asc' }] });
}

export function findRepositoryByExternalId(
  provider: Provider,
  externalId: string,
): Promise<Repository | null> {
  return getPrisma().repository.findUnique({
    where: { provider_externalId: { provider, externalId } },
  });
}
