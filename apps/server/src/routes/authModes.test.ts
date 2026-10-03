import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { disconnectPrisma } from '../db/prisma.js';
import { resetDatabase } from '../db/seed/reset.js';
import { prisma } from '../test/factories.js';
import { loginAs, makeOAuthApp } from '../test/oauth.js';

let app: FastifyInstance | undefined;
beforeEach(() => resetDatabase(prisma()));
afterEach(async () => {
  await app?.close();
  app = undefined;
});
afterAll(() => disconnectPrisma());

const passwordLogin = (a: FastifyInstance) =>
  a.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin: 'http://localhost:5173' },
    payload: { password: 'pw' },
  });

describe('AUTH_MODE=both', () => {
  it('accepts either the shared password or a personal account', async () => {
    app = await makeOAuthApp({
      AUTH_MODE: 'both',
      DASHBOARD_PASSWORD: 'pw',
      AUTH_TEST_HELPER: 'true',
    });
    expect((await app.inject({ method: 'GET', url: '/api/tasks' })).statusCode).toBe(401);

    const pw = await passwordLogin(app);
    expect(pw.statusCode).toBe(200);
    const pwCookie = String(pw.headers['set-cookie']).split(';')[0] as string;
    expect(
      (await app.inject({ method: 'GET', url: '/api/tasks', headers: { cookie: pwCookie } }))
        .statusCode,
    ).toBe(200);

    const personal = await loginAs(app, 'ann');
    expect(
      (await app.inject({ method: 'GET', url: '/api/tasks', headers: { cookie: personal } }))
        .statusCode,
    ).toBe(200);
  });

  it('gives a shared-password session no admin rights', async () => {
    app = await makeOAuthApp({ AUTH_MODE: 'both', DASHBOARD_PASSWORD: 'pw' });
    const pw = await passwordLogin(app);
    const cookie = String(pw.headers['set-cookie']).split(';')[0] as string;
    const res = await app.inject({ method: 'GET', url: '/api/users', headers: { cookie } });
    expect(res.statusCode).toBe(403);
    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie },
    });
    expect(session.json()).toEqual({ required: true, authenticated: true });
  });

  it('keeps webhooks and health open', async () => {
    app = await makeOAuthApp({ AUTH_MODE: 'both', DASHBOARD_PASSWORD: 'pw' });
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    const hook = await app.inject({ method: 'POST', url: '/api/webhooks/github', payload: {} });
    expect(hook.json().error.code).toBe('INVALID_SIGNATURE');
  });
});

describe('AUTH_MODE=oauth', () => {
  it('turns the password form off even when a password is set', async () => {
    app = await makeOAuthApp({ DASHBOARD_PASSWORD: 'pw' });
    const res = await passwordLogin(app);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('PASSWORD_LOGIN_DISABLED');
  });

  it('ignores a leftover password cookie', async () => {
    const both = await makeOAuthApp({ AUTH_MODE: 'both', DASHBOARD_PASSWORD: 'pw' });
    const cookie = String((await passwordLogin(both)).headers['set-cookie']).split(';')[0];
    await both.close();
    app = await makeOAuthApp({ DASHBOARD_PASSWORD: 'pw' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/tasks',
      headers: { cookie: cookie as string },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('test-only login helper', () => {
  it('is absent unless AUTH_TEST_HELPER is set', async () => {
    app = await makeOAuthApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/test-login',
      payload: { username: 'ann' },
    });
    expect(res.statusCode).toBe(404);
  });
});
