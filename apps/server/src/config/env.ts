import { authModeSchema } from '@mrdash/shared';
import { z } from 'zod';
import {
  configuredProviders,
  hasAllowlist,
  loginRequired,
  oauthEnabled,
  resolveAuthMode,
} from './authConfig.js';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
    DATABASE_URL: z.string().min(1),
    DATABASE_URL_TEST: z.string().optional(),
    APP_TIMEZONE: z.string().default('Asia/Yerevan'),
    SESSION_SECRET: z.string().default(''),
    DASHBOARD_PASSWORD: z.string().default(''),
    /** Unset = `oauth` when a provider is configured, else `password`. */
    AUTH_MODE: authModeSchema.optional(),
    GITHUB_OAUTH_CLIENT_ID: z.string().default(''),
    GITHUB_OAUTH_CLIENT_SECRET: z.string().default(''),
    GITLAB_OAUTH_CLIENT_ID: z.string().default(''),
    GITLAB_OAUTH_CLIENT_SECRET: z.string().default(''),
    /** Comma-separated usernames or emails (optionally `github:name` / `gitlab:name`). */
    AUTH_ALLOWED_USERS: z.string().default(''),
    AUTH_ALLOWED_GITHUB_ORG: z.string().default(''),
    AUTH_ALLOWED_GITLAB_GROUP: z.string().default(''),
    AUTH_ADMINS: z.string().default(''),
    /** Test-only login helper (`POST /api/auth/test-login`). Refused when NODE_ENV=production. */
    AUTH_TEST_HELPER: z.string().default(''),
    GITLAB_BASE_URL: z.string().url().default('https://gitlab.com'),
    GITLAB_TOKEN: z.string().default(''),
    GITLAB_WEBHOOK_SECRET: z.string().default(''),
    GITHUB_TOKEN: z.string().default(''),
    GITHUB_WEBHOOK_SECRET: z.string().default(''),
    SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(5),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    /** Reverse proxies in front of the API whose X-Forwarded-For is trusted (0 = none). */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((env, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const mode = resolveAuthMode(env);
    if (loginRequired(env) && env.SESSION_SECRET.length < 16) {
      issue('SESSION_SECRET', 'must be at least 16 characters when sign-in is enabled');
    }
    if (oauthEnabled(env)) {
      if (configuredProviders(env).length === 0) {
        issue(
          'AUTH_MODE',
          `${mode} needs a provider: set GITHUB_OAUTH_CLIENT_ID/SECRET or GITLAB_OAUTH_CLIENT_ID/SECRET`,
        );
      }
      if (!hasAllowlist(env)) {
        issue(
          'AUTH_ALLOWED_USERS',
          'OAuth sign-in needs an allowlist: set AUTH_ALLOWED_USERS, AUTH_ALLOWED_GITHUB_ORG, AUTH_ALLOWED_GITLAB_GROUP or AUTH_ADMINS',
        );
      }
    }
    if (mode === 'both' && !env.DASHBOARD_PASSWORD) {
      issue('DASHBOARD_PASSWORD', 'is required when AUTH_MODE=both');
    }
    if (env.AUTH_TEST_HELPER) {
      if (env.NODE_ENV === 'production') {
        issue('AUTH_TEST_HELPER', 'must not be set when NODE_ENV=production');
      } else if (!oauthEnabled(env)) {
        issue('AUTH_TEST_HELPER', 'needs OAuth sign-in to be enabled');
      }
    }
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: env.APP_TIMEZONE });
    } catch {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_TIMEZONE'],
        message: 'is not a valid IANA timezone',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Parses and validates env vars; throws a readable error listing every problem. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= loadEnv();
  return cached;
}
