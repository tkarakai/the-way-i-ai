import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function tokenContrast(page: Page) {
  return page.locator('diffs-container [data-line] span').evaluateAll(spans => {
    const luminance = (colour: string) => {
      const [r, g, b] = colour.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(channel => {
        const value = channel / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      });
      return .2126 * r + .7152 * g + .0722 * b;
    };
    return spans.filter(span => span.textContent?.trim()).map(span => {
      const host = (span.getRootNode() as ShadowRoot).host;
      const foreground = getComputedStyle(span).color;
      const background = getComputedStyle(host.closest('.code-example')!).backgroundColor;
      const a = luminance(foreground), b = luminance(background);
      return { text: span.textContent, foreground, background, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
  });
}

for (const design of ['atlas', 'folio'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [1440, 390]) {
      test(`code syntax meets AA in ${design}, ${theme}, ${width}px, including a manual theme change`, async ({ page, context }) => {
        // Deliberately oppose the device theme: syntax must follow the reader's choice too.
        await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light', reducedMotion: 'reduce' });
        await page.setViewportSize({ width, height: 900 });
        await context.addInitScript(({ design, theme }) => {
          localStorage.setItem('the-way-i-ai-design', design);
          localStorage.setItem('the-way-i-ai-theme', JSON.stringify({ preference: theme, lastActivity: Date.now() }));
        }, { design, theme });
        await page.goto('http://127.0.0.1:4193/topics/worktrees/index.html');
        await expect(page.locator('html')).toHaveAttribute('data-design', design);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        for (let toggle = 0; toggle < 2; toggle++) {
          const tokens = await tokenContrast(page);
          expect(tokens.length).toBeGreaterThanOrEqual(20);
          expect(tokens.some(token => token.text?.startsWith('# Point these'))).toBe(true);
          for (const token of tokens) expect(token.ratio, JSON.stringify(token)).toBeGreaterThanOrEqual(4.5);
          if (toggle === 0) {
            await page.locator('diffs-container [data-line] span').filter({ hasText: /^# Point these/ }).first().scrollIntoViewIfNeeded();
            await page.screenshot({ path: `test-results/code-syntax-${design}-${theme}-${width}.png` });
            await page.locator('.theme-toggle').click();
            await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'light' ? 'dark' : 'light');
          }
        }
      });
    }
  }
}
