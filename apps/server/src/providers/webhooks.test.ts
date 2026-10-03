import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createGitHubWebhookHandler, mergeKnownReviewers } from './github/webhook.js';
import { createGitLabWebhookHandler, parseGitLabTime } from './gitlab/webhook.js';

const fixture = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

describe('GitLab webhook handler', () => {
  const handler = createGitLabWebhookHandler('s3cret');

  it('verifies the token in constant time and rejects wrong or missing ones', () => {
    const body = Buffer.from('{}');
    expect(handler.verify({ 'x-gitlab-token': 's3cret' }, body)).toBe(true);
    expect(handler.verify({ 'x-gitlab-token': 's3cre' }, body)).toBe(false);
    expect(handler.verify({ 'x-gitlab-token': 'x'.repeat(500) }, body)).toBe(false);
    expect(handler.verify({}, body)).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    expect(createGitLabWebhookHandler('').verify({ 'x-gitlab-token': '' }, Buffer.alloc(0))).toBe(
      false,
    );
  });

  it('only processes Merge Request Hook events', () => {
    expect(handler.relevantEvent({ 'x-gitlab-event': 'Merge Request Hook' })).toBe('merge_request');
    expect(handler.relevantEvent({ 'x-gitlab-event': 'Push Hook' })).toBeNull();
    expect(handler.deliveryId({ 'x-gitlab-event-uuid': 'abc' })).toBe('abc');
  });

  it.each([
    ['open', 'OPEN'],
    ['draft', 'DRAFT'],
    ['reviewer-added', 'IN_REVIEW'],
    ['merged', 'MERGED'],
    ['closed', 'CLOSED'],
  ])('maps the %s fixture to %s', (name, status) => {
    const parsed = handler.parse(fixture(`./gitlab/__fixtures__/webhook-${name}.json`));
    expect(parsed?.repositoryExternalId).toBe('4242');
    expect(parsed?.mr).toMatchObject({ number: 12, status, externalId: '9001' });
  });

  it('parses the "UTC" timestamp format and sets merged/closed times', () => {
    expect(parseGitLabTime('2026-10-03 11:00:00 UTC')).toBe('2026-10-03T11:00:00Z');
    expect(parseGitLabTime('2026-10-03T11:00:00.000Z')).toBe('2026-10-03T11:00:00.000Z');
    const merged = handler.parse(fixture('./gitlab/__fixtures__/webhook-merged.json'));
    expect(merged?.mr.mergedAt?.toISOString()).toBe('2026-10-03T11:00:00.000Z');
    const closed = handler.parse(fixture('./gitlab/__fixtures__/webhook-closed.json'));
    expect(closed?.mr.closedAt?.toISOString()).toBe('2026-10-03T11:30:00.000Z');
  });

  it('marks the author partial when the actor is someone else', () => {
    const payload = fixture('./gitlab/__fixtures__/webhook-open.json') as {
      user: { id: number; username: string };
    };
    payload.user = { id: 99, username: 'someone' };
    const parsed = handler.parse(payload);
    expect(parsed?.mr.author).toMatchObject({ externalId: '7', partial: true });
  });

  it('returns null for unusable payloads', () => {
    expect(handler.parse({ object_kind: 'push' })).toBeNull();
    const bad = fixture('./gitlab/__fixtures__/webhook-open.json') as {
      object_attributes: { updated_at: string };
    };
    bad.object_attributes.updated_at = 'garbage';
    expect(handler.parse(bad)).toBeNull();
  });
});

describe('GitHub webhook handler', () => {
  const handler = createGitHubWebhookHandler('s3cret');
  const sign = (body: Buffer, secret = 's3cret'): string =>
    `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('verifies the HMAC over the raw body', () => {
    const body = Buffer.from('{"a": 1}');
    expect(handler.verify({ 'x-hub-signature-256': sign(body) }, body)).toBe(true);
    expect(handler.verify({ 'x-hub-signature-256': sign(body, 'other') }, body)).toBe(false);
    expect(handler.verify({ 'x-hub-signature-256': sign(body) }, Buffer.from('{"a":1}'))).toBe(
      false,
    );
    expect(handler.verify({}, body)).toBe(false);
    expect(
      createGitHubWebhookHandler('').verify({ 'x-hub-signature-256': sign(body, '') }, body),
    ).toBe(false);
  });

  it('only processes pull_request events', () => {
    expect(handler.relevantEvent({ 'x-github-event': 'pull_request' })).toBe('pull_request');
    expect(handler.relevantEvent({ 'x-github-event': 'ping' })).toBeNull();
    expect(handler.deliveryId({ 'x-github-delivery': 'd1' })).toBe('d1');
  });

  it.each([
    ['opened', 'OPEN'],
    ['draft', 'DRAFT'],
    ['review-requested', 'IN_REVIEW'],
    ['closed-merged', 'MERGED'],
    ['closed-not-merged', 'CLOSED'],
  ])('maps the %s fixture to %s', (name, status) => {
    const parsed = handler.parse(fixture(`./github/__fixtures__/webhook-${name}.json`));
    expect(parsed?.repositoryExternalId).toBe('acme/widgets');
    expect(parsed?.mr).toMatchObject({ number: 34, status });
  });

  it('returns null for unusable payloads', () => {
    expect(handler.parse({ zen: 'Keep it logically awesome.' })).toBeNull();
  });

  it('keeps recorded verdicts that the payload cannot carry', () => {
    const parsed = handler.parse(fixture('./github/__fixtures__/webhook-opened.json'));
    const mr = parsed!.mr;
    const approver = {
      user: { externalId: '102', username: 'grace', displayName: 'grace', avatarUrl: null },
      state: 'APPROVED' as const,
    };
    const merged = mergeKnownReviewers(mr, [approver]);
    expect(merged.status).toBe('IN_REVIEW');
    expect(merged.reviewers).toEqual([approver]);
    expect(mergeKnownReviewers(mr, [])).toBe(mr);
    expect(mergeKnownReviewers(mr, [{ ...approver, state: 'REQUESTED' }])).toBe(mr);
  });
});
