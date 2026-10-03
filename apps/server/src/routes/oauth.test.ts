import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { disconnectPrisma } from '../db/prisma.js';
import { resetDatabase } from '../db/seed/reset.js';
import { prisma } from '../test/factories.js';
import { fakeProviders, makeOAuthApp, signIn } from '../test/oauth.js';

let app: FastifyInstance | undefined;
beforeEach(() => resetDatabase(prisma()));
afterEach(async () => {
  await app?.close();
  app = undefined;
});
afterAll(() => disconnectPrisma());

const WEB = 'http://localhost:5173';

describe('providers endpoint', () => {
  it('lists only configured providers and the active mode', async () => {
    app = await makeOAuthApp({ GITLAB_OAUTH_CLIENT_SECRET: '' });
    const res = await app.inject({ method: 'GET', url: '/api/auth/providers' });
    expect(res.json()).toEqual({
      mode: 'oauth',
      password: false,
      providers: [{ id: 'GITHUB', name: 'GitHub' }],
    });
  });

  it('offers the password form in both mode', async () => {
    app = await makeOAuthApp({ AUTH_MODE: 'both', DASHBOARD_PASSWORD: 'pw' });
    const res = await app.inject({ method: 'GET', url: '/api/auth/providers' });
    expect(res.json()).toMatchObject({ mode: 'both', password: true });
  });
});

describe('login redirect', () => {
  it('sends GitHub the state, PKCE challenge and least-privilege scopes', async () => {
    app = await makeOAuthApp();
    const res = await app.inject({ method: 'GET', url: '/api/auth/login/github' });
    expect(res.statusCode).toBe(302);
    const url = new URL(String(res.headers.location));
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('scope')).toBe('read:user user:email');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('redirect_uri')).toBe(`${WEB}/api/auth/callback/github`);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('asks for read:org / read_api only when a membership allowlist is set', async () => {
    app = await makeOAuthApp({
      AUTH_ALLOWED_GITHUB_ORG: 'acme',
      AUTH_ALLOWED_GITLAB_GROUP: 'acme/team',
    });
    const gh = await app.inject({ method: 'GET', url: '/api/auth/login/github' });
    expect(new URL(String(gh.headers.location)).searchParams.get('scope')).toBe(
      'read:user user:email read:org',
    );
    const gl = await app.inject({ method: 'GET', url: '/api/auth/login/gitlab' });
    const glUrl = new URL(String(gl.headers.location));
    expect(glUrl.searchParams.get('scope')).toBe('read_user read_api');
    expect(glUrl.searchParams.get('response_type')).toBe('code');
  });

  it('404s for an unconfigured provider', async () => {
    app = await makeOAuthApp({ GITLAB_OAUTH_CLIENT_ID: '' });
    expect((await app.inject({ method: 'GET', url: '/api/auth/login/gitlab' })).statusCode).toBe(
      404,
    );
  });
});

