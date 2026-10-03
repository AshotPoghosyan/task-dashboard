import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { disconnectPrisma } from '../db/prisma.js';
import { resetDatabase } from '../db/seed/reset.js';
import { makeApp, prisma } from '../test/factories.js';
import { loginAs, makeOAuthApp } from '../test/oauth.js';

let app: FastifyInstance | undefined;
beforeEach(() => resetDatabase(prisma()));
afterEach(async () => {
  await app?.close();
  app = undefined;
});
afterAll(() => disconnectPrisma());

const ORIGIN = 'http://localhost:5173';

describe('origin check on mutations', () => {
  const create = (a: FastifyInstance, cookie: string, headers: Record<string, string>) =>
    a.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie, ...headers },
      payload: { title: 'x' },
    });

  it('accepts the web origin, or a matching Referer', async () => {
    app = await makeOAuthApp({ AUTH_TEST_HELPER: 'true' });
    const cookie = await loginAs(app, 'ann');
    expect((await create(app, cookie, { origin: ORIGIN })).statusCode).toBe(201);
    expect((await create(app, cookie, { referer: `${ORIGIN}/tasks?x=1` })).statusCode).toBe(201);
  });

  it('rejects a foreign Origin, a foreign Referer, "null", and a missing origin with cookies', async () => {
    app = await makeOAuthApp({ AUTH_TEST_HELPER: 'true' });
    const cookie = await loginAs(app, 'ann');
    for (const headers of [
      { origin: 'https://evil.example' },
      { origin: 'null' },
      { referer: 'https://evil.example/page' },
      { referer: 'not a url' },
      {},
    ]) {
      const res = await create(app, cookie, headers);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('CSRF_ORIGIN');
    }
    expect(await prisma().task.count()).toBe(0);
  });

  it('checks every mutating verb but never GETs', async () => {
    app = await makeOAuthApp({ AUTH_TEST_HELPER: 'true' });
    const cookie = await loginAs(app, 'ann');
    const evil = { cookie, origin: 'https://evil.example' };
    for (const method of ['PATCH', 'DELETE'] as const) {
      const res = await app.inject({ method, url: '/api/tasks/x', headers: evil, payload: {} });
      expect(res.statusCode).toBe(403);
    }
    expect((await app.inject({ method: 'GET', url: '/api/tasks', headers: evil })).statusCode).toBe(
      200,
    );
  });

  it('also protects the shared-password mode and its login form', async () => {
    app = await makeApp({ DASHBOARD_PASSWORD: 'pw', SESSION_SECRET: 'x'.repeat(32) });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: ORIGIN },
      payload: { password: 'pw' },
    });
    expect(login.statusCode).toBe(200);
    const cookie = String(login.headers['set-cookie']).split(';')[0] as string;
    expect((await create(app, cookie, {})).statusCode).toBe(403);
    expect((await create(app, cookie, { origin: 'https://evil.example' })).statusCode).toBe(403);
    expect((await create(app, cookie, { origin: ORIGIN })).statusCode).toBe(201);
  });

  it('lets cookie-less non-browser clients through when no login is required', async () => {
    app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/api/tasks', payload: { title: 'x' } });
    expect(res.statusCode).toBe(201);
  });

  it('exempts signature-verified webhooks, which carry no origin', async () => {
    app = await makeOAuthApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/gitlab',
      headers: { cookie: 'a=b', origin: 'https://gitlab.com' },
      payload: {},
    });
    expect(res.json()).toMatchObject({ error: { code: 'INVALID_SIGNATURE' } });
  });
});
