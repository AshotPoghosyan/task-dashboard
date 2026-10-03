import type { MrStatus, Provider, ReviewerState } from '@mrdash/shared';

export interface NormalizedUser {
  externalId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface NormalizedReviewer {
  user: NormalizedUser;
  state: ReviewerState;
}

export interface NormalizedMR {
  externalId: string;
  number: number;
  title: string;
  description: string | null;
  status: MrStatus;
  isDraft: boolean;
  sourceBranch: string;
  targetBranch: string;
  url: string;
  author: NormalizedUser;
  assignee: NormalizedUser | null;
  reviewers: NormalizedReviewer[];
  createdAtRemote: Date;
  updatedAtRemote: Date;
  mergedAt: Date | null;
  closedAt: Date | null;
}

/** The slice of a repository row a provider needs to talk to the remote API. */
export interface ProviderRepo {
  provider: Provider;
  externalId: string;
  fullPath: string;
}

/**
 * Webhook parsing/verification (`parseWebhook`, `verifyWebhook`) joins this interface in Phase 6.
 */
export interface GitProvider {
  listMergeRequests(repo: ProviderRepo, updatedSince?: Date): AsyncIterable<NormalizedMR>;
}
