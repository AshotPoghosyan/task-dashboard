import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./src/test/globalSetup.ts'],
    // DB tests share one Postgres database and truncate it, so files run serially.
    fileParallelism: false,
  },
});
