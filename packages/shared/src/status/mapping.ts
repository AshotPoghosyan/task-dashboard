import type { MrStatus } from '../enums.js';

export interface GitLabMrInput {
  state: 'opened' | 'closed' | 'merged' | 'locked';
  draft: boolean;
  reviewers: readonly unknown[];
}

export interface GitHubPrInput {
  state: 'open' | 'closed';
  merged_at: string | null;
  draft: boolean;
  requested_reviewers: readonly unknown[];
  /** Submitted reviews; any review counts as "in review". */
  reviews?: readonly unknown[];
}

export function mapGitLabStatus(mr: GitLabMrInput): MrStatus {
  if (mr.state === 'merged') return 'MERGED';
  if (mr.state === 'closed') return 'CLOSED';
  if (mr.draft) return 'DRAFT';
  return mr.reviewers.length > 0 ? 'IN_REVIEW' : 'OPEN';
}

export function mapGitHubStatus(pr: GitHubPrInput): MrStatus {
  if (pr.merged_at) return 'MERGED';
  if (pr.state === 'closed') return 'CLOSED';
  if (pr.draft) return 'DRAFT';
  const hasReviewActivity = pr.requested_reviewers.length > 0 || (pr.reviews?.length ?? 0) > 0;
  return hasReviewActivity ? 'IN_REVIEW' : 'OPEN';
}
