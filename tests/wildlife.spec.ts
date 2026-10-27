import { test, expect } from '@playwright/test';
import { mkdtemp, cp, symlink, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
test('species-only ZIP contents integrate without topic bindings, preserve portraits, and remain decorative offline', async ({ page, context, browser }) => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'wildlife-browser-'));
  try {
    for (const item of ['scripts', 'design-system', 'topics']) await cp(resolve(root, item), resolve(fixture, item), { recursive: true, filter: file => !file.endsWith('.html') });
    await symlink(resolve(root, 'node_modules'), resolve(fixture, 'node_modules'), 'dir');
    const directory = resolve(fixture, 'topics/worktrees/assets/illustrations');
    await mkdir(directory, { recursive: true });
    const manifest = { version: 3, species: 'Red fox', images: Array.from({ length: 5 }, (_, index) => ({ file: index ? `panorama-0${index}.png` : 'hero.png', placement: index ? 'panorama' : 'hero', alt: '', width: 1600, height: index ? 400 : 900 })) };
    for (const image of manifest.images) {
      const data = await page.evaluate(({ width, height }) => {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#FAF8F3'; ctx.fillRect(0, 0, width, height);
        // A portrait-shaped focal mark makes accidental 4:1 clipping evident.
        ctx.fillStyle = '#C88D40'; ctx.fillRect(width * .45, height * .08, width * .1, height * .84);
        return canvas.toDataURL('image/png').split(',')[1];
      }, image);
      await writeFile(resolve(directory, image.file), Buffer.from(data, 'base64'));
    }
    await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest));
    const build = () => spawnSync(process.execPath, [resolve(fixture, 'scripts/build.ts')], { cwd: fixture, encoding: 'utf8' });
    const result = build(); expect(result.status, result.stderr).toBe(0);
    const article = pathToFileURL(resolve(fixture, 'topics/worktrees/index.html')).href;
    await context.setOffline(true);
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(pathToFileURL(resolve(fixture, 'index.html')).href);
        const card = page.locator('.topic-card[href="topics/worktrees/index.html"]');
        await expect(card).toHaveAccessibleName('Git Worktrees for Claude Code');
        const src = await card.locator('img').getAttribute('src');
        await card.click();
        const portrait = page.locator('.editorial-portrait');
        await expect(portrait).toHaveAttribute('src', src!);
        await expect(portrait).toHaveCSS('object-fit', 'contain');
        const portraitBox = await portrait.boundingBox();
        expect(Math.abs(portraitBox!.width / portraitBox!.height - 16 / 9)).toBeLessThan(.01);
        const strips = page.locator('.editorial-wildlife');
        await expect(strips).toHaveCount(4);
        for (const strip of await strips.all()) {
          await strip.scrollIntoViewIfNeeded();
          await expect(strip).toBeVisible();
          expect(await strip.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1600, 400]);
          expect(await strip.evaluate(img => (img.nextElementSibling ?? img.closest('.article-reveal')?.nextElementSibling?.firstElementChild)?.tagName)).toBe('H2');
          const box = await strip.boundingBox(); expect(Math.abs(box!.width / box!.height - 4)).toBeLessThan(.01);
        }
        await expect(page.locator('.editorial-image:not([alt=""])')).toHaveCount(0);
        await expect(page.getByRole('img')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
        await portrait.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/wildlife-${theme}-${width}.png` });
      }
    }
    const noJS = await browser.newContext({ javaScriptEnabled: false, offline: true, viewport: { width: 390, height: 900 } });
    try {
      const staticPage = await noJS.newPage(); await staticPage.goto(article);
      await expect(staticPage.locator('.editorial-portrait')).toBeVisible();
      await expect(staticPage.locator('.editorial-wildlife')).toHaveCount(4);
    } finally { await noJS.close(); }
    const before = await readFile(resolve(fixture, 'index.html'), 'utf8');
    manifest.images[1].file = '../bad.png';
    await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest));
    expect(build().status).not.toBe(0);
    expect(await readFile(resolve(fixture, 'index.html'), 'utf8')).toBe(before);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});