describe('callback', () => {
  it('signs in an allowlisted GitHub user and stores no provider token', async () => {
    app = await makeOAuthApp();
    const { location, session } = await signIn(app);
    expect(location).toBe(`${WEB}/`);
    expect(session).toBeTruthy();

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: session as string },
    });
    expect(me.json()).toMatchObject({ username: 'octocat', provider: 'GITHUB', role: 'MEMBER' });

    const user = await prisma().user.findFirstOrThrow();
    expect(user.email).toBe('octo@example.com');
    expect(user.lastLoginAt).not.toBeNull();
    // Only a hash of the cookie token is stored; nothing from the provider is.
    const stored = await prisma().session.findFirstOrThrow();
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify([user, stored])).not.toContain('tok-');
  });

  it('signs in a GitLab user from a self-hosted style allowlist entry (email, scoped)', async () => {
    app = await makeOAuthApp({ AUTH_ALLOWED_USERS: 'gitlab:TANUKI@example.com' });
    const { location, session } = await signIn(app, 'gitlab');
    expect(location).toBe(`${WEB}/`);
    expect(session).toBeTruthy();
  });

  it('does not let a scoped entry match the other provider', async () => {
    app = await makeOAuthApp({ AUTH_ALLOWED_USERS: 'gitlab:octocat' });
    const { location, session } = await signIn(app, 'github');
    expect(location).toBe(`${WEB}/access-denied`);
    expect(session).toBeUndefined();
  });

  it('rejects a wrong state', async () => {
    app = await makeOAuthApp();
    const { location, session } = await signIn(app, 'github', { state: 'forged' });
    expect(location).toBe(`${WEB}/login?error=state`);
    expect(session).toBeUndefined();
    expect(await prisma().user.count()).toBe(0);
  });

  it('rejects a callback with no state cookie', async () => {
    app = await makeOAuthApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/callback/github?code=abc&state=x',
    });
    expect(res.headers.location).toBe(`${WEB}/login?error=state`);
  });

  it('rejects a state cookie issued for another provider', async () => {
    app = await makeOAuthApp();
    const login = await app.inject({ method: 'GET', url: '/api/auth/login/github' });
    const state = new URL(String(login.headers.location)).searchParams.get('state');
    const res = await app.inject({
      method: 'GET',
      url: `/api/auth/callback/gitlab?code=abc&state=${state}`,
      headers: { cookie: String(login.headers['set-cookie']).split(';')[0] as string },
    });
    expect(res.headers.location).toBe(`${WEB}/login?error=state`);
  });

  it('handles a provider error (user pressed cancel)', async () => {
    app = await makeOAuthApp();
    const { location, session } = await signIn(app, 'github', { query: 'error=access_denied' });
    // Without a matching state the callback fails closed before looking at the error.
    expect(location).toBe(`${WEB}/login?error=state`);
    expect(session).toBeUndefined();

    const login = await app.inject({ method: 'GET', url: '/api/auth/login/github' });
    const state = new URL(String(login.headers.location)).searchParams.get('state');
    const res = await app.inject({
      method: 'GET',
      url: `/api/auth/callback/github?error=access_denied&state=${state}`,
      headers: { cookie: String(login.headers['set-cookie']).split(';')[0] as string },
    });
    expect(res.headers.location).toBe(`${WEB}/login?error=provider`);
  });

  it('handles the provider refusing the code exchange', async () => {
    const fake = fakeProviders({ tokenResponse: { body: { error: 'bad_verification_code' } } });
    app = await makeOAuthApp({}, fake.fetchFn);
    const { location, session } = await signIn(app);
    expect(location).toBe(`${WEB}/login?error=provider`);
    expect(session).toBeUndefined();
  });

  it('handles the provider being down', async () => {
    const fake = fakeProviders({ tokenResponse: { status: 503, body: {} } });
    app = await makeOAuthApp({}, fake.fetchFn);
    expect((await signIn(app)).location).toBe(`${WEB}/login?error=provider`);
  });

  it('shows access denied to a user who is not on the allowlist', async () => {
    const fake = fakeProviders({ githubUser: { id: 9, login: 'stranger', email: null } });
    app = await makeOAuthApp({}, fake.fetchFn);
    const { location, session } = await signIn(app);
    expect(location).toBe(`${WEB}/access-denied`);
    expect(session).toBeUndefined();
    expect(await prisma().user.count()).toBe(0);
  });

  it('falls back to the verified primary email when the profile hides it', async () => {
    const base = fakeProviders({ githubUser: { id: 1, login: 'octocat', email: null } });
    const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input : input.url,
      );
      if (url.pathname === '/user/emails') {
        return new Response(
          JSON.stringify([
            { email: 'old@example.com', primary: false, verified: true },
            { email: 'main@example.com', primary: true, verified: true },
          ]),
        );
      }
      return base.fetchFn(input, init);
    }) as typeof fetch;
    app = await makeOAuthApp({ AUTH_ALLOWED_USERS: 'main@example.com' }, fetchFn);
    expect((await signIn(app)).location).toBe(`${WEB}/`);
    expect((await prisma().user.findFirstOrThrow()).email).toBe('main@example.com');
  });
});

