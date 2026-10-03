/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

const proxy = { '/api': { target: 'http://localhost:4000', changeOrigin: true } };

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // `ANALYZE=1 pnpm --filter @mrdash/web build` writes reports/bundle.html (gzip sizes).
    ...(process.env.ANALYZE
      ? [visualizer({ filename: 'reports/bundle.html', gzipSize: true, template: 'treemap' })]
      : []),
  ],
  server: {
    port: 5173,
    proxy,
  },
  preview: { proxy },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'] },
});
