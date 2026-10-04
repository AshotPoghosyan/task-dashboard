import type { MrStatus, Prisma } from '@prisma/client';
import { getPrisma } from '../db/prisma.js';
import type { Db } from './db.js';

const userSelect = {
  id: true,
  provider: true,
  externalId: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} satisfies Prisma.GitUserSelect;

const mrInclude = {
  author: { select: userSelect },
  assignee: { select: userSelect },
  reviewers: {
    select: { state: true, gitUser: { select: userSelect } },
    orderBy: { createdAt: 'asc' },
  },
  tasks: { select: { task: { select: { id: true, title: true } } } },
} satisfies Prisma.MergeRequestInclude;

export type MergeRequestRow = Prisma.MergeRequestGetPayload<{ include: typeof mrInclude }>;

export function listMergeRequests(
  where: Prisma.MergeRequestWhereInput,
  orderBy: Prisma.MergeRequestOrderByWithRelationInput[],
  take: number,
): Promise<MergeRequestRow[]> {
  return getPrisma().mergeRequest.findMany({ where, orderBy, take, include: mrInclude });
}

export async function mergeRequestExists(id: string, db: Db): Promise<boolean> {
  return (await db.mergeRequest.count({ where: { id } })) > 0;
}

/** Every row matching `where`, newest update first. Used by the bounded "needs attention" set. */
export function listAllMergeRequests(where: Prisma.MergeRequestWhereInput) {
  return getPrisma().mergeRequest.findMany({
    where,
    orderBy: [{ updatedAtRemote: 'desc' }, { id: 'desc' }],
    include: mrInclude,
  });
}

export function countMergeRequests(where: Prisma.MergeRequestWhereInput): Promise<number> {
  return getPrisma().mergeRequest.count({ where });
}

export async function countMergeRequestsByStatus(
  where: Prisma.MergeRequestWhereInput,
): Promise<Partial<Record<MrStatus, number>>> {
  const rows = await getPrisma().mergeRequest.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}
