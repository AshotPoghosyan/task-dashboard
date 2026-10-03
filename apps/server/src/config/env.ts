import { z } from 'zod';

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
    GITLAB_BASE_URL: z.string().url().default('https://gitlab.com'),
    GITLAB_TOKEN: z.string().default(''),
    GITLAB_WEBHOOK_SECRET: z.string().default(''),
    GITHUB_TOKEN: z.string().default(''),
    GITHUB_WEBHOOK_SECRET: z.string().default(''),
    SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(5),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((env, ctx) => {
    if (env.DASHBOARD_PASSWORD && env.SESSION_SECRET.length < 16) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: 'must be at least 16 characters when DASHBOARD_PASSWORD is set',
      });
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
