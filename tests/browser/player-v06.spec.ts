import { test, expect, type Page } from '@playwright/test';

// Run against the real Ikari installation. PLAYER_V06_PATH can select a sourced
// commission; ordinary FRAME seeds have no clips and report this suite skipped.
async function openPlayer(page: Page) {
  if (process.env.PLAYER_V06_PATH) {
    await page.goto(process.env.PLAYER_V06_PATH);
  } else {
    await page.goto('/trabalhos');
    for (let index = 0; index < 2; index++) {
      const links = await page.locator('ol.project-rows a.row-link').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')!));
      for (const link of links) {
        const response = await page.request.get(link);
        if ((await response.text()).includes('data-commission-player')) {
          await page.goto(link);
          await expect(page.locator('.v04-enhanced')).toBeVisible();
          await expect(page.locator('.chapter-opening.active')).toHaveCount(0);
          await expect(page.locator('#conteudo')).not.toHaveAttribute('inert','');
          return page.locator('[data-commission-player]').first();
        }
      }
      const next = page.getByRole('link', { name: 'Próxima', exact: true });
      if (!await next.count()) break;
      await next.click();
    }
    test.skip(true, 'Esta instalação ainda não contém um trecho MP4 integrado ao CommissionPlayer.');
  }
  const player = page.locator('[data-commission-player]').first();
  await expect(player).toBeVisible();
  return player;
}

test('poster and direct clip fallback exist in SSR without requesting video media', async ({ page, browser }) => {
  const player = await openPlayer(page);
  const path = page.url();
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const ssr = await context.newPage();
    const mediaRequests: string[] = [];
    ssr.on('request', request => { if (new URL(request.url()).pathname.startsWith('/trechos/')) mediaRequests.push(request.url()); });
    await ssr.goto(path);
    const root = ssr.locator('[data-commission-player]').first();
    const video = root.locator('video');
    await expect(video).not.toHaveAttribute('src');
    await expect(video).toHaveJSProperty('currentSrc', '');
    await expect(video).toHaveJSProperty('readyState', 0);
    await expect(video).toHaveAttribute('preload', 'none');
    await expect(video).toHaveAttribute('playsinline');
    await expect(root.locator('.poster')).toBeVisible();
    await expect.poll(() => root.locator('.poster').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(root.getByRole('link', { name: 'Abrir trecho MP4' })).toHaveAttribute('href', await player.locator('figcaption a').getAttribute('href') as string);
    const bounds = await root.locator('[data-player-stage]').boundingBox();
    expect(bounds!.width / bounds!.height).toBeCloseTo(16 / 9, 2);
    expect(mediaRequests).toEqual([]);
    expect(await ssr.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});

test('real clip loads only after a gesture and native keyboard controls play, seek and mute', async ({ page, browserName }) => {
  const errors: string[] = [];
  const mediaRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/trechos/')) mediaRequests.push(request.url()); });
  const player = await openPlayer(page);
  const video = player.locator('video');
  await player.scrollIntoViewIfNeeded();
  await expect(player.getByRole('button', { name: 'Reproduzir trecho', exact: true })).toBeEnabled();
  await expect(video).not.toHaveAttribute('src');
  await expect(video).toHaveJSProperty('currentSrc', '');
  await expect(video).toHaveJSProperty('readyState', 0);
  expect(mediaRequests).toEqual([]);
  const play = player.getByRole('button', { name: 'Reproduzir trecho', exact: true });
  await play.focus();
  await expect(play).toBeFocused();
  await page.keyboard.press('Space');
  await expect(video).toHaveAttribute('preload', 'metadata');
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => !node.paused && node.readyState >= 2), { timeout: 25000 }).toBe(true);
  const source = await player.locator('figcaption a').getAttribute('href');
  await expect(video).toHaveJSProperty('currentSrc', new URL(source!, page.url()).href);
  // WebKit's native media backend may not expose its HTTP requests to Playwright.
  // currentSrc + decoded data + advancing playback are required in every browser;
  // Chromium additionally proves that the real clip endpoint was requested.
  if (browserName === 'chromium') expect(mediaRequests.length).toBeGreaterThan(0);
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime), { timeout: 10000 }).toBeGreaterThan(0);
  await player.getByRole('button', { name: 'Pausar trecho', exact: true }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  const seek = player.getByRole('slider', { name: 'Posição do trecho' });
  await expect(seek).toBeEnabled();
  await seek.focus();
  const duration = await video.evaluate((node: HTMLVideoElement) => node.duration);
  // Assert a visible seek across the clip rather than an exact first-frame
  // timestamp: native WebKit can clamp the MP4 start to its 0.01 s media offset.
  await page.keyboard.press('End');
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(duration * 0.9);
  await page.keyboard.press('Home');
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeLessThan(0.2);
  await expect(seek).toBeFocused();
  await player.getByRole('button', { name: 'Silenciar trecho' }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.muted)).toBe(true);
  await player.getByRole('button', { name: 'Ativar som' }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.muted)).toBe(false);
  const volume = player.getByRole('slider', { name: 'Volume', exact: true });
  await volume.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.volume)).toBeCloseTo(0.05, 2);
  expect(errors).toEqual([]);
});

