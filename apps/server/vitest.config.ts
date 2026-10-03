import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./src/test/globalSetup.ts'],
    setupFiles: ['./src/test/setupEnv.ts'],
    // DB tests share one Postgres database and truncate it, so files run serially.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/services/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: { lines: 80 },
    },
  },
});
