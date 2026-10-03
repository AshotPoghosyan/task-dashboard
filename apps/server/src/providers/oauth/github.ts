import { z } from 'zod';
import {
  bearer,
  OAuthError,
  requestJson,
  type FetchFn,
  type OAuthIdentity,
  type OAuthProvider,
} from './types.js';

const tokenSchema = z.object({ access_token: z.string().min(1) });
const userSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
});
const emailsSchema = z.array(
  z.object({ email: z.string(), primary: z.boolean(), verified: z.boolean() }),
);
const membershipSchema = z.object({ state: z.string() });

export interface GitHubOAuthOptions {
  clientId: string;
  clientSecret: string;
  /** Members of this org may sign in (needs the `read:org` scope). */
  org: string;
  fetchFn?: FetchFn;
}

export function createGitHubOAuth(o: GitHubOAuthOptions): OAuthProvider {
  const fetchFn = o.fetchFn ?? fetch;
  const api = (path: string, token: string, allow: number[] = []) =>
    requestJson(
      fetchFn,
      `https://api.github.com${path}`,
      { headers: { ...bearer(token), 'x-github-api-version': '2022-11-28' } },
      allow,
    );

  return {
    id: 'GITHUB',
    name: 'GitHub',
    authorizeUrl({ state, codeChallenge, redirectUri, withMembership }) {
      const url = new URL('https://github.com/login/oauth/authorize');
      url.search = new URLSearchParams({
        client_id: o.clientId,
        redirect_uri: redirectUri,
        scope: withMembership ? 'read:user user:email read:org' : 'read:user user:email',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      }).toString();
      return url.toString();
    },
    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const { body } = await requestJson(fetchFn, 'https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: o.clientId,
          client_secret: o.clientSecret,
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }).toString(),
      });
      // GitHub answers 200 with `{ error }` for a bad or reused code.
      const parsed = tokenSchema.safeParse(body);
      if (!parsed.success) throw new OAuthError('GitHub did not return an access token');
      return parsed.data.access_token;
    },
    async fetchIdentity(token): Promise<OAuthIdentity> {
      const user = userSchema.parse((await api('/user', token)).body);
      let email = user.email ?? null;
      if (!email) {
        // Best effort: the email only helps allowlist matching, so a failure here is not fatal.
        const emails = await api('/user/emails', token)
          .then((r) => emailsSchema.safeParse(r.body))
          .catch(() => null);
        email = emails?.success
          ? (emails.data.find((e) => e.primary && e.verified)?.email ?? null)
          : null;
      }
      return {
        externalId: String(user.id),
        username: user.login,
        email,
        displayName: user.name || user.login,
        avatarUrl: user.avatar_url ?? null,
      };
    },
    async isMember(token) {
      if (!o.org) return false;
      const { status, body } = await api(
        `/user/memberships/orgs/${encodeURIComponent(o.org)}`,
        token,
        [403, 404],
      );
      return status === 200 && membershipSchema.safeParse(body).data?.state === 'active';
    },
  };
}
