/* Lighthouse (desktop) for both pages. Needs the servers from `pnpm e2e` or `pnpm start`/`preview`
 * running and the large seed loaded. Usage: DASHBOARD_PASSWORD=... pnpm lighthouse */
import { chromium } from '@playwright/test';
import { launch } from 'chrome-launcher';
import lighthouse, { desktopConfig } from 'lighthouse';

const WEB = process.env.WEB_URL ?? 'http://localhost:4173';
const PASSWORD = process.env.DASHBOARD_PASSWORD ?? '';
const MIN = 90;

let cookie = '';
if (PASSWORD) {
  const res = await fetch(`${WEB}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  cookie = (res.headers.getSetCookie()[0] ?? '').split(';')[0];
}

const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox'],
});
let failed = false;
for (const path of ['/', '/merge-requests']) {
  const { lhr } = await lighthouse(
    `${WEB}${path}`,
    {
      port: chrome.port,
      output: 'json',
      onlyCategories: ['performance', 'accessibility'],
      extraHeaders: cookie ? { Cookie: cookie } : undefined,
    },
    desktopConfig,
  );
  const perf = Math.round((lhr.categories.performance?.score ?? 0) * 100);
  const a11y = Math.round((lhr.categories.accessibility?.score ?? 0) * 100);
  const a = lhr.audits;
  failed ||= perf < MIN || a11y < MIN;
  process.stdout.write(
    `${path.padEnd(16)} performance=${perf} accessibility=${a11y} ` +
      `FCP=${a['first-contentful-paint']?.displayValue} LCP=${a['largest-contentful-paint']?.displayValue} ` +
      `TBT=${a['total-blocking-time']?.displayValue} CLS=${a['cumulative-layout-shift']?.displayValue}\n`,
  );
}
await chrome.kill();
process.exitCode = failed ? 1 : 0;
