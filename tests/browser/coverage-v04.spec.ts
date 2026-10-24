import {test, expect, type Page, type Locator} from '@playwright/test';
import {login, adminReady} from './auth-helpers';
import {readFileSync} from 'node:fs';

const origin = 'http://127.0.0.1:4174';
async function submit(page: Page, button: Locator) {
  const response = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).origin === origin);
  await button.click();
  await response;
}
async function saveWork(page: Page) {
  await submit(page, page.getByRole('button', {name: 'Salvar trabalho', exact: true}));
  await expect(page.getByRole('status')).toContainText('Trabalho salvo.');
}
async function createWork(page: Page, title: string, slug: string, options: {category?: string; cover?: string; order?: number; published?: boolean} = {}) {
  await page.goto('/admin/trabalhos/novo');
  await adminReady(page);
  await page.getByLabel('Título', {exact: true}).fill(title);
  await page.getByLabel('Endereço do trabalho').fill(slug);
  await page.getByLabel('Resumo', {exact: true}).fill('Conteúdo temporário para verificar o fluxo completo.');
  await page.getByLabel('Contexto e créditos').fill('Demonstração de QA, sem cliente ou audiovisual real.');
  if (options.category) await page.getByLabel('Categoria', {exact: true}).selectOption({label: options.category});
  if (options.cover) await page.getByLabel('Capa', {exact: true}).selectOption({label: options.cover});
  if (options.order !== undefined) await page.getByLabel('Ordem na coleção').fill(String(options.order));
  if (options.published) await page.getByLabel('Visibilidade').selectOption('published');
  await expect(page.getByLabel('Título', {exact: true})).toHaveValue(title);
  await expect(page.getByLabel('Endereço do trabalho')).toHaveValue(slug);
  await expect(page.getByLabel('Resumo', {exact: true})).toHaveValue('Conteúdo temporário para verificar o fluxo completo.');
  await expect(page.getByLabel('Contexto e créditos')).toHaveValue('Demonstração de QA, sem cliente ou audiovisual real.');
  await saveWork(page);
  await expect(page).toHaveURL(/\/admin\/trabalhos\/[a-f0-9-]+\?salvo=1$/);
  return new URL(page.url()).pathname;
}
async function expectPhoto(page: Page) {
  const photo = page.locator('main img').first();
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
}
async function expectFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function loadPhotographs(page: Page) {
  for (const image of await page.locator('img').all()) {
    if (await image.isVisible()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    }
  }
  await page.evaluate(() => scrollTo(0, 0));
}
async function categoryForm(page: Page, slug: string) {
  for (const input of await page.locator('input[name="slug"]').all()) {
    if (await input.inputValue() === slug) {
      const id = await input.getAttribute('id');
      return page.locator('form').filter({has: page.locator(`[id="${id}"]`)});
    }
  }
  throw new Error(`Categoria de teste não encontrada: ${slug}`);
}

test('public photography, detail and forms fit mobile and desktop without page errors', async ({page}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expectPhoto(page);
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('link', {name: 'Ver trabalhos', exact: true}).first().click();
  await expect(page.getByRole('heading', {name: 'Trabalhos', exact: true})).toBeVisible();
  await page.locator('a[href^="/trabalhos/"]').first().click();
  await expectPhoto(page);
  await expect(page.locator('iframe')).toHaveCount(0);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({width, height: 900});
    await expectFits(page);
  }
  for (const path of ['/trabalhos', '/contato', '/admin/entrar']) {
    await page.goto(path);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({width, height: 900});
      await expectFits(page);
    }
  }
  await page.goto('/');
  await loadPhotographs(page);
  await page.screenshot({path: testInfo.outputPath('home-desktop.png'), fullPage: true});
  await page.setViewportSize({width: 390, height: 844});
  await loadPhotographs(page);
  await page.screenshot({path: testInfo.outputPath('home-mobile.png'), fullPage: true});
  expect(errors).toEqual([]);
});

