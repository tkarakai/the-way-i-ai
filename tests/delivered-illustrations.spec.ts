import { test, expect } from './fixtures.ts';
import { readFile } from 'node:fs/promises';
import type { IllustrationManifest } from '../scripts/illustrations.ts';

const root = new URL('../_site/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('../topics/just-enough-context/assets/illustrations/manifest.json', import.meta.url), 'utf8')) as IllustrationManifest;
for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390, 320]) {
    test(`delivered JEC artwork matches its manifest at ${width}px in ${theme}`, async ({ page, context }) => {
      await context.route(/^https?:/, route => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(new URL('index.html', 'http://127.0.0.1:4193/').href);
      const homepage = page.locator('.topic-card[href="topics/just-enough-context/index.html"] img');
      const sharedSource = await homepage.evaluate((img: HTMLImageElement) => img.src);
      const sharedImage = manifest.images.find(image => image.placement === 'homepage') ?? manifest.images.find(image => image.placement === 'hero');
      const cardBox = await homepage.boundingBox();
      expect(Math.abs(cardBox!.width / cardBox!.height - 16 / 9)).toBeLessThan(.01);
      await page.goto(new URL('topics/just-enough-context/index.html', 'http://127.0.0.1:4193/').href);
      expect(await page.locator('.editorial-hero').evaluate((img: HTMLImageElement) => img.src)).toBe(sharedSource);
      const images = [sharedImage!, ...manifest.images.filter(image => image.placement === 'chapter' || image.placement === 'panorama')];
      await expect(page.locator('.editorial-image')).toHaveCount(images.length);
      for (const [index, image] of images.entries()) {
        const node = page.locator('.editorial-image').nth(index);
        await expect(node).toHaveAttribute('alt', image.alt);
        await node.scrollIntoViewIfNeeded();
        await expect(node).toBeVisible();
        await expect.poll(() => node.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
        const dimensions = await node.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]);
        expect(dimensions[0]).toBeGreaterThan(0); expect(dimensions[0]).toBeLessThanOrEqual(image.width);
        expect(dimensions[0] / dimensions[1]).toBeCloseTo(image.width / image.height, 1);
        if (manifest.version === 3) {
          const corners = await node.evaluate((img: HTMLImageElement) => {
            const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
            return [[0, 0], [canvas.width - 1, 0], [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1]].map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]);
          });
          for (const pixel of corners) { pixel.slice(0, 3).forEach((channel, index) => expect(Math.abs(channel - [248, 245, 238][index])).toBeLessThanOrEqual(4)); expect(pixel[3]).toBe(255); }
        }
        if (image.placement === 'chapter') {
          expect(await node.evaluate(img => img.previousElementSibling?.textContent)).toBe(image.heading);
          expect(await node.evaluate(img => img.previousElementSibling?.tagName)).toBe('H2');
        }
        if (image.placement === 'panorama') {
          expect(await node.evaluate(img => (img.nextElementSibling ?? img.closest('.article-reveal')?.nextElementSibling?.firstElementChild)?.tagName)).toBe('H2');
        }
        const portrait = manifest.version === 3 && image.placement === 'hero';
        const box = await node.boundingBox();
        expect(Math.abs(box!.width / box!.height - (portrait ? 16 / 9 : 4))).toBeLessThan(.01);
        await expect(node).toHaveCSS('object-fit', portrait ? 'contain' : 'cover');
        await expect(node).toHaveCSS('object-position', '50% 50%');
        expect(box!.width).toBeLessThanOrEqual(width);
      }
      if (manifest.version === 3) await expect(page.getByRole('img')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
      await page.evaluate(() => { localStorage.removeItem('the-way-i-ai-scroll-just-enough-context'); scrollTo(0, 0); });
      await page.goto(new URL('topics/just-enough-context/index.html', 'http://127.0.0.1:4193/').href);
      await page.screenshot({ path: `test-results/delivered-jec-${theme}-${width}.png` });
    });
  }
}