test('playback pauses outside the viewport, on visibilitychange and after route cleanup', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  const player = await openPlayer(page);
  const video = player.locator('video');
  const start = async () => {
    await player.locator('[data-player-stage]').scrollIntoViewIfNeeded();
    await player.getByRole('button', { name: 'Reproduzir trecho', exact: true }).click();
    await expect.poll(() => video.evaluate((node: HTMLVideoElement) => !node.paused), { timeout: 25000 }).toBe(true);
  };
  await start();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  await start();
  // Exercise the actual visibility listener deterministically in headless browsers.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  await page.evaluate(() => { delete (document as unknown as Record<string, unknown>).hidden; });
  await start();
  const handle = await video.elementHandle();
  await page.getByRole('link', { name: /Voltar (ao Índice|aos trabalhos)/ }).click();
  await expect(page).toHaveURL(/\/(indice|trabalhos)(?:[?#].*)?$/);
  await expect(page.locator('[data-commission-player]')).toHaveCount(0);
  expect(await handle!.evaluate((node: HTMLVideoElement) => node.paused && !node.hasAttribute('src'))).toBe(true);
});

test('failed clip retains poster and an actionable source fallback', async ({ page }) => {
  const player = await openPlayer(page);
  const source = await player.locator('figcaption a').getAttribute('href');
  expect(source).toBeTruthy();
  const missing = new URL('/trechos/00000000-0000-4000-8000-000000000000', page.url()).href;
  expect((await page.request.get(missing)).status()).toBe(404);
  await player.getByRole('button', { name: 'Reproduzir trecho', exact: true }).click();
  const video = player.locator('video');
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState >= 2), { timeout: 25000 }).toBe(true);
  // Point only the DOM media element at a confirmed missing endpoint. This causes
  // a real HTTP 404 and native MediaError in WebKit and Chromium, without synthetic
  // error events, route interception, production edits or changes to stored clips.
  // Scope: verifies the mounted player's failure handling, not manifest lookup.
  await video.evaluate((node: HTMLVideoElement, missingUrl) => { node.src = missingUrl; node.load(); }, missing);
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.error !== null), { timeout: 15000 }).toBe(true);
  await expect(video).toHaveJSProperty('currentSrc', missing);
  await expect(player.getByRole('status')).toContainText('indisponível');
  await expect(player.locator('.poster')).toBeVisible();
  await expect(player.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  await expect(player.locator('.error a')).toHaveAttribute('href', /\S+/);
  await expect(video).toHaveJSProperty('paused', true);
});

test('mobile controls retain touch targets, focus, reduced motion and supported fullscreen', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const player = await openPlayer(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await player.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const control of await player.locator('.controls button, .controls input').all()) {
      const bounds = await control.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
    }
    expect(await player.locator('[data-player-stage] video').evaluate(node => getComputedStyle(node).objectFit)).toBe('contain');
  }
  const play = player.getByRole('button', { name: 'Reproduzir trecho', exact: true });
  await play.focus();
  expect(await play.evaluate(node => parseFloat(getComputedStyle(node).outlineWidth))).toBeGreaterThanOrEqual(3);
  expect(await player.locator('.start').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  if (await page.evaluate(() => document.fullscreenEnabled)) {
    await player.getByRole('button', { name: 'Abrir tela cheia', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.hasAttribute('data-commission-player') ?? false)).toBe(true);
    await player.getByRole('button', { name: 'Sair da tela cheia', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  }
  await expect(player.locator('video')).not.toHaveAttribute('src');
});
