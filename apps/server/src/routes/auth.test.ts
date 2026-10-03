import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env.js';
import { disconnectPrisma } from '../db/prisma.js';
import { createSessionToken, verifySessionToken } from '../plugins/session.js';
import { makeApp } from '../test/factories.js';

const SECRET = 'x'.repeat(32);
const secured = { DASHBOARD_PASSWORD: 'hunter2', SESSION_SECRET: SECRET };

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});
afterAll(() => disconnectPrisma());

const login = (a: FastifyInstance, password: string) =>
  a.inject({ method: 'POST', url: '/api/auth/login', payload: { password } });

describe('auth disabled (no DASHBOARD_PASSWORD)', () => {
  it('serves the API without a session', async () => {
    app = await makeApp();
    expect((await app.inject({ method: 'GET', url: '/api/tasks' })).statusCode).toBe(200);
    const session = await app.inject({ method: 'GET', url: '/api/auth/session' });
    expect(session.json()).toEqual({ required: false, authenticated: true });
  });
});

describe('auth enabled', () => {
  it('only exempts exact public paths, not look-alike prefixes', async () => {
    app = await makeApp(secured);
    const res = await app.inject({ method: 'GET', url: '/api/health-secrets' });
    expect(res.statusCode).toBe(401);
  });

  it('allows credentialed CORS from the web origin', async () => {
    app = await makeApp(secured);
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects API calls without a session, but keeps health public', async () => {
    app = await makeApp(secured);
    const res = await app.inject({ method: 'GET', url: '/api/tasks' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    const session = await app.inject({ method: 'GET', url: '/api/auth/session' });
    expect(session.json()).toEqual({ required: true, authenticated: false });
  });

  it('rejects a wrong password and malformed body', async () => {
    app = await makeApp(secured);
    const wrong = await login(app, 'nope');
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json().error.code).toBe('INVALID_CREDENTIALS');
    expect(wrong.headers['set-cookie']).toBeUndefined();
    const bad = await app.inject({ method: 'POST', url: '/api/auth/login', payload: {} });
    expect(bad.statusCode).toBe(400);
  });

  it('issues an httpOnly, strict, secure cookie that unlocks the API', async () => {
    app = await makeApp(secured);
    const res = await login(app, 'hunter2');
    expect(res.statusCode).toBe(200);
    const header = String(res.headers['set-cookie']);
    expect(header).toMatch(/HttpOnly/);
    expect(header).toMatch(/SameSite=Strict/);
    expect(header).toMatch(/Secure/);
    const cookie = header.split(';')[0] as string;

    const ok = await app.inject({ method: 'GET', url: '/api/tasks', headers: { cookie } });
    expect(ok.statusCode).toBe(200);
    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie },
    });
    expect(session.json()).toEqual({ required: true, authenticated: true });
  });

  it('rejects tampered cookies and clears on logout', async () => {
    app = await makeApp(secured);
    const forged = `mrdash_session=${createSessionToken('y'.repeat(32))}`;
    expect(
      (await app.inject({ method: 'GET', url: '/api/tasks', headers: { cookie: forged } }))
        .statusCode,
    ).toBe(401);
    const out = await app.inject({ method: 'POST', url: '/api/auth/logout' });
    expect(out.statusCode).toBe(204);
    expect(String(out.headers['set-cookie'])).toMatch(/Max-Age=0/);
  });

  it('leaves webhook paths exempt from the session check', async () => {
    app = await makeApp(secured);
    // The webhook route answers with its own signature error, not the session UNAUTHORIZED.
    const res = await app.inject({ method: 'POST', url: '/api/webhooks/gitlab', payload: {} });
    expect(res.json()).toMatchObject({ error: { code: 'INVALID_SIGNATURE' } });
  });

  it('rate limits login attempts', async () => {
    app = await makeApp(secured);
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await login(app, 'bad')).statusCode);
    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codes[6]).toBe(429);
  });

  it('applies the global rate limit to API routes', async () => {
    app = await makeApp({ RATE_LIMIT_MAX: '3' });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++)
      codes.push((await app.inject({ method: 'GET', url: '/api/repositories' })).statusCode);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
    expect((await app.inject({ method: 'GET', url: '/api/repositories' })).json().error.code).toBe(
      'RATE_LIMITED',
    );
  });
});

describe('behind a reverse proxy', () => {
  it('rate limits per forwarded client IP when TRUST_PROXY_HOPS=1', async () => {
    const proxied = await makeApp({ RATE_LIMIT_MAX: '2', TRUST_PROXY_HOPS: '1' });
    const get = (ip: string) =>
      proxied.inject({
        method: 'GET',
        url: '/api/repositories',
        headers: { 'x-forwarded-for': ip },
      });
    expect((await get('10.0.0.1')).statusCode).toBe(200);
    expect((await get('10.0.0.1')).statusCode).toBe(200);
    expect((await get('10.0.0.1')).statusCode).toBe(429);
    expect((await get('10.0.0.2')).statusCode).toBe(200);
    await proxied.close();
  });
});

describe('proxy trust edges', () => {
  const get = (a: FastifyInstance, xff: string) =>
    a.inject({ method: 'GET', url: '/api/repositories', headers: { 'x-forwarded-for': xff } });

  it('ignores X-Forwarded-For entirely when TRUST_PROXY_HOPS=0', async () => {
    const direct = await makeApp({ RATE_LIMIT_MAX: '2' });
    expect((await get(direct, '10.0.0.1')).statusCode).toBe(200);
    expect((await get(direct, '10.0.0.2')).statusCode).toBe(200);
    expect((await get(direct, '10.0.0.3')).statusCode).toBe(429);
    await direct.close();
  });

  it('cannot be evaded by a client-spoofed leading X-Forwarded-For entry', async () => {
    const proxied = await makeApp({ RATE_LIMIT_MAX: '2', TRUST_PROXY_HOPS: '1' });
    // nginx appends the real peer (10.0.0.9) after whatever the client sent.
    expect((await get(proxied, '1.1.1.1, 10.0.0.9')).statusCode).toBe(200);
    expect((await get(proxied, '2.2.2.2, 10.0.0.9')).statusCode).toBe(200);
    expect((await get(proxied, '3.3.3.3, 10.0.0.9')).statusCode).toBe(429);
    await proxied.close();
  });

  it('rejects a negative TRUST_PROXY_HOPS at boot', () => {
    expect(() => loadEnv({ DATABASE_URL: 'x', TRUST_PROXY_HOPS: '-1' })).toThrow(
      /TRUST_PROXY_HOPS/,
    );
  });
});

describe('session tokens', () => {
  it('expire and reject malformed values', () => {
    const now = 1_000_000;
    const token = createSessionToken(SECRET, now);
    expect(verifySessionToken(SECRET, token, now + 1000)).toBe(true);
    expect(verifySessionToken(SECRET, token, now + 8 * 24 * 3600 * 1000)).toBe(false);
    expect(verifySessionToken(SECRET, 'garbage')).toBe(false);
    expect(verifySessionToken(SECRET, `${token}.extra`)).toBe(false);
    expect(verifySessionToken(SECRET, `${now + 5}.${'a'.repeat(43)}`)).toBe(false);
  });
});
