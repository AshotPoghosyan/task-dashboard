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

describe('sign-in configuration', () => {
  const base = { DATABASE_URL: 'postgresql://x', SESSION_SECRET: 'x'.repeat(32) };
  const github = { GITHUB_OAUTH_CLIENT_ID: 'id', GITHUB_OAUTH_CLIENT_SECRET: 'secret' };

  it('defaults to password mode, and to oauth when a provider is configured', async () => {
    const { resolveAuthMode } = await import('./authConfig.js');
    expect(resolveAuthMode(loadEnv(base))).toBe('password');
    const env = loadEnv({ ...base, ...github, AUTH_ALLOWED_USERS: 'ann' });
    expect(resolveAuthMode(env)).toBe('oauth');
  });

  it('only enables a provider when both its client ID and secret are set', async () => {
    const { configuredProviders } = await import('./authConfig.js');
    const env = loadEnv({ ...base, GITHUB_OAUTH_CLIENT_ID: 'id', AUTH_MODE: 'password' });
    expect(configuredProviders(env)).toEqual([]);
  });

  it('refuses to start with OAuth on and no allowlist', () => {
    expect(() => loadEnv({ ...base, ...github })).toThrow(/allowlist/);
  });

  it.each([
    { AUTH_ALLOWED_USERS: 'ann' },
    { AUTH_ALLOWED_GITHUB_ORG: 'acme' },
    { AUTH_ALLOWED_GITLAB_GROUP: 'acme/team' },
    { AUTH_ADMINS: 'ann' },
  ])('accepts %o as the allowlist', (allow) => {
    expect(() => loadEnv({ ...base, ...github, ...allow })).not.toThrow();
  });

  it('refuses oauth or both without a provider, and both without a password', () => {
    expect(() => loadEnv({ ...base, AUTH_MODE: 'oauth', AUTH_ALLOWED_USERS: 'a' })).toThrow(
      /provider/,
    );
    const ok = { ...base, ...github, AUTH_ALLOWED_USERS: 'a' };
    expect(() => loadEnv({ ...ok, AUTH_MODE: 'both' })).toThrow(/DASHBOARD_PASSWORD/);
    expect(() => loadEnv({ ...ok, AUTH_MODE: 'both', DASHBOARD_PASSWORD: 'pw' })).not.toThrow();
  });

  it('needs a strong SESSION_SECRET for OAuth too', () => {
    expect(() =>
      loadEnv({ ...base, ...github, AUTH_ALLOWED_USERS: 'a', SESSION_SECRET: 'short' }),
    ).toThrow(/SESSION_SECRET/);
  });

  it('never starts with the test-only login helper in production', () => {
    const ok = { ...base, ...github, AUTH_ALLOWED_USERS: 'a', AUTH_TEST_HELPER: 'true' };
    expect(() => loadEnv({ ...ok, NODE_ENV: 'test' })).not.toThrow();
    expect(() => loadEnv({ ...ok, NODE_ENV: 'production' })).toThrow(/AUTH_TEST_HELPER/);
    expect(() => loadEnv({ ...ok, NODE_ENV: 'production', AUTH_TEST_HELPER: 'false' })).toThrow(
      /AUTH_TEST_HELPER/,
    );
  });

  it('only allows the helper when OAuth sign-in is on', () => {
    expect(() => loadEnv({ ...base, AUTH_TEST_HELPER: 'true' })).toThrow(/AUTH_TEST_HELPER/);
  });
});
