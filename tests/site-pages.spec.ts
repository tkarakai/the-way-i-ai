import { test, expect } from './fixtures.ts';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// GitHub Pages serves 404.html at whatever path was requested, so its links and icons start at the site root.
test('the 404 page works at any depth in both designs, and footers reach every site page', async ({ browser }) => {
  const server = spawn(process.execPath, [resolve(root, 'scripts/server.ts')], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const base = await new Promise<string>((resolveURL, reject) => {
      let output = '';
      server.stdout.on('data', chunk => { output += chunk; const match = output.match(/Serving: (http:\/\/127\.0\.0\.1:\d+\/)/); if (match) resolveURL(match[1]); });
      server.once('exit', code => reject(new Error(`Preview exited with ${code}`)));
    });
    for (const design of ['atlas', 'folio']) {
      const context = await browser.newContext();
      await context.addInitScript(choice => localStorage.setItem('the-way-i-ai-design', choice), design);
      const page = await context.newPage();
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        const response = await page.goto(`${base}topics/no-such/deep/page.html`);
        expect(response?.status()).toBe(404);
        await expect(page.locator('html')).toHaveAttribute('data-design', design);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nothing here');
        await expect(page.locator('.info-topic')).not.toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await page.locator('.info-topic').first().click();
      await expect(page).toHaveURL(/\/topics\/[a-z0-9-]+\/index\.html$/);
      for (const name of ['About', 'Privacy', 'Licensing']) {
        await page.locator('.footer-links').getByRole('link', { name, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/${name.toLowerCase()}/index\\.html$`));
        await expect(page.locator('.footer-links [aria-current="page"]')).toHaveText(name);
        await expect(page.locator('.info-body .prose h2').first()).toBeVisible();
      }
      await page.locator('.info-toc a').last().click();
      await expect(page).toHaveURL(/#[a-z0-9-]+$/);
      await context.close();
    }
  } finally { server.kill('SIGTERM'); }
});
