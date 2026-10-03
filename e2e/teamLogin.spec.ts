import { expect, test, type Browser } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

const WEB = 'http://localhost:4173';

/** A browser context signed in as `username` through the test-only login helper. */
async function signInAs(browser: Browser, username: string, role: 'ADMIN' | 'MEMBER') {
  // Empty storage: the project default is the shared-password session, which would mask the test.
  const context = await browser.newContext({
    baseURL: WEB,
    storageState: { cookies: [], origins: [] },
  });
  const res = await context.request.post('/api/auth/test-login', {
    data: { username, role },
    headers: { origin: WEB },
  });
  expect(res.ok()).toBe(true);
  return context;
}

test('personal sign-in shows your name; an admin disables a user and their next request fails', async ({
  browser,
}) => {
  const stamp = Date.now();
  const admin = `e2e-admin-${stamp}`;
  const member = `e2e-member-${stamp}`;
  const adminCtx = await signInAs(browser, admin, 'ADMIN');
  const memberCtx = await signInAs(browser, member, 'MEMBER');

  const memberPage = await memberCtx.newPage();
  await memberPage.goto('/');
  await expect(
    memberPage.getByRole('button', { name: `Account menu for ${member}` }),
  ).toBeVisible();
  // Members never see the admin entry, and the page itself refuses them.
  await expect(memberPage.getByRole('link', { name: 'Users' })).toHaveCount(0);
  await memberPage.goto('/settings/users');
  await expect(memberPage.getByText('Admins only')).toBeVisible();
  expect((await memberCtx.request.get('/api/users')).status()).toBe(403);

  const adminPage = await adminCtx.newPage();
  await adminPage.goto('/');
  await expect(adminPage.getByRole('button', { name: `Account menu for ${admin}` })).toBeVisible();
  await adminPage.getByRole('link', { name: 'Users' }).first().click();
  await expect(adminPage.getByRole('heading', { name: 'Users' })).toBeVisible();
  await expect(adminPage.getByText(`@${member}`)).toBeVisible();
  await expectNoA11yViolations(adminPage);

  await adminPage.getByRole('button', { name: `Disable ${member}` }).click();
  await expect(adminPage.getByRole('dialog')).toContainText(`Disable ${member}?`);
  await adminPage.getByRole('button', { name: 'Disable', exact: true }).click();
  const row = adminPage.getByRole('row', { name: new RegExp(member) });
  await expect(row.getByText('Disabled')).toBeVisible();

  // The member's very next request is rejected, and a reload lands on the login page.
  expect((await memberCtx.request.get('/api/tasks')).status()).toBe(401);
  await memberPage.reload();
  await expect(memberPage).toHaveURL(/\/login$/);

  await adminCtx.close();
  await memberCtx.close();
});

test('signing out ends the session', async ({ browser }) => {
  const name = `e2e-signout-${Date.now()}`;
  const ctx = await signInAs(browser, name, 'MEMBER');
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: `Account menu for ${name}` }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await ctx.request.get('/api/tasks')).status()).toBe(401);
  await ctx.close();
});
