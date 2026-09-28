import { test, expect } from '@playwright/test';

const previewURL = new URL('../previews/backgrounds.html', import.meta.url).href;

for (const theme of ['light', 'dark'] as const) {
  test(`six distinct background studies render offline in ${theme}`, async ({ page, context }) => {
    await context.setOffline(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(previewURL);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.lab-card')).toHaveCount(6);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.screenshot({ path: `test-results/backgrounds-gallery-${theme}.png`, fullPage: true });
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F']) {
      await page.locator(`[data-open-study="${id}"]`).click();
      const viewer = page.locator('.lab-viewer');
      await expect(viewer).toBeVisible();
      await expect(page.locator('#lab-stage-effect')).toHaveAttribute('data-effect', id);
      await expect(viewer.locator('[data-lab-content]')).toBeVisible();
      if (id !== 'A') {
        await expect(page.locator('#lab-stage-effect')).toHaveAttribute('data-frame');
        await expect.poll(() => page.locator('#lab-stage-effect canvas').evaluate((canvas: HTMLCanvasElement) => {
          const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
          return data.some((value, index) => index % 4 === 3 && value > 0);
        })).toBe(true);
      }
      await page.screenshot({ path: `test-results/backgrounds-${id}-${theme}-content.png` });
      await viewer.locator('[data-lab-content-toggle]').click();
      await expect(viewer.locator('[data-lab-content]')).not.toBeVisible();
      await page.screenshot({ path: `test-results/backgrounds-${id}-${theme}-alone.png` });
      await viewer.locator('[data-lab-content-toggle]').click();
      await page.keyboard.press('Escape');
      await expect(viewer).not.toBeVisible();
      await expect(page.locator(`[data-open-study="${id}"]`)).toBeFocused();
    }
    expect(errors).toEqual([]);
  });
}

for (const width of [320, 390]) {
  test(`background review fits ${width}px and keeps controls reachable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(previewURL);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await page.locator('[data-open-study="B"]').click();
    const dialog = page.locator('.lab-viewer');
    await expect(dialog.getByRole('button', { name: 'Background only', exact: true })).toBeInViewport();
    await expect(dialog.getByRole('button', { name: 'F: Murmuration', exact: true })).toBeInViewport();
    await page.screenshot({ path: `test-results/backgrounds-mobile-${width}.png` });
    expect(await dialog.evaluate(node => node.scrollWidth - node.clientWidth)).toBe(0);
    await dialog.locator('[data-lab-theme="dark"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#lab-stage-effect')).toHaveAttribute('data-effect', 'C');
  });
}

test('motion advances, pauses, and honors reduced motion with explicit opt-in', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${previewURL}#B`);
  const stage = page.locator('#lab-stage-effect');
  const dialog = page.locator('.lab-viewer');
  await expect(page.locator('body')).toHaveClass(/lab-paused/);
  await expect(stage).toHaveAttribute('data-frame');
  const still = await stage.getAttribute('data-frame');
  await page.waitForTimeout(180);
  expect(await stage.getAttribute('data-frame')).toBe(still);
  const stillPixels = await stage.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await dialog.getByRole('button', { name: 'Play motion', exact: true }).click();
  await expect.poll(() => stage.getAttribute('data-frame')).not.toBe(still);
  await expect.poll(async () => (await stage.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())) !== stillPixels).toBe(true);
  await dialog.getByRole('button', { name: 'Pause motion', exact: true }).click();
  await page.waitForTimeout(100);
  const stopped = await stage.getAttribute('data-frame');
  await page.waitForTimeout(180);
  expect(await stage.getAttribute('data-frame')).toBe(stopped);
  await dialog.locator('[data-lab-choice="A"]').click();
  await dialog.getByRole('button', { name: 'Play motion', exact: true }).click();
  expect(await stage.evaluate(node => getComputedStyle(node, '::before').animationName)).toBe('ambient-drift');
  await dialog.locator('#lab-strength').fill('40');
  await expect(dialog.locator('output')).toHaveText('40%');
});
