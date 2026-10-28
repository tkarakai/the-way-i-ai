import { test, expect } from './fixtures.ts';
import { mkdtemp, cp, symlink, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
test('delivered artwork renders offline in both themes, with exact chapter anchors and graceful partial delivery', async ({ page, context }) => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'illustration-browser-'));
  try {
    for (const item of ['scripts', 'design-system', 'topics']) await cp(resolve(root, item), resolve(fixture, item), { recursive: true, filter: file => !file.endsWith('.html') && !file.includes('/assets/illustrations') });
    await symlink(resolve(root, 'node_modules'), resolve(fixture, 'node_modules'), 'dir');
    const directory = resolve(fixture, 'topics/worktrees/assets/illustrations');
    await mkdir(directory, { recursive: true });
    const images = [
      { file: 'hero.png', placement: 'hero', alt: 'A paper field with an amber focal object', width: 1600, height: 900 },
      { file: 'chapter-01.png', placement: 'chapter', document: 'WORKFLOW.md', heading: 'Working on a Task', alt: 'A panoramic paper field with an amber focal object', width: 1600, height: 400 },
      { file: 'chapter-02.png', placement: 'chapter', document: 'README.md', heading: 'Overview', alt: 'Pending artwork', width: 1600, height: 400 }
    ];
    // Real raster test fixtures, not substitute production artwork.
    for (const image of images.slice(0, 2)) {
      const data = await page.evaluate(({ width, height }) => {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#FAF8F3'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#C88D40'; ctx.fillRect(width * .4, height * .4, width * .2, height * .2);
        return canvas.toDataURL('image/png').split(',')[1];
      }, image);
      await writeFile(resolve(directory, image.file), Buffer.from(data, 'base64'));
    }
    const manifest = { version: 2, topic: 'worktrees', images };
    await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest));
    const build = (...args: string[]) => spawnSync(process.execPath, [resolve(fixture, 'scripts/build.ts'), ...args], { cwd: fixture, encoding: 'utf8' });
    const built = build(); expect(built.status, built.stderr).toBe(0);
    await context.setOffline(true);
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(pathToFileURL(resolve(fixture, 'index.html')).href);
        const card = page.locator('.topic-card[href="topics/worktrees/index.html"]');
        await expect(card.locator('img')).toHaveAccessibleName(images[0].alt);
        await expect(page.locator('.no-cover').first()).toBeEmpty();
        const sharedSource = await card.locator('img').getAttribute('src');
        const cardImage = await card.locator('img').boundingBox();
        expect(Math.abs(cardImage!.width / cardImage!.height - 16 / 9)).toBeLessThan(.01);
        await card.screenshot({ path: `test-results/illustration-card-${theme}-${width}.png` });
        await card.click();
        const hero = page.locator('.editorial-hero');
        await expect(hero).toBeVisible();
        await expect(hero).toHaveAttribute('src', sharedSource!);
        await expect(page.locator('.topic-hero + .plate-mount > .editorial-hero')).toHaveCount(1);
        const chapter = page.locator('#worktrees-doc-2-working-on-a-task + .editorial-chapter');
        await chapter.scrollIntoViewIfNeeded();
        await expect(chapter).toHaveAccessibleName(images[1].alt);
        await expect(page.locator('.editorial-chapter')).toHaveCount(1);
        for (const img of [hero, chapter]) {
          expect(await img.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
          const box = await img.boundingBox(); expect(box!.width).toBeLessThanOrEqual(width);
          expect(Math.abs(box!.width / box!.height - 4)).toBeLessThan(.01);
          await expect(img).toHaveCSS('object-fit', 'cover');
          await expect(img).toHaveCSS('object-position', '50% 50%');
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
        await chapter.screenshot({ path: `test-results/illustration-chapter-${theme}-${width}.png` });
      }
    }
    const before = await readFile(resolve(fixture, 'index.html'), 'utf8');
    images[1].heading = 'No such chapter';
    await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest));
    const invalid = build();
    expect(invalid.status).not.toBe(0);
    expect(invalid.stderr).toContain('must match exactly once');
    expect(await readFile(resolve(fixture, 'index.html'), 'utf8')).toBe(before);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});
