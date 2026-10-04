import {
  compareAttention,
  getAttentionReasons,
  type MergeRequest,
  type MergeRequestCounts,
  type MergeRequestFilters,
} from '@mrdash/shared';
import type { Prisma } from '@prisma/client';
import {
  countMergeRequests,
  countMergeRequestsByStatus,
  listAllMergeRequests,
} from '../repositories/mergeRequestRepository.js';
import { decodeCursor, encodeCursor } from '../utils/cursor.js';
import { AppError } from '../utils/errors.js';
import { toMergeRequest } from './mappers.js';
import { buildMergeRequestWhere } from './mergeRequestService.js';

const DAY_MS = 86_400_000;

/**
 * Database pre-filter for "needs attention". The shared `getAttentionReasons` stays the
 * source of truth: the list re-checks every row with it, so this only has to cover the same rules.
 */
export function attentionWhere(
  me: string | undefined,
  staleDays: number,
  now: Date,
): Prisma.MergeRequestWhereInput {
  const any: Prisma.MergeRequestWhereInput[] = [
    { status: 'OPEN', isDraft: false, reviewers: { none: {} } },
    { updatedAtRemote: { lt: new Date(now.getTime() - staleDays * DAY_MS) } },
  ];
  if (me) {
    any.push(
      { reviewers: { some: { gitUserId: me, state: 'REQUESTED' } } },
      { authorId: me, reviewers: { some: { state: 'CHANGES_REQUESTED' } } },
    );
  }
  return { status: { in: ['DRAFT', 'OPEN', 'IN_REVIEW'] }, OR: any };
}

/**
 * The attention list is bounded (only active MRs that match a rule), so it is sorted in
 * memory by the shared comparator and paged with an offset cursor.
 */
export async function listAttentionPage(
  f: MergeRequestFilters,
  staleDays: number,
  now: Date = new Date(),
): Promise<{ items: MergeRequest[]; nextCursor: string | null }> {
  const offset = f.cursor ? Number(decodeCursor(f.cursor).v) : 0;
  if (!Number.isInteger(offset) || offset < 0) {
    throw AppError.badRequest('INVALID_CURSOR', 'Invalid pagination cursor');
  }
  const rows = await listAllMergeRequests({
    AND: [buildMergeRequestWhere(f), attentionWhere(f.me, staleDays, now)],
  });
  const withReasons = rows
    .map(toMergeRequest)
    .map((mr) => ({ ...mr, reasons: getAttentionReasons(mr, f.me ?? null, staleDays, now) }))
    .filter((mr) => mr.reasons.length > 0)
    .sort(compareAttention);
  const items = withReasons.slice(offset, offset + f.limit);
  const end = offset + items.length;
  return {
    items,
    nextCursor: end < withReasons.length ? encodeCursor({ v: end, id: 'attention' }) : null,
  };
}

/** Tab badges: the filters apply, but status and view do not (each tab is a status). */
export async function getMergeRequestCounts(
  f: MergeRequestFilters,
  staleDays: number,
  now: Date = new Date(),
): Promise<MergeRequestCounts> {
  const where = buildMergeRequestWhere({ ...f, status: undefined });
  const [byStatus, attention] = await Promise.all([
    countMergeRequestsByStatus(where),
    countMergeRequests({ AND: [where, attentionWhere(f.me, staleDays, now)] }),
  ]);
  const n = (s: keyof typeof byStatus) => byStatus[s] ?? 0;
  return {
    attention,
    all: Object.values(byStatus).reduce((a, b) => a + b, 0),
    open: n('OPEN'),
    inReview: n('IN_REVIEW'),
    draft: n('DRAFT'),
    merged: n('MERGED'),
    closed: n('CLOSED'),
  };
}
