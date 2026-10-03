import { z } from 'zod';
import type { ParsedWebhook, WebhookHandler } from '../types.js';
import { headerValue, safeEqual } from '../webhookUtils.js';
import { mapGitLabMr, type GitLabMr } from './mapper.js';

const user = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string().nullish(),
  avatar_url: z.string().nullish(),
});

const payloadSchema = z.object({
  object_kind: z.literal('merge_request'),
  user: user.nullish(),
  project: z.object({ id: z.number() }),
  object_attributes: z.object({
    id: z.number(),
    iid: z.number(),
    title: z.string(),
    description: z.string().nullish(),
    state: z.enum(['opened', 'closed', 'merged', 'locked']),
    draft: z.boolean().nullish(),
    work_in_progress: z.boolean().nullish(),
    source_branch: z.string(),
    target_branch: z.string(),
    url: z.string(),
    author_id: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
    merged_at: z.string().nullish(),
    closed_at: z.string().nullish(),
  }),
  assignees: z.array(user).nullish(),
  reviewers: z.array(user).nullish(),
});

/** Webhook timestamps look like `2026-10-03 10:00:00 UTC`; the REST API uses ISO 8601. */
export function parseGitLabTime(value: string): string {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/.test(value)
    ? `${value.slice(0, 10)}T${value.slice(11, 19)}Z`
    : value;
}

function parse(payload: unknown): ParsedWebhook | null {
  const result = payloadSchema.safeParse(payload);
  if (!result.success) return null;
  const { object_attributes: a, user: actor, assignees, reviewers, project } = result.data;
  const time = (v: string | null | undefined): string | null => (v ? parseGitLabTime(v) : null);
  const updatedAt = parseGitLabTime(a.updated_at);

  // The payload carries only the author id; the actor is the author in the common case.
  const author =
    actor?.id === a.author_id ? actor : { id: a.author_id, username: `user-${a.author_id}` };
  const mr: GitLabMr = {
    id: a.id,
    iid: a.iid,
    title: a.title,
    description: a.description ?? null,
    state: a.state,
    draft: a.draft ?? a.work_in_progress ?? false,
    source_branch: a.source_branch,
    target_branch: a.target_branch,
    web_url: a.url,
    author,
    assignee: assignees?.[0] ?? null,
    reviewers: reviewers ?? [],
    created_at: parseGitLabTime(a.created_at),
    updated_at: updatedAt,
    // Merge/close times are not in every GitLab version's payload; the update time is the best proxy.
    merged_at: a.state === 'merged' ? (time(a.merged_at) ?? updatedAt) : null,
    closed_at: a.state === 'closed' ? (time(a.closed_at) ?? updatedAt) : null,
  };
  const dates = [mr.created_at, mr.updated_at];
  if (dates.some((d) => Number.isNaN(Date.parse(d)))) return null;

  const normalized = mapGitLabMr(mr);
  if (author !== actor) normalized.author.partial = true;
  return { repositoryExternalId: String(project.id), mr: normalized };
}

export function createGitLabWebhookHandler(secret: string): WebhookHandler {
  return {
    // No secret configured means webhooks are disabled, never "accept everything".
    verify: (headers) => {
      const token = headerValue(headers, 'x-gitlab-token');
      return secret !== '' && token !== null && safeEqual(token, secret);
    },
    relevantEvent: (headers) =>
      headerValue(headers, 'x-gitlab-event') === 'Merge Request Hook' ? 'merge_request' : null,
    deliveryId: (headers) => headerValue(headers, 'x-gitlab-event-uuid'),
    parse,
  };
}
