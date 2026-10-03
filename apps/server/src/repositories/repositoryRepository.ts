import type { Repository } from '@prisma/client';
import { getPrisma } from '../db/prisma.js';

export function listRepositories(): Promise<Repository[]> {
  return getPrisma().repository.findMany({ orderBy: [{ fullPath: 'asc' }, { id: 'asc' }] });
}
