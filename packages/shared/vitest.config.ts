import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts'],
      thresholds: {
        lines: 80,
        // Status rules are the core business logic: keep them fully covered.
        'src/status/**/*.ts': { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
});
