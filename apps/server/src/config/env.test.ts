import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv({ DATABASE_URL: 'postgresql://x' });
    expect(env.PORT).toBe(4000);
    expect(env.APP_TIMEZONE).toBe('Asia/Yerevan');
  });

  it('fails fast when DATABASE_URL is missing', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('requires a strong SESSION_SECRET when a password is set', () => {
    const base = { DATABASE_URL: 'postgresql://x', DASHBOARD_PASSWORD: 'pw' };
    expect(() => loadEnv({ ...base, SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
    expect(() => loadEnv({ ...base, SESSION_SECRET: 'x'.repeat(16) })).not.toThrow();
  });

  it('rejects an invalid APP_TIMEZONE', () => {
    expect(() => loadEnv({ DATABASE_URL: 'postgresql://x', APP_TIMEZONE: 'Mars/Base' })).toThrow(
      /APP_TIMEZONE/,
    );
  });
});
