import { test, expect, type Page } from '@playwright/test';

const home = new URL('../_site/index.html', import.meta.url).href;
const topic = new URL('../_site/topics/worktrees/index.html', import.meta.url).href;

const entranceCount = (page: Page) => page.locator('.collection-page').evaluate(node => node.getAnimations({ subtree: true })
  .filter(animation => animation instanceof CSSAnimation && animation.animationName === 'collection-enter').length);

async function pauseEntrance(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelector('.collection-page')?.getAnimations({ subtree: true }).forEach(animation => {
        if (animation instanceof CSSAnimation && animation.animationName === 'collection-enter') {
          animation.pause(); animation.currentTime = 0;
        }
      });
    });
  });
  await page.goto(home);
  await page.evaluate(() => document.fonts.ready);
}

for (const width of [1440, 390, 320]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`homepage enters in two ordered stages at ${width}px in ${theme}`, async ({ page, context }) => {
      await context.setOffline(true);
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
      await pauseEntrance(page);
      const animations = await page.locator('.collection-page').evaluateHandle(node => node.getAnimations({ subtree: true })
        .filter((animation): animation is CSSAnimation => animation instanceof CSSAnimation && animation.animationName === 'collection-enter'));
      expect(await animations.evaluate(items => items.map(animation => {
        const effect = animation.effect as KeyframeEffect;
        const timing = effect.getTiming();
        // CSS timing functions live on keyframe intervals, not effect timing.
        return { duration: timing.duration, delay: timing.delay, fill: timing.fill, easing: effect.getKeyframes()[0].easing, iterations: timing.iterations };
      }))).toEqual([
        { duration: 800, delay: 0, fill: 'backwards', easing: 'ease', iterations: 1 },
        { duration: 1000, delay: 600, fill: 'backwards', easing: 'ease', iterations: 1 },
      ]);
      const sample = (time: number) => animations.evaluate((items, time) => {
        items.forEach(animation => { animation.currentTime = time; });
        const sections = [...document.querySelectorAll<HTMLElement>('.collection-hero,.collection-list')];
        return {
          sections: sections.map(node => {
            const style = getComputedStyle(node), transform = new DOMMatrix(style.transform);
            return { opacity: Number(style.opacity), scale: transform.a, y: transform.f, transform: style.transform };
          }),
          layout: sections.map(node => [node.offsetTop, node.offsetHeight, node.offsetWidth]),
          overflow: document.documentElement.scrollWidth - innerWidth,
          headerOpacity: getComputedStyle(document.querySelector('.masthead')!).opacity,
        };
      }, time);
      const start = await sample(0);
      expect(start.sections.map(section => section.opacity)).toEqual([0, 0]);
      expect(start.sections.map(section => section.scale)).toEqual([.9, .9]);
      expect(start.sections.map(section => section.y)).toEqual(width > 760 ? [-64, -48] : [-32, -24]);
      expect(start.headerOpacity).toBe('1');
      const first = await sample(300);
      expect(first.sections[0].opacity).toBeGreaterThan(.5);
      expect(first.sections[0].opacity).toBeLessThan(1);
      expect(first.sections[1].opacity).toBe(0);
      await page.screenshot({ path: `test-results/entrance-${width}-${theme}-first-stage.png` });
      const second = await sample(800);
      expect(second.sections[0].opacity).toBe(1);
      expect(second.sections[1].opacity).toBeGreaterThan(0);
      expect(second.sections[1].opacity).toBeLessThan(.5);
      await page.screenshot({ path: `test-results/entrance-${width}-${theme}-second-stage.png` });
      const end = await sample(1600);
      expect(end.sections.map(section => [section.opacity, section.transform])).toEqual([[1, 'none'], [1, 'none']]);
      for (const state of [start, first, second, end]) {
        expect(state.layout).toEqual(start.layout);
        expect(state.overflow).toBe(0);
      }
      await animations.evaluate(items => items.forEach(animation => animation.finish()));
      await page.locator('.theme-toggle').click();
      await page.setViewportSize({ width: width === 1440 ? 1280 : 360, height: 1000 });
      expect(await entranceCount(page)).toBe(0);
      await page.reload();
      expect(await entranceCount(page)).toBe(2);
    });
  }
}

test('keyboard focus finishes the entrance immediately and never restarts it on blur', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await pauseEntrance(page);
  const card = page.locator('.topic-card').first();
  await card.focus();
  await expect(card).toBeFocused();
  for (const selector of ['.collection-hero', '.collection-list']) {
    await expect(page.locator(selector)).toHaveCSS('opacity', '1');
    await expect(page.locator(selector)).toHaveCSS('transform', 'none');
  }
  await page.locator('.theme-toggle').focus();
  expect(await entranceCount(page)).toBe(0);
  await page.goto(topic);
  expect(await page.evaluate(() => document.getAnimations().some(animation => animation instanceof CSSAnimation && animation.animationName === 'collection-enter'))).toBe(false);
});

for (const mode of ['reduced motion', 'print'] as const) {
  test(`homepage is immediately readable with ${mode}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: mode === 'reduced motion' ? 'reduce' : 'no-preference', media: mode === 'print' ? 'print' : 'screen' });
    await page.goto(home);
    for (const selector of ['.collection-hero', '.collection-list']) {
      await expect(page.locator(selector)).toHaveCSS('animation-name', 'none');
      await expect(page.locator(selector)).toHaveCSS('opacity', '1');
      await expect(page.locator(selector)).toHaveCSS('transform', 'none');
    }
  });
}

test('CSS entrance and immediate keyboard focus work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'no-preference' });
  try {
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(home);
    await expect(page.locator('.collection-list')).toHaveCSS('animation-name', 'collection-enter');
    const card = page.locator('.topic-card').first();
    await card.focus();
    await expect(page.locator('.collection-list')).toHaveCSS('opacity', '1');
    await expect(page.locator('.collection-list')).toHaveCSS('transform', 'none');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(topic);
    await expect(page.locator('.prose').first()).toBeVisible();
  } finally { await context.close(); }
});
