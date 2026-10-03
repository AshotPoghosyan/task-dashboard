import type { Prisma } from '@prisma/client';
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
