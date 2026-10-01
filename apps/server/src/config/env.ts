import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// Empty strings (as in .env.example) are treated as "not set".
const optional = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_TEST: optional,
  APP_TIMEZONE: z.string().default('UTC'),
  SESSION_SECRET: optional,
  DASHBOARD_PASSWORD: optional,
  GITLAB_BASE_URL: z.string().url().default('https://gitlab.com'),
  GITLAB_TOKEN: optional,
  GITLAB_WEBHOOK_SECRET: optional,
  GITHUB_TOKEN: optional,
  GITHUB_WEBHOOK_SECRET: optional,
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(5),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  return result.data;
}

/** Loads the repo-root .env (if present) without overriding real env vars, then validates. */
export function loadEnv(): Env {
  const file = resolve(process.cwd(), '../../.env');
  if (existsSync(file)) process.loadEnvFile(file);
  return parseEnv(process.env);
}
