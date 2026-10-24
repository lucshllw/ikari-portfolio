import { test, expect, type Page } from '@playwright/test';
const ready = async (page: Page) => {
  await expect(page.locator('html')).not.toHaveAttribute('data-ikari-transition', 'active');
  await expect(page.locator('.chapter-opening.active')).toHaveCount(0);
};
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  test.skip(await page.locator('.ikari-hero').count() === 0, 'Applies only to the Ikari installation.');
  await ready(page);
});

test('mobile jukebox keeps one operable scene, decoded covers and synchronized touch chapters', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload(); await ready(page);
  const scene = page.locator('.ikari-showcase');
  await expect(scene).toHaveAttribute('data-showcase-enhanced', 'true');
  const top = await scene.evaluate(n => n.getBoundingClientRect().top + scrollY);
  await page.evaluate(y => scrollTo(0, y), top);
  await expect(scene).toHaveAttribute('data-motion-active', 'true');
  for (let i = 0; i < 4; i++) {
    await scene.locator(`[data-showcase-chapter="${i}"]`).click();
    await expect(scene).toHaveAttribute('data-showcase-active', String(i));
    await expect(scene.locator('[data-showcase-panel]:not([inert])')).toHaveCount(1);
    await expect(scene.locator('[data-showcase-panel]:not([inert]) .scene-play')).toBeVisible();
    await expect(scene.locator('[data-showcase-vinyl]')).toBeVisible();
  }
  expect(await scene.locator('.release-cover img').evaluateAll(images => images.every(n => (n as HTMLImageElement).complete && (n as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const stage = await scene.locator('[data-showcase-stage]').boundingBox();
  expect(stage?.height).toBeLessThanOrEqual(845);
  // Swipe must synchronize the native scroll position as well as the counter.
  await scene.evaluate(node => {
    node.dispatchEvent(Object.assign(new Event('touchstart'), {touches:[{clientX:80,clientY:380}]}));
    node.dispatchEvent(Object.assign(new Event('touchend'), {changedTouches:[{clientX:220,clientY:386}]}));
  });
  await expect(scene).toHaveAttribute('data-showcase-active', '2');
});

test('footer letters animate without a mouse and stay visible under reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const work = await page.locator('.scene-play').first().getAttribute('href');
  for (const route of ['/', '/indice', '/sobre', '/links', '/contato', work!]) {
    await page.goto(route); await ready(page);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const footer = page.locator('.studio-finale');
    await expect(footer).toHaveAttribute('data-finale-entered', 'true');
    await expect(footer).toHaveAttribute('data-finale-ambient', 'true');
    const ink = footer.locator('[data-finale-ink]').first();
    const before = await ink.evaluate(n => getComputedStyle(n).transform);
    await expect.poll(() => ink.evaluate(n => getComputedStyle(n).transform)).not.toBe(before);
    await expect(footer.locator('[data-finale-letter]')).toHaveCount(6);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload(); await ready(page);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('.studio-finale')).toHaveAttribute('data-finale-ambient', 'false');
  expect(await page.locator('[data-finale-letter]').evaluateAll(nodes => nodes.every(n => getComputedStyle(n).opacity === '1'))).toBe(true);
});

test('backstage clapboard opens and reconstructs while the mural keeps its height', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload(); await ready(page);
  const mural = page.locator('.ikari-behind-banner');
  const top = await mural.evaluate(n => n.getBoundingClientRect().top + scrollY);
  await page.evaluate(y => scrollTo(0, y - innerHeight * .8), top);
  await expect.poll(async () => Number(await mural.getAttribute('data-clapboard-progress'))).toBeGreaterThan(0);
  const opening = Number(await mural.getAttribute('data-clapboard-progress'));
  await page.evaluate(y => scrollTo(0, y), top);
  await expect.poll(async () => Number(await mural.getAttribute('data-clapboard-progress'))).toBe(100);
  expect((await mural.boundingBox())!.height).toBeGreaterThanOrEqual(360);
  await page.evaluate(y => scrollTo(0, y - innerHeight * .8), top);
  await expect.poll(async () => Number(await mural.getAttribute('data-clapboard-progress'))).toBeLessThan(opening + 2);
  await expect(mural.locator('img')).toHaveAttribute('src', '/ikari/banner-mural-v09.webp');
});
