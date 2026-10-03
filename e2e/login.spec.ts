import { expect, test } from '@playwright/test';
import { E2E_PASSWORD } from '../playwright.config';
import { expectNoA11yViolations } from './helpers';

test('redirects to login, rejects a wrong password, then signs in', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expectNoA11yViolations(page);

  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Incorrect password.');

  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
});
