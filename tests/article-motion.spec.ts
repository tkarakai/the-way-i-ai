import { test, expect } from '@playwright/test';

const articleURL = new URL('../_site/topics/just-enough-context/index.html', import.meta.url).href;
const chapterID = 'just-enough-context-doc-1-project-context-intelligence';
const subsectionID = 'just-enough-context-doc-1-technical-considerations-to-explore';

for (const width of [1440, 390]) {
  test(`article title leads the opening section by 500ms at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      document.addEventListener('animationstart', event => {
        if (event.target instanceof Element && event.target.matches('.article-hero')) {
          event.target.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 0; });
        }
      });
    });
    await page.goto(articleURL);
    const hero = page.locator('.article-hero');
    const introduction = page.locator('.article-reveal').first();
    await expect(introduction).toHaveAttribute('data-entrance-delay', 'true');
    const animations = await page.evaluateHandle(() => {
      const elements = [document.querySelector('.article-hero')!, document.querySelector('.article-reveal')!];
      return elements.map(element => {
        const animation = element.getAnimations().find((item): item is CSSAnimation => item instanceof CSSAnimation && item.animationName === 'collection-enter')!;
        animation.pause(); animation.currentTime = 0;
        return animation;
      });
    });
    expect(await animations.evaluate(items => items.map(animation => ({ duration: animation.effect!.getTiming().duration, delay: animation.effect!.getTiming().delay })))).toEqual([{ duration: 800, delay: 0 }, { duration: 800, delay: 500 }]);
    await expect(hero).toHaveCSS('opacity', '0');
    await expect(introduction).toHaveCSS('opacity', '0');
    await animations.evaluate(items => { items[0].currentTime = 500; items[1].currentTime = 500; });
    expect(Number(await hero.evaluate(element => getComputedStyle(element).opacity))).toBeGreaterThan(.5);
    await expect(introduction).toHaveCSS('opacity', '0');
    await animations.evaluate(items => items.forEach(animation => animation.finish()));
    await expect(hero).toHaveCSS('opacity', '1');
    await expect(introduction).toHaveCSS('opacity', '1');
    await page.locator('.theme-toggle').click();
    await expect(hero).toHaveCSS('animation-name', 'none');
    await expect(introduction).toHaveCSS('animation-name', 'none');
  });

  test(`article chapters and subsections reveal independently, once, at ${width}px`, async ({ page, context }) => {
    await context.setOffline(true);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(articleURL);
    await page.evaluate(() => document.fonts.ready);
    const chapter = page.locator(`.article-reveal:has(> #${chapterID})`);
    const subsection = page.locator(`.article-reveal:has(> #${subsectionID})`);
    await expect(chapter).toHaveAttribute('data-reveal', 'pending');
    await expect(chapter).toHaveCSS('opacity', '0');
    await expect(subsection).toHaveAttribute('data-reveal', 'pending');
    await chapter.evaluate(section => section.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await expect(chapter).toHaveAttribute('data-reveal', 'entering');
    const animation = await chapter.evaluateHandle(section => {
      const entrance = section.getAnimations().find((item): item is CSSAnimation => item instanceof CSSAnimation && item.animationName === 'collection-enter')!;
      entrance.pause(); entrance.currentTime = 0;
      return entrance;
    });
    expect(await animation.evaluate(item => ({ duration: item.effect!.getTiming().duration, easing: (item.effect as KeyframeEffect).getKeyframes()[0].easing }))).toEqual({ duration: 800, easing: 'ease' });
    const start = await chapter.evaluate(section => {
      const style = getComputedStyle(section), matrix = new DOMMatrix(style.transform);
      return { opacity: style.opacity, scale: matrix.a, y: matrix.f, top: (section as HTMLElement).offsetTop, height: (section as HTMLElement).offsetHeight };
    });
    expect(start).toMatchObject({ opacity: '0', scale: .9, y: width > 760 ? -48 : -24 });
    await animation.evaluate(item => { item.currentTime = 400; });
    const middle = await chapter.evaluate(section => ({ opacity: Number(getComputedStyle(section).opacity), top: (section as HTMLElement).offsetTop, height: (section as HTMLElement).offsetHeight }));
    expect(middle.opacity).toBeGreaterThan(.5);
    expect(middle.opacity).toBeLessThan(1);
    expect([middle.top, middle.height]).toEqual([start.top, start.height]);
    await page.screenshot({ path: `test-results/article-reveal-${width}-midpoint.png` });
    await animation.evaluate(item => item.finish());
    await expect(chapter).toHaveAttribute('data-reveal', 'shown');
    await expect(chapter).toHaveCSS('transform', 'none');
    await expect(subsection).toHaveAttribute('data-reveal', 'pending');
    await subsection.evaluate(section => section.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await expect(subsection).toHaveAttribute('data-reveal', 'entering');
    await subsection.evaluate(section => section.getAnimations().forEach(item => item.finish()));
    await expect(subsection).toHaveAttribute('data-reveal', 'shown');
    await chapter.evaluate(section => section.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await expect(chapter).toHaveCSS('animation-name', 'none');
    await page.locator('.theme-toggle').click();
    await expect(chapter).toHaveAttribute('data-reveal', 'shown');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
}

test('anchors, keyboard focus, and local search bypass article entrances', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${articleURL}#${subsectionID}`);
  const subsection = page.locator(`.article-reveal:has(> #${subsectionID})`);
  await expect(subsection).toHaveAttribute('data-reveal', 'shown');
  await expect(subsection).toHaveCSS('opacity', '1');
  await page.locator('#just-enough-context-doc-1-possible-phased-exploration .heading-link').focus();
  await expect(page.locator('.article-reveal').last()).toHaveAttribute('data-reveal', 'shown');
  await page.locator('#section-search').fill('token budget');
  await expect(page.locator('.article-reveal[data-reveal="pending"],.article-reveal[data-reveal="entering"]')).toHaveCount(0);
  await expect(page.locator('.toc-chapter > .toc-link:visible')).toHaveText('Just Enough Context');
  await expect(page.locator('.prose mark.search-hit').first()).toBeVisible();
});

test('reduced motion, printing, browser find, and unavailable observers keep the entire article readable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(articleURL);
  await expect(page.locator('.article-reveal[data-reveal="pending"]').first()).toHaveCSS('opacity', '0');
  await page.emulateMedia({ media: 'print' });
  expect(await page.locator('.article-reveal').evaluateAll(sections => sections.every(section => getComputedStyle(section).opacity === '1' && getComputedStyle(section).animationName === 'none'))).toBe(true);
  await page.emulateMedia({ media: 'screen', reducedMotion: 'reduce' });
  await expect(page.locator('.article-reveal[data-reveal="pending"],.article-reveal[data-reveal="entering"]')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true })));
  await expect(page.locator('.article-reveal[data-reveal="pending"]')).toHaveCount(0);
  await page.addInitScript(() => { Object.defineProperty(window, 'IntersectionObserver', { value: undefined }); });
  await page.reload();
  await expect(page.locator('.article-reveal[data-reveal="pending"]')).toHaveCount(0);
  expect(await page.locator('.article-reveal').evaluateAll(sections => sections.every(section => getComputedStyle(section).opacity === '1'))).toBe(true);
});