describe('org and group membership', () => {
  const stranger = { id: 9, login: 'stranger', email: null };

  it('allows an active member of the GitHub org', async () => {
    const fake = fakeProviders({
      githubUser: stranger,
      orgMembership: { body: { state: 'active' } },
    });
    app = await makeOAuthApp({ AUTH_ALLOWED_GITHUB_ORG: 'acme' }, fake.fetchFn);
    expect((await signIn(app)).location).toBe(`${WEB}/`);
    expect(fake.urls.some((u) => u.endsWith('/user/memberships/orgs/acme'))).toBe(true);
  });

  it('denies a non-member and a pending invitation', async () => {
    for (const orgMembership of [
      { status: 404, body: {} },
      { status: 403, body: {} },
      { body: { state: 'pending' } },
    ]) {
      const fake = fakeProviders({ githubUser: stranger, orgMembership });
      app = await makeOAuthApp({ AUTH_ALLOWED_GITHUB_ORG: 'acme' }, fake.fetchFn);
      expect((await signIn(app)).location).toBe(`${WEB}/access-denied`);
      await app.close();
    }
    app = undefined;
  });

  it('allows a member of the GitLab group (URL-encoded full path)', async () => {
    const fake = fakeProviders({
      gitlabUser: { id: 7, username: 'newbie', email: null },
      groupMembership: { body: { state: 'active', access_level: 30 } },
    });
    app = await makeOAuthApp({ AUTH_ALLOWED_GITLAB_GROUP: 'acme/team' }, fake.fetchFn);
    expect((await signIn(app, 'gitlab')).location).toBe(`${WEB}/`);
    expect(fake.urls.some((u) => u.includes('/groups/acme%2Fteam/members/all/7'))).toBe(true);
  });

  it('denies someone outside the GitLab group', async () => {
    const fake = fakeProviders({ gitlabUser: { id: 7, username: 'newbie', email: null } });
    app = await makeOAuthApp({ AUTH_ALLOWED_GITLAB_GROUP: 'acme/team' }, fake.fetchFn);
    expect((await signIn(app, 'gitlab')).location).toBe(`${WEB}/access-denied`);
  });

  it('skips the membership call for people already on the list', async () => {
    const fake = fakeProviders();
    app = await makeOAuthApp({ AUTH_ALLOWED_GITHUB_ORG: 'acme' }, fake.fetchFn);
    await signIn(app);
    expect(fake.urls.some((u) => u.includes('/memberships/'))).toBe(false);
  });
});

describe('roles and disabled accounts', () => {
  it('makes AUTH_ADMINS admins on first login only', async () => {
    app = await makeOAuthApp({ AUTH_ADMINS: 'OctoCat' });
    await signIn(app);
    expect((await prisma().user.findFirstOrThrow()).role).toBe('ADMIN');
    await prisma().user.updateMany({ data: { role: 'MEMBER' } });
    await signIn(app);
    expect((await prisma().user.findFirstOrThrow()).role).toBe('MEMBER');
  });

  it('refuses a disabled user at login', async () => {
    app = await makeOAuthApp();
    await signIn(app);
    await prisma().user.updateMany({ data: { disabledAt: new Date() } });
    const { location, session } = await signIn(app);
    expect(location).toBe(`${WEB}/access-denied`);
    expect(session).toBeUndefined();
  });

  it('rotates the session token on login', async () => {
    app = await makeOAuthApp();
    const first = await signIn(app);
    const login = await app.inject({ method: 'GET', url: '/api/auth/login/github' });
    const state = new URL(String(login.headers.location)).searchParams.get('state');
    const cb = await app.inject({
      method: 'GET',
      url: `/api/auth/callback/github?code=abc&state=${state}`,
      headers: {
        cookie: `${String(login.headers['set-cookie']).split(';')[0]}; ${first.session}`,
      },
    });
    const second = String(
      [cb.headers['set-cookie']].flat().find((c) => String(c).startsWith('mrdash_sid=')),
    );
    expect(second.split(';')[0]).not.toBe(first.session);
    expect(await prisma().session.count()).toBe(1);
    const old = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: first.session as string },
    });
    expect(old.statusCode).toBe(401);
  });
});
