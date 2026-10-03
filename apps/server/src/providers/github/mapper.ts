import { mapGitHubStatus, type ReviewerState } from '@mrdash/shared';
import type { NormalizedMR, NormalizedReviewer, NormalizedUser } from '../types.js';

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url?: string | null;
}

/** Fields of `GET /repos/:owner/:repo/pulls` items that we use. */
export interface GitHubPr {
  id: number;
  number: number;
  title: string;
  body?: string | null;
  state: 'open' | 'closed';
  draft?: boolean;
  html_url: string;
  user: GitHubUser;
  assignee?: GitHubUser | null;
  requested_reviewers?: GitHubUser[];
  head: { ref: string };
  base: { ref: string };
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  merged_at?: string | null;
}

/** Fields of `GET /repos/:owner/:repo/pulls/:n/reviews` items that we use. */
export interface GitHubReview {
  user: GitHubUser | null;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
}

export function mapGitHubUser(u: GitHubUser): NormalizedUser {
  // The pulls API exposes no display name; fall back to the login (see DECISIONS.md).
  return {
    externalId: String(u.id),
    username: u.login,
    displayName: u.login,
    avatarUrl: u.avatar_url ?? null,
  };
}

/** Submitted reviews by someone other than the author (pending ones are invisible to others). */
function submittedReviews(pr: GitHubPr, reviews: readonly GitHubReview[]): GitHubReview[] {
  return reviews.filter((r) => r.user && r.user.id !== pr.user.id && r.state !== 'PENDING');
}

export function mapGitHubReviewers(
  pr: GitHubPr,
  reviews: readonly GitHubReview[],
): NormalizedReviewer[] {
  const byUser = new Map<number, NormalizedReviewer>();
  for (const r of submittedReviews(pr, reviews)) {
    const user = r.user as GitHubUser; // non-null: filtered by submittedReviews
    const prior = byUser.get(user.id)?.state;
    let state: ReviewerState;
    if (r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED') state = r.state;
    else if (r.state === 'COMMENTED' && prior)
      state = prior; // a comment keeps the verdict
    else state = 'REQUESTED';
    byUser.set(user.id, { user: mapGitHubUser(user), state });
  }
  // A (re-)requested review is pending again, whatever the previous verdict was.
  for (const u of pr.requested_reviewers ?? []) {
    byUser.set(u.id, { user: mapGitHubUser(u), state: 'REQUESTED' });
  }
  return [...byUser.values()];
}

export function mapGitHubPr(pr: GitHubPr, reviews: readonly GitHubReview[]): NormalizedMR {
  const status = mapGitHubStatus({
    state: pr.state,
    merged_at: pr.merged_at ?? null,
    draft: pr.draft ?? false,
    requested_reviewers: pr.requested_reviewers ?? [],
    reviews: submittedReviews(pr, reviews),
  });
  return {
    externalId: String(pr.id),
    number: pr.number,
    title: pr.title,
    description: pr.body ?? null,
    status,
    isDraft: status === 'DRAFT',
    sourceBranch: pr.head.ref,
    targetBranch: pr.base.ref,
    url: pr.html_url,
    author: mapGitHubUser(pr.user),
    assignee: pr.assignee ? mapGitHubUser(pr.assignee) : null,
    reviewers: mapGitHubReviewers(pr, reviews),
    createdAtRemote: new Date(pr.created_at),
    updatedAtRemote: new Date(pr.updated_at),
    mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
    closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
  };
}
