import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { createOAuthRegistry } from '../providers/oauth/index.js';
import { fakeFetch, type FakeFetch, type FakeResponse } from './fakeFetch.js';
import { testEnv } from './factories.js';

export const oauthOverrides = {
  SESSION_SECRET: 's'.repeat(32),
  GITHUB_OAUTH_CLIENT_ID: 'gh-id',
  GITHUB_OAUTH_CLIENT_SECRET: 'gh-secret',
  GITLAB_OAUTH_CLIENT_ID: 'gl-id',
  GITLAB_OAUTH_CLIENT_SECRET: 'gl-secret',
  AUTH_ALLOWED_USERS: 'octocat',
};

export interface FakeProviderOptions {
  githubUser?: { id: number; login: string; email?: string | null };
  gitlabUser?: { id: number; username: string; email?: string | null };
  /** Response for `GET /user/memberships/orgs/:org`. */
  orgMembership?: FakeResponse;
  /** Response for `GET /api/v4/groups/:path/members/all/:id`. */
  groupMembership?: FakeResponse;
  tokenResponse?: FakeResponse;
}

/** Fake GitHub + GitLab endpoints; nothing touches the network. */
export function fakeProviders(o: FakeProviderOptions = {}): FakeFetch {
  const gh = o.githubUser ?? { id: 1, login: 'octocat', email: 'octo@example.com' };
  const gl = o.gitlabUser ?? { id: 2, username: 'tanuki', email: 'tanuki@example.com' };
  return fakeFetch((url) => {
    const { host, pathname } = url;
    if (pathname.endsWith('/access_token') || pathname === '/oauth/token') {
      return o.tokenResponse ?? { body: { access_token: `tok-${host}` } };
    }
    if (host === 'api.github.com' && pathname === '/user') return { body: gh };
    if (host === 'api.github.com' && pathname.startsWith('/user/memberships/orgs/')) {
      return o.orgMembership ?? { status: 404, body: { message: 'Not Found' } };
    }
    if (host === 'gitlab.com' && pathname === '/api/v4/user') return { body: gl };
    if (host === 'gitlab.com' && pathname.includes('/members/all/')) {
      return o.groupMembership ?? { status: 404, body: { message: '404 Not found' } };
    }
    return { status: 500, body: { message: `unexpected ${host}${pathname}` } };
  });
}

export function makeOAuthApp(
  overrides: Record<string, string> = {},
  fetchFn: typeof fetch = fakeProviders().fetchFn,
): Promise<FastifyInstance> {
  const env = testEnv({ ...oauthOverrides, ...overrides });
  return buildApp(env, { oauth: createOAuthRegistry(env, fetchFn) });
}

const cookieOf = (setCookie: unknown, name: string): string | undefined =>
  [setCookie]
    .flat()
    .find((c) => String(c).startsWith(`${name}=`))
    ?.toString()
    .split(';')[0];

export interface SignInResult {
  location: string;
  /** `name=value` of the session cookie, when one was issued. */
  session: string | undefined;
}

/** Walks login → provider → callback; `tamper` lets a test change what comes back. */
export async function signIn(
  app: FastifyInstance,
  provider: 'github' | 'gitlab' = 'github',
  tamper: { state?: string; query?: string } = {},
): Promise<SignInResult> {
  const login = await app.inject({ method: 'GET', url: `/api/auth/login/${provider}` });
  const authorize = new URL(String(login.headers.location));
  const stateCookie = cookieOf(login.headers['set-cookie'], 'mrdash_oauth') ?? '';
  const state = tamper.state ?? authorize.searchParams.get('state') ?? '';
  const query = tamper.query ?? `code=abc&state=${encodeURIComponent(state)}`;
  const cb = await app.inject({
    method: 'GET',
    url: `/api/auth/callback/${provider}?${query}`,
    headers: { cookie: stateCookie },
  });
  return {
    location: String(cb.headers.location),
    session: cookieOf(cb.headers['set-cookie'], 'mrdash_sid'),
  };
}

/** Signs in through the test-only helper; returns the `name=value` session cookie. */
export async function loginAs(
  app: FastifyInstance,
  username: string,
  role: 'ADMIN' | 'MEMBER' = 'MEMBER',
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/test-login',
    payload: { username, role },
  });
  const cookie = cookieOf(res.headers['set-cookie'], 'mrdash_sid');
  if (!cookie) throw new Error(`test-login failed: ${res.statusCode} ${res.body}`);
  return cookie;
}
