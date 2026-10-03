import { mapGitLabStatus } from '@mrdash/shared';
import type { NormalizedMR, NormalizedUser } from '../types.js';

export interface GitLabUser {
  id: number;
  username: string;
  name?: string | null;
  avatar_url?: string | null;
}

/** Fields of `GET /projects/:id/merge_requests` items that we use. */
export interface GitLabMr {
  id: number;
  iid: number;
  title: string;
  description?: string | null;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  draft?: boolean;
  source_branch: string;
  target_branch: string;
  web_url: string;
  author: GitLabUser;
  assignee?: GitLabUser | null;
  reviewers?: GitLabUser[];
  created_at: string;
  updated_at: string;
  merged_at?: string | null;
  closed_at?: string | null;
}

export function mapGitLabUser(u: GitLabUser): NormalizedUser {
  return {
    externalId: String(u.id),
    username: u.username,
    displayName: u.name?.trim() || u.username,
    avatarUrl: u.avatar_url ?? null,
  };
}

const toDate = (v: string | null | undefined): Date | null => (v ? new Date(v) : null);

export function mapGitLabMr(mr: GitLabMr): NormalizedMR {
  const reviewers = mr.reviewers ?? [];
  const status = mapGitLabStatus({ state: mr.state, draft: mr.draft ?? false, reviewers });
  return {
    externalId: String(mr.id),
    number: mr.iid,
    title: mr.title,
    description: mr.description ?? null,
    status,
    isDraft: status === 'DRAFT',
    sourceBranch: mr.source_branch,
    targetBranch: mr.target_branch,
    url: mr.web_url,
    author: mapGitLabUser(mr.author),
    assignee: mr.assignee ? mapGitLabUser(mr.assignee) : null,
    // The list endpoint exposes no approval state, so every reviewer is REQUESTED.
    reviewers: reviewers.map((u) => ({ user: mapGitLabUser(u), state: 'REQUESTED' as const })),
    createdAtRemote: new Date(mr.created_at),
    updatedAtRemote: new Date(mr.updated_at),
    mergedAt: toDate(mr.merged_at),
    closedAt: toDate(mr.closed_at),
  };
}
