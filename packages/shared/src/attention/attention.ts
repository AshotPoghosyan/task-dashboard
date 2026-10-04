import type { ReviewerState } from '../enums.js';

export const DEFAULT_STALE_DAYS = 7;

/** Why a merge request needs somebody's attention, in priority order (first = most urgent). */
export const ATTENTION_KINDS = [
  'REVIEW_REQUESTED',
  'CHANGES_REQUESTED',
  'NO_REVIEWER',
  'STALE',
] as const;
export type AttentionKind = (typeof ATTENTION_KINDS)[number];

export interface AttentionReason {
  kind: AttentionKind;
  /** Whole days since the last update; only set for `STALE`. */
  days?: number;
}

/** The fields of a merge request the rules look at (a subset of the API shape). */
export interface AttentionInput {
  status: 'DRAFT' | 'OPEN' | 'IN_REVIEW' | 'MERGED' | 'CLOSED';
  isDraft: boolean;
  updatedAtRemote: string;
  author: { id: string };
  reviewers: readonly { user: { id: string }; state: ReviewerState }[];
}

const DAY_MS = 86_400_000;

export const isActiveStatus = (status: AttentionInput['status']): boolean =>
  status === 'DRAFT' || status === 'OPEN' || status === 'IN_REVIEW';

/**
 * Why `mr` needs attention from `meId` (the current user's git user id, or null when unknown).
 * Only draft/open/in-review merge requests can need attention. With an unknown user only
 * "No reviewer" and "Stale" apply.
 */
export function getAttentionReasons(
  mr: AttentionInput,
  meId: string | null,
  staleDays: number = DEFAULT_STALE_DAYS,
  now: Date = new Date(),
): AttentionReason[] {
  if (!isActiveStatus(mr.status)) return [];
  const reasons: AttentionReason[] = [];
  if (meId) {
    if (mr.reviewers.some((r) => r.user.id === meId && r.state === 'REQUESTED')) {
      reasons.push({ kind: 'REVIEW_REQUESTED' });
    }
    if (mr.author.id === meId && mr.reviewers.some((r) => r.state === 'CHANGES_REQUESTED')) {
      reasons.push({ kind: 'CHANGES_REQUESTED' });
    }
  }
  if (mr.status === 'OPEN' && !mr.isDraft && mr.reviewers.length === 0) {
    reasons.push({ kind: 'NO_REVIEWER' });
  }
  const ageMs = now.getTime() - new Date(mr.updatedAtRemote).getTime();
  if (ageMs > staleDays * DAY_MS) reasons.push({ kind: 'STALE', days: Math.floor(ageMs / DAY_MS) });
  return reasons;
}

const rank = (reasons: readonly AttentionReason[]): number =>
  Math.min(...reasons.map((r) => ATTENTION_KINDS.indexOf(r.kind)));

/**
 * Sort order for the "Needs attention" list: your review, changes requested, no reviewer,
 * then stale. Stale items are oldest first; the others show the most recently updated first.
 */
export function compareAttention(
  a: { reasons: readonly AttentionReason[]; updatedAtRemote: string },
  b: { reasons: readonly AttentionReason[]; updatedAtRemote: string },
): number {
  const byRank = rank(a.reasons) - rank(b.reasons);
  if (byRank !== 0) return byRank;
  const diff = new Date(a.updatedAtRemote).getTime() - new Date(b.updatedAtRemote).getTime();
  return rank(a.reasons) === ATTENTION_KINDS.indexOf('STALE') ? diff : -diff;
}

const REASON_LABELS: Record<AttentionKind, string> = {
  REVIEW_REQUESTED: 'Waiting for your review',
  CHANGES_REQUESTED: 'Changes requested',
  NO_REVIEWER: 'No reviewer',
  STALE: 'Stale',
};

/** Chip text, e.g. "Stale 9d". */
export function attentionLabel(reason: AttentionReason): string {
  return reason.kind === 'STALE' && reason.days !== undefined
    ? `Stale ${reason.days}d`
    : REASON_LABELS[reason.kind];
}
