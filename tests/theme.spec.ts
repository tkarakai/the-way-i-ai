import { test, expect } from '@playwright/test';

const home = new URL('../_site/index.html', import.meta.url).href;
const topic = new URL('../_site/topics/worktrees/index.html', import.meta.url).href;
const hour = 60 * 60 * 1000;
const key = 'the-way-i-ai-theme';

test('scrolling, typing, and navigation extend the override rather than its original selection time', async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 400 });
  await page.goto(topic);
  await page.locator('.theme-toggle').click();
  await page.clock.fastForward(hour);
  // An element scroll does not bubble; the activity listener must capture it.
  await page.locator('.contents').evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect.poll(() => page.locator('.contents').evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await page.clock.fastForward(hour + hour / 4);
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');
  await page.getByRole('searchbox', { name: 'Search this page', exact: true }).fill('worktree');
  await page.clock.fastForward(hour + hour / 4);
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');
  await page.locator('.brand').click();
  await expect(page).toHaveURL(home);
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');
  await page.clock.fastForward(2 * hour - 60_000);
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');
  await page.clock.fastForward(61_000);
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('a stale stored choice resets before navigation can renew it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto(home);
  await page.evaluate(({ key, age }) => {
    localStorage.setItem(key, JSON.stringify({ preference: 'dark', lastActivity: Date.now() - age }));
  }, { key, age: 3 * hour });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  await expect(page.locator('.theme-dark')).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
});

test('manual toggles and resetting storage synchronize the target icons across tabs', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto(home);
  const other = await context.newPage();
  await other.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await other.goto(home);
  await page.locator('.theme-toggle').click();
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(other.locator('.theme-light')).toBeVisible();
  await expect(other.locator('.theme-dark')).not.toBeVisible();
  await other.evaluate(key => localStorage.removeItem(key), key);
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  await expect(page.locator('.theme-dark')).toBeVisible();
});
