import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

test.describe('Tasks page', () => {
  test('passes axe checks', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('row').nth(1)).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('filters by status tab and searches', async ({ page }) => {
    await page.goto('/');
    const rows = page.getByRole('treegrid', { name: 'Tasks' }).getByRole('row');
    await expect(rows.nth(1)).toBeVisible();

    const merged = page.waitForResponse(
      (r) => /\/api\/tasks\?/.test(r.url()) && r.url().includes('status=MERGED'),
    );
    await page.getByRole('tab', { name: /^Merged/ }).click();
    await merged;
    await expect(page).toHaveURL(/tab=merged/);
    await expect(page.getByRole('tab', { name: /^Merged/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.getByLabel('Search', { exact: true }).fill('zzz-no-such-task');
    await expect(page).toHaveURL(/q=zzz-no-such-task/);
    await expect(page.getByText('No tasks match')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Active filters' })).toBeVisible();

    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page).not.toHaveURL(/q=/);
    await page.getByRole('tab', { name: /^All/ }).click();
    await expect(rows.nth(1)).toBeVisible();
    await expect(page).not.toHaveURL(/tab=|q=/);
  });

  test('expands sub-bugs', async ({ page }) => {
    await page.goto('/');
    const table = page.getByRole('treegrid', { name: 'Tasks' });
    const expand = table.getByRole('button', { name: /^Expand / }).first();
    await expect(expand).toBeVisible();
    await expect(page.locator('tr[aria-level="2"]')).toHaveCount(0);
    await expand.click();
    await expect(page.locator('tr[aria-level="2"]').first()).toBeVisible();
    await table
      .getByRole('button', { name: /^Collapse / })
      .first()
      .click();
    await expect(page.locator('tr[aria-level="2"]')).toHaveCount(0);
  });

  test('creates a task and edits its notes', async ({ page }) => {
    const title = `E2E task ${Date.now()}`;
    await page.goto('/');
    await page.getByRole('button', { name: 'New task' }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Assignee').fill('E2E Tester');
    await page.getByRole('button', { name: 'Create task' }).click();

    await page.getByLabel('Search', { exact: true }).fill(title);
    const row = page.getByRole('row', { name: new RegExp(title) });
    await expect(row).toBeVisible();

    await row.click();
    const notes = page.getByLabel('Notes');
    await expect(notes).toBeVisible();
    const saved = page.waitForResponse(
      (r) => r.url().includes('/api/tasks/') && r.request().method() === 'PATCH' && r.ok(),
    );
    await notes.fill('Written by the E2E suite');
    await saved;
    await expect(page.getByText('Saved automatically')).toBeVisible();

    // The note survives a reload.
    await page.reload();
    await page.getByRole('row', { name: new RegExp(title) }).click();
    await expect(page.getByLabel('Notes')).toHaveValue('Written by the E2E suite');
  });
});
