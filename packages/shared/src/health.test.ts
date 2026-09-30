import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('accepts a valid payload', () => {
    expect(healthResponseSchema.parse({ status: 'ok', db: 'up', uptimeSeconds: 1 }).db).toBe('up');
  });

  it('rejects an unknown status', () => {
    expect(
      healthResponseSchema.safeParse({ status: 'x', db: 'up', uptimeSeconds: 1 }).success,
    ).toBe(false);
  });
});
