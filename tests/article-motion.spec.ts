import { test, expect } from './fixtures.ts';

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
    await page.addInitScript(() => {
      // Freeze the opening section when it enters, before slow image loading
      // can let animationend mark it shown and override the paused opacity.
      new MutationObserver(records => {
        for (const { target } of records) {
          if (!(target instanceof HTMLElement) || !target.matches('.article-reveal[data-entrance-delay="true"][data-reveal="entering"]')) continue;
          const animation = target.getAnimations().find((item): item is CSSAnimation => item instanceof CSSAnimation && item.animationName === 'collection-enter');
          if (animation) { animation.pause(); animation.currentTime = 0; }
        }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-reveal'] });
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

  test(`all initially visible chapters share the delayed opening timeline at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1500 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      document.addEventListener('animationstart', event => {
        if (event.target instanceof Element && event.target.matches('.article-hero')) {
          event.target.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 0; });
        }
      });
    });
    await page.addInitScript(() => {
      // Freeze the cohort as soon as the reader starts it, not after page.goto()
      // has waited for every embedded image to decode on a slower CI runner.
      new MutationObserver(records => {
        for (const { target } of records) {
          if (!(target instanceof HTMLElement) || !target.matches('.article-reveal[data-entrance-delay="true"][data-reveal="entering"]') || target.dataset.testInitialStart !== undefined) continue;
          const animation = target.getAnimations().find((item): item is CSSAnimation => item instanceof CSSAnimation && item.animationName === 'collection-enter');
          if (!animation) continue;
          target.dataset.testInitialStart = String(animation.startTime);
          animation.pause(); animation.currentTime = 250;
        }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-reveal'] });
    });
    await page.goto(new URL('../_site/topics/worktrees/index.html', import.meta.url).href);
    const cohort = page.locator('.article-reveal[data-entrance-delay="true"]');
    await expect.poll(() => cohort.count()).toBeGreaterThanOrEqual(3);
    expect(await cohort.locator(':scope > h2,:scope > h3').allTextContents()).toEqual(expect.arrayContaining(['Introduction', 'Overview', 'How it works']));
    const animations = await cohort.evaluateAll(sections => {
      const entrances = sections.map(section => section.getAnimations().find((animation): animation is CSSAnimation => animation instanceof CSSAnimation && animation.animationName === 'collection-enter')!);
      const starts = sections.map(section => (section as HTMLElement).dataset.testInitialStart);
      const delays = entrances.map(animation => animation.effect!.getTiming().delay);
      entrances.forEach(animation => { animation.pause(); animation.currentTime = 250; });
      return { starts, delays };
    });
    expect(new Set(animations.starts).size).toBe(1);
    expect(Number.isFinite(Number(animations.starts[0]))).toBe(true);
    expect(animations.delays.every(delay => delay === 500)).toBe(true);
    expect(await cohort.evaluateAll(sections => sections.every(section => getComputedStyle(section).opacity === '0'))).toBe(true);
    await cohort.evaluateAll(sections => sections.forEach(section => section.getAnimations().forEach(animation => { animation.currentTime = 850; })));
    const opacities = await cohort.evaluateAll(sections => sections.map(section => Number(getComputedStyle(section).opacity)));
    expect(Math.max(...opacities) - Math.min(...opacities)).toBeLessThan(.001);
    expect(opacities[0]).toBeGreaterThan(.5);
    expect(opacities[0]).toBeLessThan(1);
    await page.screenshot({ path: `test-results/article-initial-cohort-${width}.png` });
    await cohort.evaluateAll(sections => sections.forEach(section => section.getAnimations().forEach(animation => animation.finish())));
    await expect(page.locator('.article-reveal[data-reveal="pending"]').first()).toHaveCSS('opacity', '0');
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
    expect(await animation.evaluate(item => ({ duration: item.effect!.getTiming().duration, delay: item.effect!.getTiming().delay, easing: (item.effect as KeyframeEffect).getKeyframes()[0].easing }))).toEqual({ duration: 800, delay: 0, easing: 'ease' });
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
