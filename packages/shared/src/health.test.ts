import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('accepts a valid payload', () => {
    expect(healthResponseSchema.parse({ status: 'ok', db: 'up', uptime: 1.5 })).toEqual({
      status: 'ok',
      db: 'up',
      uptime: 1.5,
    });
  });

  it('rejects an unknown status', () => {
    expect(healthResponseSchema.safeParse({ status: 'nope', db: 'up', uptime: 1 }).success).toBe(
      false,
    );
  });
});
