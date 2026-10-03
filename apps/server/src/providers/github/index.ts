import { getJson, type HttpOptions } from '../http.js';
import type { GitProvider, NormalizedMR, ProviderRepo } from '../types.js';
import { mapGitHubPr, type GitHubPr, type GitHubReview } from './mapper.js';

export interface GitHubProviderOptions {
  token: string;
  /** Defaults to the public API; overridable for GitHub Enterprise and tests. */
  baseUrl?: string;
  http?: HttpOptions;
}

const PER_PAGE = 100;

/** Extracts the `rel="next"` URL from a `Link` header. */
export function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const m = /<([^>]+)>\s*;\s*rel="next"/.exec(part);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function createGitHubProvider(opts: GitHubProviderOptions): GitProvider {
  const base = (opts.baseUrl ?? 'https://api.github.com').replace(/\/+$/, '');
  const http: HttpOptions = {
    ...opts.http,
    headers: {
      authorization: `Bearer ${opts.token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...opts.http?.headers,
    },
  };

  async function* pages<T>(firstUrl: string): AsyncGenerator<T[]> {
    let url: string | null = firstUrl;
    while (url) {
      const { data, headers } = await getJson<T[]>(url, http);
      yield data;
      url = nextLink(headers.get('link'));
    }
  }

  async function fetchReviews(repoPath: string, number: number): Promise<GitHubReview[]> {
    const all: GitHubReview[] = [];
    for await (const page of pages<GitHubReview>(
      `${base}/repos/${repoPath}/pulls/${number}/reviews?per_page=${PER_PAGE}`,
    )) {
      all.push(...page);
    }
    return all;
  }

  /** Newest-updated first, so a run can stop at the first PR older than `updatedSince`. */
  async function* listMergeRequests(
    repo: ProviderRepo,
    updatedSince?: Date,
  ): AsyncGenerator<NormalizedMR> {
    const query = `state=all&sort=updated&direction=desc&per_page=${PER_PAGE}`;
    for await (const page of pages<GitHubPr>(`${base}/repos/${repo.externalId}/pulls?${query}`)) {
      for (const pr of page) {
        if (updatedSince && new Date(pr.updated_at) < updatedSince) return;
        yield mapGitHubPr(pr, await fetchReviews(repo.externalId, pr.number));
      }
    }
  }

  return { listMergeRequests };
}
