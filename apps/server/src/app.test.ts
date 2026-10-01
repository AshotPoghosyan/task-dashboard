import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@mrdash/shared';
import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { disconnectPrisma } from './db/prisma.js';

describe('GET /api/health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(loadEnv({ ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'silent' }));
  });

  afterAll(async () => {
    await app.close();
    await disconnectPrisma();
  });

  it('returns 200 with database status and a request id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(healthResponseSchema.parse(res.json()).db).toBe('up');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});