test('reduced-motion photography works without WebGL and without JavaScript', async ({browser}) => {
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({javaScriptEnabled, reducedMotion: 'reduce', viewport: {width: 390, height: 844}});
    try {
      await context.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
          if (/^(webgl|webgl2|experimental-webgl)$/.test(type)) return null;
          return Reflect.apply(getContext, this, [type, ...args]);
        } as typeof HTMLCanvasElement.prototype.getContext;
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin);
      await expectPhoto(page);
      await expect(page.locator('canvas')).toHaveCount(0);
      await expectFits(page);
      await page.getByRole('link', {name: 'Ver trabalhos', exact: true}).first().click();
      await expect(page.getByRole('heading', {name: 'Trabalhos', exact: true})).toBeVisible();
      await page.locator('a[href^="/trabalhos/"]').first().click();
      await expectPhoto(page);
      await expect(page.locator('iframe')).toHaveCount(0);
      await page.goto(`${origin}/contato`);
      await expect(page.getByLabel('Seu nome')).toBeVisible();
      await expectFits(page);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  }
});

test('uploaded cover is private until publication and deletion protects references', async ({page, request}, testInfo) => {
  test.setTimeout(90_000);
  await login(page);
  const suffix = testInfo.project.name;
  const alt = `Capa privacidade ${suffix}`, title = `Trabalho privado ${suffix}`, slug = `qa-upload-${suffix}`;
  await page.goto('/admin/midia');
  await adminReady(page);
  await page.getByLabel('Imagem', {exact: true}).setInputFiles({name: 'entre-planos-small.webp', mimeType: 'image/webp', buffer: readFileSync('static/demo/entre-planos-small.webp')});
  await page.getByLabel('Descrição acessível', {exact: true}).fill(alt);
  await submit(page, page.getByRole('button', {name: 'Adicionar à biblioteca'}));
  await expect(page.getByRole('status')).toContainText('Imagem adicionada');
  const image = page.getByAltText(alt, {exact: true});
  await expect(image).toBeVisible();
  const mediaUrl = (await image.getAttribute('src'))!;
  expect((await request.get(mediaUrl)).status()).toBe(404);
  expect((await page.request.get(mediaUrl)).status()).toBe(200);
  const editorPath = await createWork(page, title, slug, {cover: alt});
  expect((await request.get(`/trabalhos/${slug}`)).status()).toBe(404);
  expect((await request.get(mediaUrl)).status()).toBe(404);
  await page.getByLabel('Visibilidade').selectOption('published');
  await saveWork(page);
  expect((await request.get(`/trabalhos/${slug}`)).status()).toBe(200);
  const publicImage = await request.get(mediaUrl);
  expect(publicImage.status()).toBe(200);
  expect(publicImage.headers()['content-type']).toBe('image/webp');
  expect(publicImage.headers()['cache-control']).toBe('no-store');
  expect(publicImage.headers()['x-content-type-options']).toBe('nosniff');
  await page.goto('/admin/midia');
  page.once('dialog', dialog => dialog.accept());
  await submit(page, page.locator('article').filter({has: page.getByAltText(alt, {exact: true})}).getByRole('button', {name: 'Excluir', exact: true}));
  await expect(page.getByRole('alert')).toContainText('Remova esta imagem');
  await expect(page.getByAltText(alt, {exact: true})).toBeVisible();
  await page.goto(editorPath);
  await page.getByLabel('Visibilidade').selectOption('draft');
  await saveWork(page);
  expect((await request.get(`/trabalhos/${slug}`)).status()).toBe(404);
  expect((await request.get(mediaUrl)).status()).toBe(404);
  await page.goto('/admin/trabalhos');
  page.once('dialog', dialog => dialog.accept());
  await submit(page, page.getByRole('row').filter({has: page.getByText(title, {exact: true})}).getByRole('button', {name: 'Excluir', exact: true}));
  await expect(page.getByRole('status')).toContainText('Trabalho excluído');
  await expect(page.getByText(title, {exact: true})).toHaveCount(0);
  expect((await request.get(`/trabalhos/${slug}`)).status()).toBe(404);
  await page.goto('/admin/midia');
  page.once('dialog', dialog => dialog.accept());
  await submit(page, page.locator('article').filter({has: page.getByAltText(alt, {exact: true})}).getByRole('button', {name: 'Excluir', exact: true}));
  await expect(page.getByRole('status')).toContainText('Imagem excluída');
  await expect(page.getByAltText(alt, {exact: true})).toHaveCount(0);
  expect((await page.request.get(mediaUrl)).status()).toBe(404);
});

