import {test, expect, type Page} from '@playwright/test';
import {login, adminReady} from './auth-helpers';

async function values(page: Page) {
  return {
    title: await page.getByLabel('Título', {exact: true}).inputValue(),
    slug: await page.getByLabel('Endereço do trabalho').inputValue(),
    summary: await page.getByLabel('Resumo', {exact: true}).inputValue(),
    description: await page.getByLabel('Contexto e créditos').inputValue()
  };
}
test('bounded probe preserves editor input across delayed JavaScript hydration', async ({page, browser}, testInfo) => {
  await login(page);
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  await context.addCookies(await page.context().cookies());
  let release = () => {};
  const barrier = new Promise<void>(resolve => { release = resolve; });
  let intercepted = 0;
  await context.route('**/_app/immutable/**/*.js', async route => { intercepted++; await barrier; await route.continue(); });
  try {
    const editor = await context.newPage();
    await editor.goto('http://127.0.0.1:4174/admin/trabalhos/novo', {waitUntil: 'commit'});
    await editor.getByLabel('Título', {exact: true}).fill('Teste de carregamento lento');
    await editor.getByLabel('Endereço do trabalho').fill('qa-carregamento-lento');
    await editor.getByLabel('Resumo', {exact: true}).fill('Resumo temporário preenchido antes do JavaScript.');
    await editor.getByLabel('Contexto e créditos').fill('Contexto temporário, sem cliente ou pedido real.');
    const before = await values(editor);
    expect(intercepted).toBeGreaterThan(0);
    release();
    await adminReady(editor);
    const after = await values(editor);
    await testInfo.attach('SSR hydration values', {body: JSON.stringify({before, after, intercepted}, null, 2), contentType: 'application/json'});
    expect(after).toEqual(before);
  } finally { release(); await context.close(); }
});
