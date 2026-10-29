import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const root = new URL('../_site/', import.meta.url);
const registry = JSON.parse(await readFile(new URL('topics/topics.json', root), 'utf8')) as { topics: string[] };
const url = (path: string) => new URL(path, root).href;
const topic = url(`topics/${registry.topics[1]}/index.html`);

test('readers can turn animations off; the choice applies before first paint and stops the rotating phrases', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url('index.html'));
  await expect(page.locator('html')).not.toHaveAttribute('data-motion', 'reduce');
  await page.locator('.footer-shortcuts').click();
  const dialog = page.locator('.shortcuts-dialog');
  await expect(dialog).toHaveAccessibleName('Settings');
  const animations = dialog.getByRole('switch', { name: /Animations/ });
  await expect(animations).toBeChecked();
  await animations.uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  // Nothing moves: no running CSS animations, and the rotator holds its first phrase.
  const current = await page.locator('.rotator-item.is-current').first().textContent();
  await page.waitForTimeout(3400);
  await expect(page.locator('.rotator-item.is-current').first()).toHaveText(current!);
  expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
});

test('the device setting turns animations off and the switch says so instead of overriding it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url('index.html'));
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  await page.locator('.footer-shortcuts').click();
  const animations = page.getByRole('switch', { name: /Animations/ });
  await expect(animations).not.toBeChecked();
  await expect(animations).toBeDisabled();
  await expect(page.locator('[data-motion-device]')).toBeVisible();
});

test('single-key shortcuts can be turned off; modifier shortcuts keep working', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(topic);
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.locator('.footer-shortcuts').click();
  await page.getByRole('switch', { name: /Single-key shortcuts/ }).uncheck();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.locator('body').press('t');
  await page.locator('body').press('f');
  await page.locator('body').press('?');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme!);
  await expect(page.locator('body')).not.toHaveClass(/focus-mode/);
  await expect(page.locator('.shortcuts-dialog')).toBeHidden();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('.search-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-dialog')).toBeHidden();
  // Settings remain discoverable and usable after disabling their own shortcut and navigating.
  await page.goto(url('index.html'));
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  await expect(settings).toBeVisible();
  await expect(settings.locator('kbd')).toBeHidden();
  await settings.click();
  await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: /Single-key shortcuts/ })).not.toBeChecked();
  await page.getByRole('switch', { name: /Single-key shortcuts/ }).check();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-shortcuts');
  await page.locator('body').press('?');
  await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toBeVisible();
});

test('the Atlas topic drawer is modal: Tab stays inside and single keys do nothing behind it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(topic);
  await page.locator('.plates-trigger').click();
  await expect(page.locator('.plates-drawer')).toHaveAttribute('aria-modal', 'true');
  for (let press = 0; press < 12; press++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => document.activeElement === document.body || Boolean(document.activeElement?.closest('.plates-menu')));
    expect(inside).toBe(true);
  }
  await page.keyboard.press('j');
  await expect(page.locator('.plates-menu')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('.plates-menu')).not.toHaveAttribute('open', '');
  expect(await page.evaluate(() => [...document.querySelectorAll('[inert]')].length)).toBe(0);
});

test('status messages are announced through a live region that is always present', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(topic);
  const announcer = page.locator('[data-announcer]');
  await expect(announcer).toHaveAttribute('role', 'status');
  await expect(page.locator('.toast')).toHaveAttribute('aria-hidden', 'true');
  await page.locator('[data-copy]').first().click();
  await expect(announcer).toHaveText('Copied to clipboard');
});

test('controls are named by their visible text, and Escape in the outline find never drops focus', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('the-way-i-ai-design', 'folio'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(topic);
  await expect(page.locator('.collection-contents summary')).toHaveAccessibleName('The collection');
  await page.locator('body').press('/');
  await page.keyboard.type('worktree');
  await page.keyboard.press('Escape');
  await expect(page.locator('#section-search')).toBeFocused();
  await expect(page.locator('#section-search')).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(page.locator('#outline')).toBeFocused();
});
