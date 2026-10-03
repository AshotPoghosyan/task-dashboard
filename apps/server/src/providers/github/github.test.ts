import { describe, expect, it } from 'vitest';
import { fakeFetch, fixture } from '../../test/fakeFetch.js';
import { createGitHubProvider, nextLink } from './index.js';
import type { GitHubPr, GitHubReview } from './mapper.js';

const repo = { provider: 'GITHUB' as const, externalId: 'o/r', fullPath: 'o/r' };
const page1 = fixture<GitHubPr[]>(import.meta.url, 'pulls-page1.json');
const page2 = fixture<GitHubPr[]>(import.meta.url, 'pulls-page2.json');
const reviews12 = fixture<GitHubReview[]>(import.meta.url, 'reviews-12.json');

const NEXT =
  '<https://api.github.example/repos/o/r/pulls?page=2>; rel="next", <https://x>; rel="last"';

function provider() {
  const f = fakeFetch((url) => {
    if (url.pathname.endsWith('/pulls/12/reviews')) return { body: reviews12 };
    if (url.pathname.includes('/reviews')) return { body: [] };
    return url.searchParams.get('page') === '2'
      ? { body: page2 }
      : { body: page1, headers: { link: NEXT } };
  });
  const p = createGitHubProvider({
    token: 'tok',
    baseUrl: 'https://api.github.example',
    http: { fetchFn: f.fetchFn, sleep: () => Promise.resolve() },
  });
  return { p, f };
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

describe('nextLink', () => {
  it('extracts rel=next', () => {
    expect(nextLink(NEXT)).toBe('https://api.github.example/repos/o/r/pulls?page=2');
    expect(nextLink('<https://x>; rel="last"')).toBeNull();
    expect(nextLink(null)).toBeNull();
  });
});

describe('GitHub provider', () => {
  it('follows Link headers across multiple pages (full sync)', async () => {
    const { p } = provider();
    const prs = await collect(p.listMergeRequests(repo));
    expect(prs.map((m) => m.number)).toEqual([12, 11, 10]);
  });

  it('stops at the first PR older than the last sync (incremental)', async () => {
    const { p, f } = provider();
    const prs = await collect(p.listMergeRequests(repo, new Date('2026-09-30T00:00:00Z')));
    expect(prs.map((m) => m.number)).toEqual([12, 11]);
    // PR 10 is on page 2: it is read, found too old, and never gets a reviews request.
    expect(f.urls.some((u) => u.includes('/pulls/10/reviews'))).toBe(false);
  });

  it('maps requested reviewers and review states', async () => {
    const { p } = provider();
    const [reviewed, draft, merged] = await collect(p.listMergeRequests(repo));
    expect(reviewed?.status).toBe('IN_REVIEW');
    expect(reviewed?.reviewers.map((r) => [r.user.username, r.state])).toEqual([
      ['bob', 'APPROVED'], // a later comment must not erase the approval
      ['carol', 'CHANGES_REQUESTED'],
    ]); // the author's own comment is ignored
    expect(draft).toMatchObject({ status: 'DRAFT', isDraft: true, reviewers: [] });
    expect(merged).toMatchObject({ status: 'MERGED', targetBranch: 'main' });
  });

  it('marks a re-requested reviewer as REQUESTED again', async () => {
    const f = fakeFetch((url) =>
      url.pathname.includes('/reviews')
        ? { body: reviews12 }
        : { body: [{ ...page1[0], requested_reviewers: [reviews12[0]?.user] }] },
    );
    const p = createGitHubProvider({
      token: 't',
      baseUrl: 'https://g.example',
      http: { fetchFn: f.fetchFn },
    });
    const [pr] = await collect(p.listMergeRequests(repo));
    expect(pr?.reviewers.find((r) => r.user.username === 'bob')?.state).toBe('REQUESTED');
  });
});
