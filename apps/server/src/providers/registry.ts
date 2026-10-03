import type { Provider } from '@mrdash/shared';
import type { Env } from '../config/env.js';
import { createGitHubProvider } from './github/index.js';
import { createGitLabProvider } from './gitlab/index.js';
import type { HttpOptions } from './http.js';
import type { GitProvider } from './types.js';

/** Providers that have credentials; a provider without a token is simply absent. */
export type ProviderRegistry = Partial<Record<Provider, GitProvider>>;

export function createProviderRegistry(
  env: Pick<Env, 'GITLAB_BASE_URL' | 'GITLAB_TOKEN' | 'GITHUB_TOKEN'>,
  http?: HttpOptions,
): ProviderRegistry {
  const registry: ProviderRegistry = {};
  if (env.GITLAB_TOKEN) {
    registry.GITLAB = createGitLabProvider({
      baseUrl: env.GITLAB_BASE_URL,
      token: env.GITLAB_TOKEN,
      ...(http && { http }),
    });
  }
  if (env.GITHUB_TOKEN) {
    registry.GITHUB = createGitHubProvider({
      token: env.GITHUB_TOKEN,
      ...(http && { http }),
    });
  }
  return registry;
}