test('category edits, ordering, quick publication and deletions persist in public collection', async ({page, browser}, testInfo) => {
  test.setTimeout(90_000);
  await login(page);
  const suffix = testInfo.project.name;
  const category = `Categoria QA ${suffix}`, renamed = `Categoria revisada ${suffix}`, categorySlug = `qa-categoria-${suffix}`;
  await page.goto('/admin/categorias');
  await adminReady(page);
  const add = page.locator('form').filter({has: page.getByRole('button', {name: 'Adicionar categoria', exact: true})});
  await add.getByLabel('Nome', {exact: true}).fill(category);
  await add.getByLabel('Endereço', {exact: true}).fill(categorySlug);
  await submit(page, add.getByRole('button', {name: 'Adicionar categoria', exact: true}));
  await expect(page.getByRole('status')).toContainText('Categoria salva');
  await page.reload();
  const edit = await categoryForm(page, categorySlug);
  await edit.getByLabel('Nome', {exact: true}).fill(renamed);
  await edit.getByLabel('Ordem', {exact: true}).fill('0');
  await submit(page, edit.getByRole('button', {name: 'Salvar categoria', exact: true}));
  await page.reload();
  await expect(edit.getByLabel('Nome', {exact: true})).toHaveValue(renamed);
  await expect(edit.getByLabel('Ordem', {exact: true})).toHaveValue('0');
  const a = `Primeiro QA ${suffix}`, b = `Segundo QA ${suffix}`;
  await createWork(page, a, `qa-primeiro-${suffix}`, {category: renamed, order: 9998, published: true});
  await createWork(page, b, `qa-segundo-${suffix}`, {category: renamed, order: 9999, published: true});
  const publicContext = await browser.newContext();
  try {
    const pub = await publicContext.newPage();
    await pub.goto(`${origin}/trabalhos?categoria=${categorySlug}`);
    await expect(pub.locator('a[href^="/trabalhos/"] h3')).toHaveText([a, b]);
    await page.goto('/admin/trabalhos');
    await submit(page, page.getByRole('button', {name: `Mover ${b} para antes`, exact: true}));
    await expect(page.getByRole('status')).toContainText('Ordem atualizada');
    await pub.reload();
    await expect(pub.locator('a[href^="/trabalhos/"] h3')).toHaveText([b, a]);
    const rowB = page.getByRole('row').filter({has: page.getByText(b, {exact: true})});
    await submit(page, rowB.getByRole('button', {name: 'Despublicar', exact: true}));
    await expect(page.getByRole('status')).toContainText('Trabalho retirado');
    await pub.reload();
    await expect(pub.locator('a[href^="/trabalhos/"] h3')).toHaveText([a]);
    await submit(page, rowB.getByRole('button', {name: 'Publicar', exact: true}));
    await expect(page.getByRole('status')).toContainText('Trabalho publicado');
    await pub.reload();
    await expect(pub.locator('a[href^="/trabalhos/"] h3')).toHaveText([b, a]);
    await page.goto('/admin/categorias');
    page.once('dialog', dialog => dialog.accept());
    await submit(page, edit.getByRole('button', {name: 'Excluir', exact: true}));
    await expect(page.getByRole('alert')).toContainText('Mova os trabalhos');
    await page.goto('/admin/trabalhos');
    for (const title of [a, b]) {
      page.once('dialog', dialog => dialog.accept());
      await submit(page, page.getByRole('row').filter({has: page.getByText(title, {exact: true})}).getByRole('button', {name: 'Excluir', exact: true}));
      await expect(page.getByText(title, {exact: true})).toHaveCount(0);
    }
    await pub.reload();
    await expect(pub.locator('a[href^="/trabalhos/"]')).toHaveCount(0);
    await page.goto('/admin/categorias');
    page.once('dialog', dialog => dialog.accept());
    await submit(page, edit.getByRole('button', {name: 'Excluir', exact: true}));
    await expect(page.getByRole('status')).toContainText('Categoria excluída');
    await pub.goto(`${origin}/trabalhos`);
    await expect(pub.getByRole('link', {name: renamed, exact: true})).toHaveCount(0);
  } finally { await publicContext.close(); }
});

