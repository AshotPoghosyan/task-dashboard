import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { disconnectPrisma } from '../db/prisma.js';
import { resetDatabase } from '../db/seed/reset.js';
import { prisma } from '../test/factories.js';
import { loginAs, makeOAuthApp } from '../test/oauth.js';

let app: FastifyInstance;
beforeEach(async () => {
  await resetDatabase(prisma());
  app = await makeOAuthApp({ AUTH_TEST_HELPER: 'true' });
});
afterEach(() => app.close());
afterAll(() => disconnectPrisma());

const call = (
  method: 'GET' | 'PATCH',
  url: string,
  cookie: string,
  payload?: Record<string, unknown>,
) =>
  app.inject({
    method,
    url,
    headers: { cookie, origin: 'http://localhost:5173' },
    ...(payload && { payload }),
  });

const idOf = async (username: string) =>
  (await prisma().user.findFirstOrThrow({ where: { username } })).id;

describe('authorization', () => {
  it('rejects anonymous callers with 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/users' })).statusCode).toBe(401);
  });

  it('gives members 403 on both admin routes', async () => {
    const member = await loginAs(app, 'mia');
    expect((await call('GET', '/api/users', member)).statusCode).toBe(403);
    const res = await call('PATCH', `/api/users/${await idOf('mia')}`, member, { role: 'ADMIN' });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
    expect((await prisma().user.findFirstOrThrow()).role).toBe('MEMBER');
  });

  it('lets admins list users', async () => {
    const admin = await loginAs(app, 'ada', 'ADMIN');
    await loginAs(app, 'mia');
    const res = await call('GET', '/api/users', admin);
    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((u: { username: string }) => u.username)).toEqual(['ada', 'mia']);
  });
});

describe('managing users', () => {
  it('changes a role', async () => {
    const admin = await loginAs(app, 'ada', 'ADMIN');
    await loginAs(app, 'mia');
    const res = await call('PATCH', `/api/users/${await idOf('mia')}`, admin, { role: 'ADMIN' });
    expect(res.json()).toMatchObject({ username: 'mia', role: 'ADMIN' });
  });

  it('disabling a user ends their sessions immediately; enabling lets them back in', async () => {
    const admin = await loginAs(app, 'ada', 'ADMIN');
    const member = await loginAs(app, 'mia');
    const other = await loginAs(app, 'mia');
    expect((await call('GET', '/api/auth/me', member)).statusCode).toBe(200);

    const res = await call('PATCH', `/api/users/${await idOf('mia')}`, admin, { disabled: true });
    expect(res.json().disabledAt).toBeTruthy();
    for (const cookie of [member, other]) {
      expect((await call('GET', '/api/tasks', cookie)).statusCode).toBe(401);
    }
    expect(await prisma().session.count()).toBe(1);

    // The test helper refuses disabled accounts, like the OAuth callback does.
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/auth/test-login',
      payload: { username: 'mia' },
    });
    expect(blocked.statusCode).toBe(403);

    await call('PATCH', `/api/users/${await idOf('mia')}`, admin, { disabled: false });
    expect((await loginAs(app, 'mia')).length).toBeGreaterThan(0);
  });

  it('404s for an unknown user and 400s for an empty body', async () => {
    const admin = await loginAs(app, 'ada', 'ADMIN');
    expect((await call('PATCH', '/api/users/nope', admin, { role: 'MEMBER' })).statusCode).toBe(
      404,
    );
    expect((await call('PATCH', `/api/users/${await idOf('ada')}`, admin, {})).statusCode).toBe(
      400,
    );
  });
});

describe('last-admin protection', () => {
  it('stops the only admin from demoting or disabling themselves', async () => {
    const admin = await loginAs(app, 'ada', 'ADMIN');
    const id = await idOf('ada');
    for (const body of [{ role: 'MEMBER' }, { disabled: true }]) {
      const res = await call('PATCH', `/api/users/${id}`, admin, body);
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('LAST_ADMIN');
    }
    expect(await prisma().session.count()).toBe(1);
  });

  it('allows it once another active admin exists, but not when the other is disabled', async () => {
    const ada = await loginAs(app, 'ada', 'ADMIN');
    const bo = await loginAs(app, 'bo', 'ADMIN');
    await call('PATCH', `/api/users/${await idOf('bo')}`, ada, { disabled: true });
    const blocked = await call('PATCH', `/api/users/${await idOf('ada')}`, ada, {
      role: 'MEMBER',
    });
    expect(blocked.statusCode).toBe(422);

    await call('PATCH', `/api/users/${await idOf('bo')}`, ada, { disabled: false });
    expect(bo).toBeTruthy();
    const ok = await call('PATCH', `/api/users/${await idOf('ada')}`, ada, { role: 'MEMBER' });
    expect(ok.statusCode).toBe(200);
  });

  it('holds under concurrent demotions of the last two admins', async () => {
    const ada = await loginAs(app, 'ada', 'ADMIN');
    const bo = await loginAs(app, 'bo', 'ADMIN');
    const results = await Promise.all([
      call('PATCH', `/api/users/${await idOf('bo')}`, ada, { role: 'MEMBER' }),
      call('PATCH', `/api/users/${await idOf('ada')}`, bo, { role: 'MEMBER' }),
    ]);
    // Either the lock rejects the loser (422) or it already lost its admin role first (403).
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes[0]).toBe(200);
    expect([403, 422]).toContain(codes[1]);
    expect(await prisma().user.count({ where: { role: 'ADMIN' } })).toBe(1);
  });
});
