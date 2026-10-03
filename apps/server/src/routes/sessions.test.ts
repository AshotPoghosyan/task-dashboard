import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { disconnectPrisma } from '../db/prisma.js';
import { resetDatabase } from '../db/seed/reset.js';
import { purgeExpiredSessions } from '../services/sessionService.js';
import { prisma } from '../test/factories.js';
import { loginAs, makeOAuthApp } from '../test/oauth.js';

let app: FastifyInstance;
beforeEach(async () => {
  await resetDatabase(prisma());
  app = await makeOAuthApp({ AUTH_TEST_HELPER: 'true' });
});
afterEach(() => app.close());
afterAll(() => disconnectPrisma());

const get = (url: string, cookie?: string) =>
  app.inject({ method: 'GET', url, ...(cookie && { headers: { cookie } }) });

describe('sessions', () => {
  it('requires a session for the API once OAuth is on', async () => {
    expect((await get('/api/tasks')).statusCode).toBe(401);
    const cookie = await loginAs(app, 'ann');
    expect((await get('/api/tasks', cookie)).statusCode).toBe(200);
  });

  it('issues a signed, httpOnly, lax cookie; tampering is rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/test-login',
      payload: { username: 'ann' },
    });
    const header = String(res.headers['set-cookie']);
    expect(header).toMatch(/HttpOnly/);
    expect(header).toMatch(/SameSite=Lax/);
    expect(header).toMatch(/Max-Age=1209600/);
    const cookie = header.split(';')[0] as string;
    const [name, value] = cookie.split('=') as [string, string];
    const [token] = value.split('.') as [string];
    expect((await get('/api/tasks', `${name}=${token}.AAAA`)).statusCode).toBe(401);
    expect((await get('/api/tasks', `${name}=${token}`)).statusCode).toBe(401);
  });

  it('stores only a SHA-256 hash of the token', async () => {
    const cookie = await loginAs(app, 'ann');
    const token = cookie.split('=')[1]?.split('.')[0] as string;
    const row = await prisma().session.findFirstOrThrow();
    expect(row.tokenHash).not.toContain(token);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('expires after the 14-day window', async () => {
    const cookie = await loginAs(app, 'ann');
    await prisma().session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await get('/api/tasks', cookie)).statusCode).toBe(401);
    expect(await prisma().session.count()).toBe(0);
  });

  it('renews the expiry as the user keeps working (sliding window)', async () => {
    const cookie = await loginAs(app, 'ann');
    const old = new Date(Date.now() - 3 * 86_400_000);
    await prisma().session.updateMany({
      data: { lastSeenAt: old, expiresAt: new Date(Date.now() + 86_400_000) },
    });
    const res = await get('/api/tasks', cookie);
    expect(res.statusCode).toBe(200);
    expect(String(res.headers['set-cookie'])).toMatch(/Max-Age=1209600/);
    const row = await prisma().session.findFirstOrThrow();
    const days = (row.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(row.lastSeenAt.getTime()).toBeGreaterThan(old.getTime());
  });

  it('does not write on every request', async () => {
    const cookie = await loginAs(app, 'ann');
    const before = await prisma().session.findFirstOrThrow();
    const res = await get('/api/tasks', cookie);
    expect(res.headers['set-cookie']).toBeUndefined();
    const after = await prisma().session.findFirstOrThrow();
    expect(after.lastSeenAt).toEqual(before.lastSeenAt);
  });

  it('logout deletes the session server-side', async () => {
    const cookie = await loginAs(app, 'ann');
    const out = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie, origin: 'http://localhost:5173' },
    });
    expect(out.statusCode).toBe(204);
    expect(await prisma().session.count()).toBe(0);
    // Even a copy of the old cookie no longer works.
    expect((await get('/api/tasks', cookie)).statusCode).toBe(401);
  });

  it('session endpoint reports the user', async () => {
    const cookie = await loginAs(app, 'ann', 'ADMIN');
    const res = await get('/api/auth/session', cookie);
    expect(res.json()).toMatchObject({
      required: true,
      authenticated: true,
      user: { username: 'ann', role: 'ADMIN' },
    });
    expect((await get('/api/auth/session')).json()).toEqual({
      required: true,
      authenticated: false,
    });
  });

  it('the daily job removes only expired sessions', async () => {
    await loginAs(app, 'ann');
    await loginAs(app, 'bob');
    const [first] = await prisma().session.findMany({ orderBy: { createdAt: 'asc' } });
    await prisma().session.update({
      where: { id: first?.id as string },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await purgeExpiredSessions()).toBe(1);
    expect(await prisma().session.count()).toBe(1);
  });

  it('deleting a user removes their sessions and clears task attribution', async () => {
    const cookie = await loginAs(app, 'ann');
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie, origin: 'http://localhost:5173' },
      payload: { title: 'Attributed' },
    });
    expect(created.json().updatedBy).toMatchObject({ displayName: 'ann' });
    await prisma().user.deleteMany();
    expect(await prisma().session.count()).toBe(0);
    const task = await prisma().task.findFirstOrThrow();
    expect(task.updatedById).toBeNull();
  });
});

describe('last edited by', () => {
  it('records the signed-in editor on create, update, and link changes', async () => {
    const ann = await loginAs(app, 'ann');
    const bob = await loginAs(app, 'bob');
    const headers = (cookie: string) => ({ cookie, origin: 'http://localhost:5173' });
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: headers(ann),
      payload: { title: 'T' },
    });
    const id = created.json().id as string;
    expect(created.json().updatedBy.displayName).toBe('ann');
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}`,
      headers: headers(bob),
      payload: { notes: 'hi' },
    });
    expect(patched.json().updatedBy.displayName).toBe('bob');
    expect((await get(`/api/tasks/${id}`, ann)).json().updatedBy.displayName).toBe('bob');
  });
});
