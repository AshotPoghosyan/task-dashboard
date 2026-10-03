import { getJson, type HttpOptions } from '../http.js';
import type { GitProvider, NormalizedMR, ProviderRepo } from '../types.js';
import { mapGitLabMr, type GitLabMr } from './mapper.js';

export interface GitLabProviderOptions {
  baseUrl: string;
  token: string;
  http?: HttpOptions;
}

const PER_PAGE = 100;

export function createGitLabProvider(opts: GitLabProviderOptions): GitProvider {
  const base = opts.baseUrl.replace(/\/+$/, '');

  async function* listMergeRequests(
    repo: ProviderRepo,
    updatedSince?: Date,
  ): AsyncGenerator<NormalizedMR> {
    const params = new URLSearchParams({
      state: 'all',
      scope: 'all',
      order_by: 'updated_at',
      sort: 'desc',
      per_page: String(PER_PAGE),
    });
    if (updatedSince) params.set('updated_after', updatedSince.toISOString());
    const project = encodeURIComponent(repo.externalId);

    let page: string | null = '1';
    while (page) {
      params.set('page', page);
      const url = `${base}/api/v4/projects/${project}/merge_requests?${params.toString()}`;
      const { data, headers } = await getJson<GitLabMr[]>(url, {
        ...opts.http,
        headers: { 'PRIVATE-TOKEN': opts.token, ...opts.http?.headers },
      });
      for (const mr of data) yield mapGitLabMr(mr);
      page = headers.get('x-next-page') || null;
    }
  }

  return { listMergeRequests };
}
