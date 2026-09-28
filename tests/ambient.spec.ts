import { test, expect } from '@playwright/test';

const home = new URL('../_site/index.html', import.meta.url).href;

test('Murmuration renders offline at 20%, responds to themes, and suspends motion', async ({ page, context }) => {
  await context.setOffline(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto(home);
  const canvas = page.locator('.ambient-canvas');
  await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  await expect(canvas).toHaveCSS('opacity', '0.2');
  const pixels = () => canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());
  await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => node.width)).toBeGreaterThan(1000);
  expect(await canvas.evaluate((node: HTMLCanvasElement) => node.getContext('2d')!.getImageData(0, 0, node.width, node.height).data.some((v, i) => i % 4 === 3 && v > 0))).toBe(true);
  const still = await pixels();
  await page.waitForTimeout(160);
  expect(await pixels()).toBe(still);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(pixels).not.toBe(still);
  const dark = await pixels();
  await page.waitForTimeout(160);
  expect(await pixels()).toBe(dark);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(pixels).not.toBe(dark);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = await pixels();
  await page.waitForTimeout(160);
  expect(await pixels()).toBe(hidden);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(pixels).not.toBe(hidden);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(60);
  const paused = await pixels();
  await page.waitForTimeout(160);
  expect(await pixels()).toBe(paused);
  await page.emulateMedia({ media: 'print' });
  await expect(canvas).not.toBeVisible();
});

for (const width of [1440, 390, 320]) {
  test(`the dark hero wordmark blends into the warm page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto(home);
    await page.evaluate(() => document.fonts.ready);
    for (const selector of ['.hero-wordmark .wordmark']) {
      const image = await page.locator(selector).screenshot();
      const minimum = await page.evaluate(async data => {
        const image = new Image(); image.src = data; await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const channels = [255, 255, 255];
        for (let i = 0; i < pixels.length; i += 4) {
          channels.forEach((value, channel) => { channels[channel] = Math.min(value, pixels[i + channel]); });
        }
        return channels;
      }, `data:image/png;base64,${image.toString('base64')}`);
      // All dark-theme ink is lighter than the paper (#24221f). An inverted
      // white/grey matte used to leave pixels substantially darker than it.
      [36, 34, 31].forEach((paper, channel) => expect(minimum[channel]).toBeGreaterThanOrEqual(paper - 2));
    }
  });
}
