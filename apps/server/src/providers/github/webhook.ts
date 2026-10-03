import { createHmac } from 'node:crypto';
import { z } from 'zod';
import type { NormalizedMR, NormalizedReviewer, ParsedWebhook, WebhookHandler } from '../types.js';
import { headerValue, safeEqual } from '../webhookUtils.js';
import { mapGitHubPr, type GitHubPr } from './mapper.js';

const user = z.object({ id: z.number(), login: z.string(), avatar_url: z.string().nullish() });

const payloadSchema = z.object({
  repository: z.object({ full_name: z.string() }),
  pull_request: z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    body: z.string().nullish(),
    state: z.enum(['open', 'closed']),
    draft: z.boolean().nullish(),
    html_url: z.string(),
    user,
    assignee: user.nullish(),
    requested_reviewers: z.array(user).nullish(),
    head: z.object({ ref: z.string() }),
    base: z.object({ ref: z.string() }),
    created_at: z.string(),
    updated_at: z.string(),
    closed_at: z.string().nullish(),
    merged_at: z.string().nullish(),
  }),
});

function parse(payload: unknown): ParsedWebhook | null {
  const result = payloadSchema.safeParse(payload);
  if (!result.success) return null;
  const { pull_request: pr, repository } = result.data;
  const dates = [pr.created_at, pr.updated_at];
  if (dates.some((d) => Number.isNaN(Date.parse(d)))) return null;
  // The payload has no review list; `mergeKnownReviewers` restores submitted reviews afterwards.
  return {
    repositoryExternalId: repository.full_name,
    mr: mapGitHubPr(pr as GitHubPr, []), // zod's nullish() output is a structural subtype of GitHubPr
  };
}

/**
 * A pull_request event lists only still-requested reviewers, so an approval would vanish from the
 * stored MR (and IN_REVIEW would fall back to OPEN). Keep verdicts that were already recorded.
 */
export function mergeKnownReviewers(mr: NormalizedMR, known: NormalizedReviewer[]): NormalizedMR {
  const present = new Set(mr.reviewers.map((r) => r.user.externalId));
  const kept = known.filter((r) => r.state !== 'REQUESTED' && !present.has(r.user.externalId));
  if (kept.length === 0) return mr;
  return {
    ...mr,
    status: mr.status === 'OPEN' ? 'IN_REVIEW' : mr.status,
    reviewers: [...mr.reviewers, ...kept],
  };
}

export function createGitHubWebhookHandler(secret: string): WebhookHandler {
  return {
    verify: (headers, rawBody) => {
      const signature = headerValue(headers, 'x-hub-signature-256');
      if (secret === '' || signature === null) return false;
      const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
      return safeEqual(signature, expected);
    },
    relevantEvent: (headers) =>
      headerValue(headers, 'x-github-event') === 'pull_request' ? 'pull_request' : null,
    deliveryId: (headers) => headerValue(headers, 'x-github-delivery'),
    parse,
    mergeKnownReviewers,
  };
}
