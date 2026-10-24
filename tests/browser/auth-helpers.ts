import {expect, type BrowserContext, type Page} from '@playwright/test';

// Reuse the authenticated test session between independent workflows. A logout
// invalidates it server-side; the next call detects the redirect and signs in.
// Cookies and the random password remain in memory and never enter test logs.
let cookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];
export async function adminReady(page: Page) {
  await expect(page.locator('.admin-shell.admin-enhanced')).toBeVisible();
}
export async function login(page: Page) {
  if (cookies.length) {
    await page.context().addCookies(cookies);
    await page.goto('/admin');
    if (new URL(page.url()).pathname === '/admin') { await adminReady(page); return; }
    cookies = [];
  }
  await page.goto('/admin/entrar');
  await page.getByLabel('E-mail', {exact: true}).fill('editor@example.test');
  await page.getByLabel('Senha', {exact: true}).fill(process.env.FRAME_QA_PASSWORD!);
  await page.getByRole('button', {name: 'Entrar no meu espaço', exact: true}).click();
  await expect(page).toHaveURL(/\/admin$/);
  await adminReady(page);
  cookies = await page.context().cookies();
}
