import { describe, expect, it, vi } from 'vitest';
import { fakeFetch, fixture, type FakeResponse } from '../../test/fakeFetch.js';
import type { GitLabMr } from './mapper.js';
import { createGitLabProvider } from './index.js';

const repo = { provider: 'GITLAB' as const, externalId: '42', fullPath: 'group/app' };
const page1 = fixture<GitLabMr[]>(import.meta.url, 'mrs-page1.json');
const page2 = fixture<GitLabMr[]>(import.meta.url, 'mrs-page2.json');

function provider(handler: Parameters<typeof fakeFetch>[0]) {
  const f = fakeFetch(handler);
  const p = createGitLabProvider({
    baseUrl: 'https://gitlab.example/',
    token: 'secret',
    http: { fetchFn: f.fetchFn, sleep: () => Promise.resolve() },
  });
  return { p, f };
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

describe('GitLab provider', () => {
  it('follows x-next-page across multiple pages', async () => {
    const { p, f } = provider((url) =>
      url.searchParams.get('page') === '1'
        ? { body: page1, headers: { 'x-next-page': '2' } }
        : { body: page2, headers: { 'x-next-page': '' } },
    );
    const mrs = await collect(p.listMergeRequests(repo));
    expect(mrs.map((m) => m.number)).toEqual([5, 4, 3]);
    expect(f.urls).toHaveLength(2);
    const first = new URL(f.urls[0] as string);
    expect(first.pathname).toBe('/api/v4/projects/42/merge_requests');
    expect(first.searchParams.has('updated_after')).toBe(false);
  });

  it('sends updated_after for incremental syncs and the token header', async () => {
    const headers: Headers[] = [];
    const fetchFn = vi.fn(async (_u: unknown, init?: RequestInit) => {
      headers.push(new Headers(init?.headers));
      return new Response('[]');
    }) as unknown as typeof fetch;
    const p = createGitLabProvider({
      baseUrl: 'https://gitlab.example',
      token: 'tok',
      http: { fetchFn },
    });
    await collect(p.listMergeRequests(repo, new Date('2026-10-01T00:00:00Z')));
    const url = new URL((fetchFn as unknown as { mock: { calls: string[][] } }).mock.calls[0]![0]!);
    expect(url.searchParams.get('updated_after')).toBe('2026-10-01T00:00:00.000Z');
    expect(headers[0]?.get('private-token')).toBe('tok');
  });

  it('maps status, reviewers, assignee and display-name fallback', async () => {
    const { p } = provider(() => ({ body: [...page1, ...page2] }));
    const [draft, review, merged] = await collect(p.listMergeRequests(repo));
    expect(draft).toMatchObject({
      status: 'DRAFT',
      isDraft: true,
      externalId: '9001',
      reviewers: [],
    });
    expect(review).toMatchObject({ status: 'IN_REVIEW', assignee: { username: 'alice' } });
    expect(review?.reviewers.map((r) => [r.user.username, r.state])).toEqual([
      ['alice', 'REQUESTED'],
      ['carol', 'REQUESTED'],
    ]);
    expect(review?.reviewers[1]?.user.displayName).toBe('carol'); // empty name → username
    expect(merged).toMatchObject({ status: 'MERGED', mergedAt: new Date('2026-09-12T10:00:00Z') });
    expect(merged?.url).toContain('/merge_requests/3');
  });

  it('retries a 429 in the middle of pagination', async () => {
    const { p, f } = provider((url, call): FakeResponse => {
      if (call === 2) return { status: 429, headers: { 'retry-after': '1' } };
      return url.searchParams.get('page') === '1'
        ? { body: page1, headers: { 'x-next-page': '2' } }
        : { body: page2 };
    });
    expect(await collect(p.listMergeRequests(repo))).toHaveLength(3);
    expect(f.urls).toHaveLength(3);
  });
});
