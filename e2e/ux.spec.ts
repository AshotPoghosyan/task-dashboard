import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { expectNoA11yViolations } from './helpers';

const SHOTS = 'docs/screenshots';

interface Reason {
  kind: 'REVIEW_REQUESTED' | 'CHANGES_REQUESTED' | 'NO_REVIEWER' | 'STALE';
  days?: number;
}
/** What the chip should say. Written out here on purpose: the test checks the UI against the spec's wording. */
const chipText = (r: Reason) =>
  ({
    REVIEW_REQUESTED: 'Waiting for your review',
    CHANGES_REQUESTED: 'Changes requested',
    NO_REVIEWER: 'No reviewer',
    STALE: `Stale ${r.days}d`,
  })[r.kind];
const PAGES = [
  { name: 'tasks', path: '/', table: { role: 'treegrid', name: 'Tasks' } },
  {
    name: 'merge-requests',
    path: '/merge-requests?tab=all',
    table: { role: 'table', name: 'Merge requests' },
  },
] as const;

/** No scrollbar-causing overflow anywhere that scrolls the page sideways. */
async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const over = (el: Element | null) => (el ? el.scrollWidth - el.clientWidth : 0);
    return {
      document: over(document.documentElement),
      main: over(document.querySelector('main')),
      tables: Array.from(document.querySelectorAll('[role="table"], [role="treegrid"]')).map((t) =>
        over(t.parentElement),
      ),
    };
  });
  expect(overflow.document).toBeLessThanOrEqual(0);
  expect(overflow.main).toBeLessThanOrEqual(0);
  expect(overflow.tables.every((n) => n <= 0)).toBe(true);
}

/** Header labels sit side by side: none may overlap its neighbour. */
async function expectHeadersDoNotOverlap(page: Page): Promise<void> {
  const boxes = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="columnheader"]'))
      .filter((h) => (h as HTMLElement).offsetParent !== null)
      .map((h) => {
        const r = h.getBoundingClientRect();
        return { left: r.left, right: r.right };
      }),
  );
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i]!.left).toBeGreaterThanOrEqual(boxes[i - 1]!.right - 0.5);
  }
}

mkdirSync(SHOTS, { recursive: true });

for (const scheme of ['light', 'dark'] as const) {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 375, height: 812 },
  ]) {
    test.describe(`${scheme} theme at ${viewport.width}px`, () => {
      test.use({ colorScheme: scheme, viewport });

      for (const p of PAGES) {
        test(`${p.name}: no overflow, axe passes, screenshot`, async ({ page }) => {
          await page.goto(p.path);
          await expect(page.getByRole(p.table.role, { name: p.table.name })).toBeVisible();
          await expect(page.getByRole('row').nth(1)).toBeVisible();
          await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);

          await expectNoHorizontalScroll(page);
          await expectHeadersDoNotOverlap(page);
          await expectNoA11yViolations(page);
          // No avatar ever shows its alt text, and there is one sync indicator, in the top bar.
          await expect(page.locator('main img[alt]:not([alt=""])')).toHaveCount(0);
          await expect(page.getByText(/Synced|Not synced yet/)).toHaveCount(1);
          await expect(page.locator('main').getByRole('button', { name: 'Sync now' })).toHaveCount(
            0,
          );

          await page.screenshot({ path: `${SHOTS}/${p.name}-${scheme}-${viewport.width}.png` });
        });
      }
    });
  }
}

test.describe('Needs attention', () => {
  test('is the default tab and its reasons match the data', async ({ page }) => {
    await page.goto('/merge-requests');
    const tab = page.getByRole('tab', { name: /^Needs attention/ });
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page).not.toHaveURL(/tab=/);

    const res = await page.request.get('/api/merge-requests?view=attention&limit=30');
    const { items } = (await res.json()) as {
      items: { title: string; reasons: Reason[] }[];
    };
    expect(items.length).toBeGreaterThan(0);
    // No person is known in password mode, so only these two rules can apply, in this order.
    const kinds = items.map((i) => i.reasons[0]!.kind);
    expect(kinds.every((k) => k === 'NO_REVIEWER' || k === 'STALE')).toBe(true);
    expect(kinds).toEqual([...kinds].sort((a, b) => (a === b ? 0 : a === 'NO_REVIEWER' ? -1 : 1)));

    const table = page.getByRole('table', { name: 'Merge requests' });
    await expect(table.getByRole('row').nth(1)).toBeVisible();
    const first = items[0]!;
    const row = table.getByRole('row').filter({ hasText: first.title }).first();
    for (const reason of first.reasons) {
      // The title cell comes first, so `.first()` is the chip (an empty reviewers cell also says "No reviewer" to screen readers).
      await expect(row.getByText(chipText(reason), { exact: true }).first()).toBeVisible();
    }

    const counts = (await (await page.request.get('/api/merge-requests/counts')).json()) as {
      attention: number;
    };
    await expect(tab).toContainText(String(counts.attention));
  });

  test('"Only mine" asks who you are, remembers it, and narrows the list', async ({ page }) => {
    await page.goto('/merge-requests?tab=all');
    await expect(page.getByRole('row').nth(1)).toBeVisible();

    await page.getByRole('button', { name: 'Only mine' }).click();
    const dialog = page.getByRole('dialog', { name: 'Who are you?' });
    await dialog.getByRole('textbox', { name: 'Search people' }).fill('User 7');
    const mine = page.waitForResponse(
      (r) => /\/api\/merge-requests\?/.test(r.url()) && r.url().includes('mine=1'),
    );
    await dialog.getByRole('button', { name: /^User 7 / }).click();
    const meId = new URL((await mine).url()).searchParams.get('me');
    expect(meId).toBeTruthy();
    await expect(page).toHaveURL(/mine=1/);

    const body = (await (await mine).json()) as {
      items: {
        author: { id: string };
        assignee: { id: string } | null;
        reviewers: { user: { id: string } }[];
      }[];
    };
    expect(body.items.length).toBeGreaterThan(0);
    for (const mr of body.items) {
      const involved =
        mr.author.id === meId ||
        mr.assignee?.id === meId ||
        mr.reviewers.some((r) => r.user.id === meId);
      expect(involved).toBe(true);
    }

    await page.reload();
    await expect(page.getByRole('button', { name: 'Only mine' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Theme', () => {
  test('System follows the OS, and an explicit choice sticks without a flash', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('radio', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Reload: the inline script sets the theme before any app code runs.
    await page.addInitScript(() => {
      new MutationObserver(() => {
        (window as unknown as { __themes: string[] }).__themes ??= [];
        (window as unknown as { __themes: string[] }).__themes.push(
          document.documentElement.dataset.theme ?? '',
        );
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const seen = await page.evaluate(
      () => (window as unknown as { __themes?: string[] }).__themes ?? [],
    );
    expect(seen).not.toContain('dark');
  });
});
