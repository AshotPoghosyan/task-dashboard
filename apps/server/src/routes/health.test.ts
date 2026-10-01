import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { healthResponseSchema } from '@mrdash/shared';
import { buildApp } from '../app.js';
import { parseEnv } from '../config/env.js';
import type { Database } from '../db/pool.js';

const env = parseEnv({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/mrdash',
});

let app: FastifyInstance;
afterEach(async () => {
  await app.close();
});

describe('GET /api/health', () => {
  it('returns 200 with db up against the real database', async () => {
    app = await buildApp({ env });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(healthResponseSchema.parse(res.json())).toMatchObject({ status: 'ok', db: 'up' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('returns 503 when the database is unreachable', async () => {
    const down: Database = { ping: async () => false, close: async () => undefined };
    app = await buildApp({ env, db: down });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'degraded', db: 'down' });
  });

  it('returns a structured 404 for unknown routes', async () => {
    app = await buildApp({ env });
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});
