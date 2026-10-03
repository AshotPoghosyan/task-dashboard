import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, sendGitHubPrWebhook } from './helpers';

test.describe('Merge requests page', () => {
  test('passes axe checks', async ({ page }) => {
    await page.goto('/merge-requests');
    await expect(page.getByRole('table', { name: 'Merge requests' })).toBeVisible();
    await expect(page.getByRole('row').nth(1)).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('filters by status and loads more rows on scroll', async ({ page }) => {
    await page.goto('/merge-requests');
    const table = page.getByRole('table', { name: 'Merge requests' });
    await expect(table.getByRole('row').nth(1)).toBeVisible();

    const pages: string[] = [];
    page.on('request', (r) => {
      if (/\/api\/merge-requests\?/.test(r.url()) && r.url().includes('cursor=')) {
        pages.push(r.url());
      }
    });
    // Scroll the virtualized table's scroll container until the next page is requested.
    await expect
      .poll(
        async () => {
          await table.evaluate((el) => {
            for (let n: Element | null = el; n; n = n.parentElement) {
              if (n.scrollHeight > n.clientHeight + 1) n.scrollTop = n.scrollHeight;
            }
          });
          return pages.length;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    const filtered = page.waitForResponse(
      (r) => /\/api\/merge-requests\?/.test(r.url()) && r.url().includes('status=MERGED'),
    );
    await page.getByRole('button', { name: /^Status/ }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Merged' }).click();
    await page.keyboard.press('Escape');
    const body = (await (await filtered).json()) as { items: { status: string }[] };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((i) => i.status === 'MERGED')).toBe(true);
    await expect(page).toHaveURL(/status=MERGED/);
    await expect(table.getByRole('row').nth(1)).toBeVisible();
  });

  test('a webhook delivery appears live without reloading', async ({ page }) => {
    const title = `E2E live webhook ${Date.now()}`;
    await page.goto(`/merge-requests?q=${encodeURIComponent(title)}`);
    await expect(page.getByText(/No merge requests/i)).toBeVisible();

    const number = 50_000 + (Date.now() % 40_000);
    expect(await sendGitHubPrWebhook({ number, title })).toBe(202);

    await expect(page.getByRole('row', { name: new RegExp(title) })).toBeVisible({
      timeout: 15_000,
    });
  });
});
