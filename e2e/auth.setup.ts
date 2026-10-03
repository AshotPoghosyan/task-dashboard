import { expect, test as setup } from '@playwright/test';
import { E2E_PASSWORD } from '../playwright.config';

setup('sign in and store the session', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
  await page.context().storageState({ path: 'e2e/.auth/state.json' });
});
