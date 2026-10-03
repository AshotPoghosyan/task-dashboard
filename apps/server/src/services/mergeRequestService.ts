import type { MergeRequest, MergeRequestFilters } from '@mrdash/shared';
import type { Prisma } from '@prisma/client';
import { listMergeRequests } from '../repositories/mergeRequestRepository.js';
import { decodeCursor, paginate } from '../utils/cursor.js';
import { AppError } from '../utils/errors.js';
import { escapeLike } from '../utils/search.js';
import { toMergeRequest } from './mappers.js';

const SORT_COLUMNS = {
  updatedAt: 'updatedAtRemote',
  createdAt: 'createdAtRemote',
  title: 'title',
} as const;

export function buildMergeRequestWhere(f: MergeRequestFilters): Prisma.MergeRequestWhereInput {
  const where: Prisma.MergeRequestWhereInput = {};
  if (f.provider) where.provider = { in: f.provider };
  if (f.repositoryId) where.repositoryId = { in: f.repositoryId };
  if (f.status) where.status = { in: f.status };
  if (f.authorId) where.authorId = { in: f.authorId };
  if (f.assigneeId) where.assigneeId = { in: f.assigneeId };
  if (f.reviewerId) where.reviewers = { some: { gitUserId: { in: f.reviewerId } } };
  if (f.targetBranch) where.targetBranch = { in: f.targetBranch };
  if (f.q) where.title = { contains: escapeLike(f.q), mode: 'insensitive' };
  return where;
}

function sortValue(
  row: { updatedAtRemote: Date; createdAtRemote: Date; title: string },
  column: string,
) {
  if (column === 'title') return row.title;
  return (column === 'updatedAtRemote' ? row.updatedAtRemote : row.createdAtRemote).toISOString();
}

export async function listMergeRequestsPage(
  f: MergeRequestFilters,
): Promise<{ items: MergeRequest[]; nextCursor: string | null }> {
  const column = SORT_COLUMNS[f.sort];
  const cmp = f.order === 'desc' ? 'lt' : 'gt';
  const clauses: Prisma.MergeRequestWhereInput[] = [buildMergeRequestWhere(f)];

  if (f.cursor) {
    const { v, id } = decodeCursor(f.cursor);
    const value = column === 'title' ? String(v) : new Date(String(v));
    if (value instanceof Date && Number.isNaN(value.getTime())) {
      throw AppError.badRequest('INVALID_CURSOR', 'Invalid pagination cursor');
    }
    clauses.push({
      OR: [{ [column]: { [cmp]: value } }, { [column]: value, id: { [cmp]: id } }],
    });
  }

  const rows = await listMergeRequests(
    { AND: clauses },
    [{ [column]: f.order }, { id: f.order }],
    f.limit + 1,
  );
  const page = paginate(rows, f.limit, (r) => ({ v: sortValue(r, column), id: r.id }));
  return { items: page.items.map(toMergeRequest), nextCursor: page.nextCursor };
}
