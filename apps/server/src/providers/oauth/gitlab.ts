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
  username: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
});
const memberSchema = z.object({ state: z.string().optional() });

export interface GitLabOAuthOptions {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Full path of the group whose members may sign in (needs the `read_api` scope). */
  group: string;
  fetchFn?: FetchFn;
}

export function createGitLabOAuth(o: GitLabOAuthOptions): OAuthProvider {
  const fetchFn = o.fetchFn ?? fetch;
  const base = o.baseUrl.replace(/\/+$/, '');
  const api = (path: string, token: string, allow: number[] = []) =>
    requestJson(fetchFn, `${base}/api/v4${path}`, { headers: bearer(token) }, allow);

  return {
    id: 'GITLAB',
    name: 'GitLab',
    authorizeUrl({ state, codeChallenge, redirectUri, withMembership }) {
      const url = new URL(`${base}/oauth/authorize`);
      url.search = new URLSearchParams({
        client_id: o.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: withMembership ? 'read_user read_api' : 'read_user',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      }).toString();
      return url.toString();
    },
    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const { body } = await requestJson(fetchFn, `${base}/oauth/token`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: o.clientId,
          client_secret: o.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }).toString(),
      });
      const parsed = tokenSchema.safeParse(body);
      if (!parsed.success) throw new OAuthError('GitLab did not return an access token');
      return parsed.data.access_token;
    },
    async fetchIdentity(token): Promise<OAuthIdentity> {
      const user = userSchema.parse((await api('/user', token)).body);
      return {
        externalId: String(user.id),
        username: user.username,
        email: user.email || null,
        displayName: user.name || user.username,
        avatarUrl: user.avatar_url ?? null,
      };
    },
    async isMember(token, identity) {
      if (!o.group) return false;
      // `members/all` includes members inherited from parent groups.
      const { status, body } = await api(
        `/groups/${encodeURIComponent(o.group)}/members/all/${identity.externalId}`,
        token,
        [404],
      );
      return status === 200 && (memberSchema.safeParse(body).data?.state ?? 'active') === 'active';
    },
  };
}
