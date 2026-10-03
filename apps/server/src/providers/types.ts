import type { MrStatus, Provider, ReviewerState } from '@mrdash/shared';

export interface NormalizedUser {
  externalId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** Only the id is known (e.g. a webhook author id): never overwrite an existing user's fields. */
  partial?: boolean;
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

export interface GitProvider {
  listMergeRequests(repo: ProviderRepo, updatedSince?: Date): AsyncIterable<NormalizedMR>;
}

export type WebhookHeaders = Record<string, string | string[] | undefined>;

export interface ParsedWebhook {
  /** Matches `repositories.externalId` (GitLab project id / GitHub `owner/repo`). */
  repositoryExternalId: string;
  mr: NormalizedMR;
}

/**
 * Webhook side of a provider. Independent of `GitProvider` because webhook secrets and API
 * tokens are configured separately (a provider may receive webhooks without an API token).
 */
export interface WebhookHandler {
  verify(headers: WebhookHeaders, rawBody: Buffer): boolean;
  /** The event type when it is one we process, `null` for everything else. */
  relevantEvent(headers: WebhookHeaders): string | null;
  /** Provider delivery id, `null` if the headers carry none. */
  deliveryId(headers: WebhookHeaders): string | null;
  /** `null` when the payload is not a usable merge request event. */
  parse(payload: unknown): ParsedWebhook | null;
  /** Re-adds reviews the payload cannot carry (GitHub) from what is already stored. */
  mergeKnownReviewers?(mr: NormalizedMR, known: NormalizedReviewer[]): NormalizedMR;
}
