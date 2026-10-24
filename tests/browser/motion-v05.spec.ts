import {test, expect, type Page, type Locator} from '@playwright/test';

const origin = 'http://127.0.0.1:4174';
const formats = [{name: '16:9', ratio: 16 / 9}, {name: '4:3', ratio: 4 / 3}, {name: '1:1', ratio: 1}];
const study = (page: Page) => page.locator('[data-frame-study]');
const radio = (page: Page, name: string) => study(page).getByRole('radio', {name: new RegExp(`^${name}`)});

async function geometry(page: Page) {
  return study(page).evaluate(host => {
    const stage = host.querySelector<HTMLElement>('[data-frame-stage]');
    const crop = host.querySelector<HTMLElement>('[data-frame-crop]');
    if (!stage || !crop) throw new Error('Palco e recorte devem existir no HTML.');
    const bounds = stage.getBoundingClientRect();
    const box = crop.getBoundingClientRect();
    const style = getComputedStyle(crop);
    const expression = /^inset\(([^)]+)\)$/.exec(style.clipPath);
    if (!expression) throw new Error(`Recorte sem geometria inset verificável: ${style.clipPath}`);
    const tokens = expression[1].split('round')[0].trim().split(/\s+/);
    const expanded = tokens.length === 1 ? [tokens[0], tokens[0], tokens[0], tokens[0]] : tokens.length === 2 ? [tokens[0], tokens[1], tokens[0], tokens[1]] : tokens.length === 3 ? [tokens[0], tokens[1], tokens[2], tokens[1]] : tokens;
    const pixels = (value: string, dimension: number) => value.endsWith('%') ? parseFloat(value) * dimension / 100 : parseFloat(value);
    const top = pixels(expanded[0], box.height), right = pixels(expanded[1], box.width);
    const bottom = pixels(expanded[2], box.height), left = pixels(expanded[3], box.width);
    const selected = host.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.value;
    const guide = host.querySelector<SVGGElement>(`[data-frame-guide="${selected}"]`);
    const guideBox = guide?.querySelector('rect')?.getBoundingClientRect();
    return {
      stage: {width: bounds.width, height: bounds.height, top: bounds.top + scrollY},
      crop: {width: box.width - left - right, height: box.height - top - bottom, left: box.left + left, top: box.top + top},
      guide: guideBox ? {width: guideBox.width, height: guideBox.height, left: guideBox.left, top: guideBox.top, display: getComputedStyle(guide!).display} : null,
      transition: style.transitionDuration,
      clip: style.clipPath
    };
  });
}
async function expectFormat(page: Page, format: typeof formats[number]) {
  await expect(radio(page, format.name)).toBeChecked();
  await expect.poll(async () => {
    const value = await geometry(page);
    return value.crop.width / value.crop.height;
  }).toBeCloseTo(format.ratio, 2);
  const value = await geometry(page);
  expect(value.stage.width / value.stage.height).toBeCloseTo(16 / 9, 2);
  expect(value.crop.width).toBeGreaterThan(0);
  expect(value.crop.height).toBeGreaterThan(0);
  expect(value.guide).not.toBeNull();
  expect(value.guide!.display).not.toBe('none');
  expect(value.guide!.width / value.guide!.height).toBeCloseTo(format.ratio, 2);
  expect(Math.abs(value.guide!.width - value.crop.width)).toBeLessThan(2);
  expect(Math.abs(value.guide!.height - value.crop.height)).toBeLessThan(2);
  expect(Math.abs(value.guide!.left - value.crop.left)).toBeLessThan(2);
  expect(Math.abs(value.guide!.top - value.crop.top)).toBeLessThan(2);
  return value;
}
async function chooseFormat(page: Page, name: string) {
  const control = radio(page, name);
  const id = await control.getAttribute('id');
  expect(id).toBeTruthy();
  await study(page).locator(`label[for="${id}"]`).click();
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function loaded(image: Locator) {
  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
}
async function ready(page: Page) {
  await expect(page.locator('.v04-public.v04-enhanced')).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test('home and collection remain readable in the four authored viewport sizes', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width, height: 900});
    await page.goto('/');
    await ready(page);
    await expect(page.getByRole('heading', {level: 1})).toBeVisible();
    await expect(study(page).getByRole('heading', {name: 'O corte muda a leitura.', exact: true})).toBeVisible();
    await study(page).scrollIntoViewIfNeeded();
    await loaded(study(page).locator('img').first());
    await expectFormat(page, formats[0]);
    await fits(page);
    await page.goto('/trabalhos');
    await ready(page);
    await expect(page.getByRole('heading', {name: 'Trabalhos', exact: true})).toBeVisible();
    await expect(page.locator('ol.project-rows a.row-link').first()).toBeVisible();
    await fits(page);
  }
  expect(errors).toEqual([]);
});

