/* Sums the gzip size of every JS file the browser loads on first paint of each page.
 * Needs the preview server (and API) running. Usage: DASHBOARD_PASSWORD=... node scripts/initial-js.mjs */
import { chromium } from '@playwright/test';
import { gzipSync } from 'node:zlib';

const WEB = process.env.WEB_URL ?? 'http://localhost:4173';
const BUDGET_KB = 200;
const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: WEB });
const login = await context.request.post('/api/auth/login', {
  data: { password: process.env.DASHBOARD_PASSWORD ?? '' },
});
if (!login.ok() && process.env.DASHBOARD_PASSWORD) throw new Error('login failed');
let failed = false;
for (const path of ['/', '/merge-requests']) {
  const page = await context.newPage();
  const sizes = new Map();
  page.on('response', async (res) => {
    if (res.request().resourceType() !== 'script') return;
    sizes.set(res.url(), gzipSync(await res.body()).length);
  });
  await page.goto(path, { waitUntil: 'networkidle' });
  const kb = [...sizes.values()].reduce((a, b) => a + b, 0) / 1024;
  failed ||= kb >= BUDGET_KB;
  process.stdout.write(`${path.padEnd(16)} ${sizes.size} scripts, ${kb.toFixed(1)} KB gzip\n`);
  await page.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;
