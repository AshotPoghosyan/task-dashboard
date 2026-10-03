import type { AuthMode, Provider } from '@mrdash/shared';

/** The env fields that decide how sign-in works; kept structural so `env.ts` can use it too. */
export interface AuthEnvFields {
  AUTH_MODE?: AuthMode | undefined;
  DASHBOARD_PASSWORD: string;
  GITHUB_OAUTH_CLIENT_ID: string;
  GITHUB_OAUTH_CLIENT_SECRET: string;
  GITLAB_OAUTH_CLIENT_ID: string;
  GITLAB_OAUTH_CLIENT_SECRET: string;
  AUTH_ALLOWED_USERS: string;
  AUTH_ALLOWED_GITHUB_ORG: string;
  AUTH_ALLOWED_GITLAB_GROUP: string;
  AUTH_ADMINS: string;
}

/** Providers whose client ID and secret are both set. */
export function configuredProviders(env: AuthEnvFields): Provider[] {
  const list: Provider[] = [];
  if (env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET) list.push('GITHUB');
  if (env.GITLAB_OAUTH_CLIENT_ID && env.GITLAB_OAUTH_CLIENT_SECRET) list.push('GITLAB');
  return list;
}

/** `AUTH_MODE`, or `oauth` when a provider is configured, else `password`. */
export function resolveAuthMode(env: AuthEnvFields): AuthMode {
  return env.AUTH_MODE ?? (configuredProviders(env).length > 0 ? 'oauth' : 'password');
}

export const oauthEnabled = (env: AuthEnvFields): boolean => resolveAuthMode(env) !== 'password';

/** The shared-password login is on when the mode allows it and a password is set. */
export const passwordEnabled = (env: AuthEnvFields): boolean =>
  resolveAuthMode(env) !== 'oauth' && env.DASHBOARD_PASSWORD !== '';

/** True when `/api` requires a login at all. A password-only app with no password is open. */
export const loginRequired = (env: AuthEnvFields): boolean =>
  oauthEnabled(env) || passwordEnabled(env);

/** Comma-separated env value → trimmed, lower-cased, non-empty entries. */
export function parseList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export const hasAllowlist = (env: AuthEnvFields): boolean =>
  parseList(env.AUTH_ALLOWED_USERS).length > 0 ||
  parseList(env.AUTH_ADMINS).length > 0 ||
  env.AUTH_ALLOWED_GITHUB_ORG.trim() !== '' ||
  env.AUTH_ALLOWED_GITLAB_GROUP.trim() !== '';