test('identity is visible publicly and logout revokes every protected destination', async ({page, browser}, testInfo) => {
  await login(page);
  const brand = `FRAME QA ${testInfo.project.name}`, headline = `Montagem verificada ${testInfo.project.name}`;
  await page.goto('/admin/identidade');
  await adminReady(page);
  await page.getByLabel('Nome do estúdio ou editor').fill(brand);
  await page.getByLabel('Título da abertura').fill(headline);
  await submit(page, page.getByRole('button', {name: 'Salvar identidade'}));
  await expect(page.getByRole('status')).toContainText('Identidade salva');
  await page.reload();
  await expect(page.getByLabel('Nome do estúdio ou editor')).toHaveValue(brand);
  await expect(page.getByLabel('Título da abertura')).toHaveValue(headline);
  const context = await browser.newContext();
  try {
    const pub = await context.newPage();
    await pub.goto(origin);
    await expect(pub.getByRole('heading', {level: 1})).toHaveText(headline);
    await expect(pub).toHaveTitle(new RegExp(brand));
    await page.getByRole('button', {name: 'Encerrar sessão'}).click();
    await expect(page).toHaveURL(/entrar$/);
    for (const path of ['/admin', '/admin/trabalhos', '/admin/trabalhos/novo', '/admin/pedidos', '/admin/midia', '/admin/categorias', '/admin/identidade']) {
      await page.goto(path);
      await expect(page).toHaveURL(/entrar$/);
    }
    const mutation = await page.request.post('/admin/trabalhos?/status', {headers: {origin}, form: {id: 'anything'}});
    expect(mutation.ok()).toBe(false);
  } finally { await context.close(); }
});

test('private screens fit mobile and the editor menu retains all six destinations', async ({page}, testInfo) => {
  test.setTimeout(90_000);
  await login(page);
  const destinations = ['/admin', '/admin/trabalhos', '/admin/trabalhos/novo', '/admin/pedidos', '/admin/midia', '/admin/categorias', '/admin/identidade'];
  for (const path of destinations) {
    await page.goto(path);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({width, height: 900});
      await expectFits(page);
    }
  }
  await page.goto('/admin/categorias');
  const add = page.locator('form').filter({has: page.getByRole('button', {name: 'Adicionar categoria', exact: true})});
  await expect(add.getByLabel('Ordem', {exact: true})).toBeVisible();
  await page.goto('/admin/midia');
  await expect(page.getByText('PNG, JPEG ou WebP. Até 12 MiB e 24 megapixels.', {exact: true})).toBeVisible();
  await page.goto('/admin');
  await loadPhotographs(page);
  await page.screenshot({path: testInfo.outputPath('admin-desktop.png'), fullPage: true});
  await page.setViewportSize({width: 390, height: 844});
  await loadPhotographs(page);
  await page.screenshot({path: testInfo.outputPath('admin-mobile.png'), fullPage: true});
  const menu = page.getByRole('button', {name: 'Menu', exact: true});
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  const nav = page.getByRole('navigation', {name: 'Painel do editor'});
  await expect(nav.getByRole('link')).toHaveCount(6);
  for (const name of ['Visão geral', 'Trabalhos', 'Pedidos', 'Biblioteca', 'Categorias', 'Identidade']) {
    await expect(nav.getByRole('link', {name, exact: true})).toBeVisible();
  }
  await expect(page.getByRole('link', {name: 'Ver portfólio', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Encerrar sessão'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
  await menu.click();
  await nav.getByRole('link', {name: 'Trabalhos', exact: true}).click();
  await expect(page).toHaveURL(/\/admin\/trabalhos$/);
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await page.getByRole('button', {name: 'Encerrar sessão'}).click();
  await expect(page).toHaveURL(/entrar$/);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({width, height: 900});
    await expectFits(page);
    await loadPhotographs(page);
    await page.screenshot({path: testInfo.outputPath(`login-${width}.png`), fullPage: true});
  }
});

test('private mobile navigation and native logout remain usable without JavaScript', async ({page, browser}) => {
  await login(page);
  const context = await browser.newContext({javaScriptEnabled: false, viewport: {width: 390, height: 844}});
  try {
    await context.addCookies(await page.context().cookies());
    const native = await context.newPage();
    await native.goto(`${origin}/admin`);
    const nav = native.getByRole('navigation', {name: 'Painel do editor'});
    await expect(nav.getByRole('link')).toHaveCount(6);
    await expect(native.getByRole('button', {name: 'Menu', exact: true})).toBeHidden();
    for (const name of ['Trabalhos', 'Pedidos', 'Biblioteca', 'Categorias', 'Identidade', 'Visão geral']) {
      const link = nav.getByRole('link', {name, exact: true});
      await expect(link).toBeVisible();
      await link.click();
      await expectFits(native);
    }
    await native.getByRole('button', {name: 'Encerrar sessão'}).click();
    await expect(native).toHaveURL(/entrar$/);
    await native.goto(`${origin}/admin`);
    await expect(native).toHaveURL(/entrar$/);
  } finally { await context.close(); }
});
