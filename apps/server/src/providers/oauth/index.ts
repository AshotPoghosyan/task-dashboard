import type { Provider } from '@mrdash/shared';
import type { Env } from '../../config/env.js';
import { createGitHubOAuth } from './github.js';
import { createGitLabOAuth } from './gitlab.js';
import type { FetchFn, OAuthProvider } from './types.js';

export type OAuthRegistry = Partial<Record<Provider, OAuthProvider>>;

/** Builds a provider for each one whose client ID and secret are set. */
export function createOAuthRegistry(env: Env, fetchFn?: FetchFn): OAuthRegistry {
  const registry: OAuthRegistry = {};
  if (env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET) {
    registry.GITHUB = createGitHubOAuth({
      clientId: env.GITHUB_OAUTH_CLIENT_ID,
      clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET,
      org: env.AUTH_ALLOWED_GITHUB_ORG.trim(),
      ...(fetchFn && { fetchFn }),
    });
  }
  if (env.GITLAB_OAUTH_CLIENT_ID && env.GITLAB_OAUTH_CLIENT_SECRET) {
    registry.GITLAB = createGitLabOAuth({
      baseUrl: env.GITLAB_BASE_URL,
      clientId: env.GITLAB_OAUTH_CLIENT_ID,
      clientSecret: env.GITLAB_OAUTH_CLIENT_SECRET,
      group: env.AUTH_ALLOWED_GITLAB_GROUP.trim(),
      ...(fetchFn && { fetchFn }),
    });
  }
  return registry;
}

export { OAuthError } from './types.js';
export type { OAuthIdentity, OAuthProvider } from './types.js';
