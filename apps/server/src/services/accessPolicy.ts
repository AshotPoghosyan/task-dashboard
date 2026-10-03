import type { Provider } from '@mrdash/shared';
import { parseList } from '../config/authConfig.js';
import type { Env } from '../config/env.js';
import type { OAuthIdentity } from '../providers/oauth/index.js';

const PROVIDER_PREFIX = /^(github|gitlab):/;

/**
 * Whether a list entry names this person. Entries are a username or an email, optionally scoped
 * with `github:` / `gitlab:` so a GitHub "alex" is not confused with a GitLab "alex".
 */
export function listMatches(entries: string[], provider: Provider, id: OAuthIdentity): boolean {
  const names = [id.username.toLowerCase(), id.email?.toLowerCase()].filter(Boolean);
  return entries.some((entry) => {
    const scoped = PROVIDER_PREFIX.exec(entry);
    if (scoped && scoped[1] !== provider.toLowerCase()) return false;
    return names.includes(entry.replace(PROVIDER_PREFIX, ''));
  });
}

export const isListedAdmin = (env: Env, provider: Provider, id: OAuthIdentity): boolean =>
  listMatches(parseList(env.AUTH_ADMINS), provider, id);

/** Allowed by name: in `AUTH_ALLOWED_USERS` or `AUTH_ADMINS` (admins never need a second list). */
export const isListedUser = (env: Env, provider: Provider, id: OAuthIdentity): boolean =>
  listMatches(parseList(env.AUTH_ALLOWED_USERS), provider, id) || isListedAdmin(env, provider, id);