test('native format controls change the real crop while preserving the external stage', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await ready(page);
  await study(page).scrollIntoViewIfNeeded();
  const baseline = await expectFormat(page, formats[0]);
  await expect(study(page).getByRole('radio')).toHaveCount(3);
  const controls = await study(page).getByRole('radio').evaluateAll(inputs => inputs.map(node => ({id: (node as HTMLInputElement).id, name: (node as HTMLInputElement).name})));
  expect(new Set(controls.map(control => control.id)).size).toBe(3);
  expect(new Set(controls.map(control => control.name)).size).toBe(1);
  expect(controls.every(control => control.id && control.name)).toBe(true);
  for (const format of formats) {
    await expect(radio(page, format.name)).toHaveAttribute('type', 'radio');
    await chooseFormat(page, format.name);
    const current = await expectFormat(page, format);
    expect(Math.abs(current.stage.width - baseline.stage.width)).toBeLessThan(1);
    expect(Math.abs(current.stage.height - baseline.stage.height)).toBeLessThan(1);
    expect(Math.abs(current.stage.top - baseline.stage.top)).toBeLessThan(1);
  }
  await chooseFormat(page, '16:9');
  await radio(page, '16:9').focus();
  await page.keyboard.press('ArrowRight');
  await expectFormat(page, formats[1]);
  await page.keyboard.press('ArrowRight');
  await expectFormat(page, formats[2]);
  await page.keyboard.press('ArrowLeft');
  await expectFormat(page, formats[1]);
  await page.keyboard.press('ArrowLeft');
  await expectFormat(page, formats[0]);
  for (const name of ['1:1', '4:3', '16:9', '1:1']) {
    await radio(page, name).focus();
    await page.keyboard.press('Space');
  }
  await expectFormat(page, formats[2]);
  await expect(radio(page, '1:1')).toBeFocused();
  await expect(study(page).locator('[data-frame-stage]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('CSS format selection and project links work without JavaScript', async ({browser}) => {
  const context = await browser.newContext({javaScriptEnabled: false, reducedMotion: 'reduce', viewport: {width: 390, height: 844}});
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await loaded(study(page).locator('img').first());
    const baseline = await expectFormat(page, formats[0]);
    for (const format of formats) {
      await chooseFormat(page, format.name);
      const current = await expectFormat(page, format);
      expect(Math.abs(current.stage.height - baseline.stage.height)).toBeLessThan(1);
      await fits(page);
    }
    await page.goto(`${origin}/trabalhos`);
    const rows = page.locator('ol.project-rows a.row-link');
    await expect(rows.first()).toBeVisible();
    for (const toggle of await page.locator('.preview-toggle').all()) await expect(toggle).toBeHidden();
    for (const image of await rows.locator('img.row-thumb').all()) {
      await image.scrollIntoViewIfNeeded();
      await loaded(image);
    }
    const target = await rows.first().getAttribute('href');
    const title = await rows.first().locator('h3').innerText();
    await rows.first().click();
    await expect(page).toHaveURL(`${origin}${target}`);
    await expect(page.getByRole('heading', {name: title, exact: true})).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('changing reduced-motion preference keeps the selected crop and preview usable', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto('/');
  await ready(page);
  await study(page).scrollIntoViewIfNeeded();
  await chooseFormat(page, '4:3');
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expectFormat(page, formats[1]);
  await chooseFormat(page, '1:1');
  const reduced = await expectFormat(page, formats[2]);
  expect(reduced.transition.split(',').every(value => parseFloat(value) === 0)).toBe(true);
  await page.goto('/trabalhos');
  await ready(page);
  const links = page.locator('ol.project-rows a.row-link');
  await links.last().focus();
  await expect(page.locator('.collection-preview .preview-title')).toHaveText(await links.last().locator('h3').innerText());
  expect(await page.locator('.collection-preview .preview-image').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto('/');
  await ready(page);
  await study(page).scrollIntoViewIfNeeded();
  await chooseFormat(page, '4:3');
  await expectFormat(page, formats[1]);
  await expect(study(page)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('choosing a format before delayed JavaScript preserves the native selection after hydration', async ({browser}) => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  let release = () => {};
  const barrier = new Promise<void>(resolve => { release = resolve; });
  let intercepted = 0;
  await context.route('**/_app/immutable/**/*.js', async route => { intercepted++; await barrier; await route.continue(); });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin, {waitUntil: 'commit'});
    await study(page).scrollIntoViewIfNeeded();
    await chooseFormat(page, '4:3');
    await expectFormat(page, formats[1]);
    expect(intercepted).toBeGreaterThan(0);
    release();
    await ready(page);
    await expectFormat(page, formats[1]);
    await fits(page);
    expect(errors).toEqual([]);
  } finally { release(); await context.close(); }
});

test('desktop focus and hover preview only projects in the actual selected category', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/trabalhos');
  await ready(page);
  await page.locator('.v04-filters a[href="/trabalhos?categoria=montagem"]').click();
  await expect(page).toHaveURL(/categoria=montagem/);
  await ready(page);
  const rows = page.locator('ol.project-rows li');
  await expect(rows).toHaveCount(2);
  const preview = page.locator('.collection-preview');
  for (const row of await rows.all()) {
    await expect(row.locator('.row-category')).toContainText('Montagem');
    const link = row.locator('a.row-link');
    const title = await link.locator('h3').innerText();
    await link.focus();
    await expect(preview.locator('.preview-title')).toHaveText(title);
    await expect(preview.locator('.preview-category')).toHaveText('Montagem');
    await expect(preview.locator('figcaption a')).toHaveAttribute('href', (await link.getAttribute('href'))!);
    await expect(preview.locator('img')).toHaveAttribute('src', (await link.locator('img').getAttribute('src'))!);
    await loaded(preview.locator('img'));
    await expect(link).toBeFocused();
  }
  await rows.first().locator('a.row-link').hover();
  await expect(preview.locator('.preview-title')).toHaveText(await rows.first().locator('h3').innerText());
  await expect(rows.last().locator('a.row-link')).toBeFocused();
  await page.locator('.v04-filters a[href="/trabalhos?categoria=motion"]').click();
  await expect(rows).toHaveCount(1);
  await expect(preview.locator('.preview-title')).toHaveText(await rows.first().locator('h3').innerText());
  await expect(preview.locator('.preview-category')).toHaveText('Motion');
  expect(errors).toEqual([]);
});

test('mobile previews are separate from navigation and Escape closes without stealing focus', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/trabalhos');
  await expect(page.locator('.project-index.enhanced')).toBeVisible();
  const rows = page.locator('ol.project-rows li');
  await expect(rows).toHaveCount(4);
  await expect(page.locator('.collection-preview')).toBeHidden();
  const targets = await rows.locator('a.row-link').evaluateAll(links => links.map(link => link.getAttribute('href')));
  expect(new Set(targets).size).toBe(targets.length);
  const first = rows.nth(0), second = rows.nth(1);
  const firstToggle = first.locator('.preview-toggle'), secondToggle = second.locator('.preview-toggle');
  expect(await firstToggle.evaluate(node => node.closest('a') === null)).toBe(true);
  expect((await firstToggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await firstToggle.click();
  await expect(page).toHaveURL(`${origin}/trabalhos`);
  await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(first.locator('.mobile-preview')).toBeVisible();
  await expect(firstToggle).toHaveAttribute('aria-controls', (await first.locator('.mobile-preview').getAttribute('id'))!);
  await loaded(first.locator('.mobile-preview img'));
  await secondToggle.click();
  await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(first.locator('.mobile-preview')).toBeHidden();
  await loaded(second.locator('.mobile-preview img'));
  await secondToggle.focus();
  await page.keyboard.press('Escape');
  await expect(secondToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(second.locator('.mobile-preview')).toBeHidden();
  await expect(secondToggle).toBeFocused();
  await firstToggle.focus();
  await page.keyboard.press('Space');
  await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(firstToggle).toBeFocused();
  const target = await second.locator('a.row-link').getAttribute('href');
  const title = await second.locator('h3').innerText();
  await second.locator('a.row-link').click();
  await expect(page).toHaveURL(`${origin}${target}`);
  await expect(page.getByRole('heading', {name: title, exact: true})).toBeVisible();
  expect(errors).toEqual([]);
});
