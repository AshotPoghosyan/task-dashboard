import { defineConfig, devices } from '@playwright/test';

const WEB_URL = 'http://localhost:4173';
export const E2E_PASSWORD = 'e2e-password';

/** E2E runs against the production builds (`pnpm build` first) and the large seed. */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/globalSetup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  use: { baseURL: WEB_URL, trace: 'retain-on-failure' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/state.json' },
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/, /login\.spec\.ts/],
    },
    // Login runs signed out, in its own project so it never sees the stored session.
    { name: 'login', use: { ...devices['Desktop Chrome'] }, testMatch: /login\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'pnpm --filter @mrdash/server start',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: '4000',
        NODE_ENV: 'test',
        DASHBOARD_PASSWORD: E2E_PASSWORD,
        SESSION_SECRET: process.env.SESSION_SECRET || 'e2e-only-session-secret-0123456789',
        GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET || 'e2e-github-secret',
        RATE_LIMIT_MAX: '1000000',
        LOG_LEVEL: 'warn',
        // Keep real providers from syncing during tests.
        GITLAB_TOKEN: '',
        GITHUB_TOKEN: '',
      },
    },
    {
      command: 'pnpm --filter @mrdash/web preview --port 4173 --strictPort',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
