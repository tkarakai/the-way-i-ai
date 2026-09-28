import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const root = new URL('../_site/', import.meta.url);
const registry = JSON.parse(await readFile(new URL('topics/topics.json', root), 'utf8')) as { topics: string[] };
const topicPath = `topics/${registry.topics[0]}/index.html`;
const url = (path: string) => new URL(path, root).href;

for (const width of [1440, 390, 320]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`all pages work offline at ${width}px in ${theme}`, async ({ page, context }) => {
      await context.setOffline(true);
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: theme });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const path of ['index.html', ...registry.topics.map(id => `topics/${id}/index.html`)]) {
        await page.goto(url(path));
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('.masthead a[href*="github.com"]')).toHaveCount(1);
        await expect(page.locator('.masthead').getByRole('link', { name: 'The collection', exact: true })).toHaveCount(0);
        const headerOrder = await page.locator('.masthead').evaluate(header => {
          const logo = header.querySelector('.brand');
          const search = header.querySelector('[data-open-search]')!;
          const actions = header.querySelector('.header-actions')!;
          return (logo ? logo.nextElementSibling === search && logo.getBoundingClientRect().right <= search.getBoundingClientRect().left : header.firstElementChild === search)
            && search.nextElementSibling === actions
            && search.getBoundingClientRect().right <= actions.getBoundingClientRect().left;
        });
        expect(headerOrder).toBe(true);
        await expect(page.locator('.collection-nav a[href*="github.com"],.footer a[href*="github.com"]')).toHaveCount(0);
        await expect(page.locator('.reading-status,.reading-track,[data-progress]')).toHaveCount(0);
        await expect(page.locator('[data-print]')).toHaveCount(0);
        await expect(page.getByText(/Print \/ save PDF/i)).toHaveCount(0);
        await expect(page.locator('.theme-toggle')).toHaveAccessibleName(`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`);
        await expect(page.locator(`.theme-toggle .theme-${theme === 'light' ? 'dark' : 'light'}`)).toBeVisible();
        await expect(page.locator(`.theme-toggle .theme-${theme}`)).not.toBeVisible();
        const layout = await page.evaluate(() => {
          const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
          return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            duplicates: ids.filter((id, i) => ids.indexOf(id) !== i),
            icons: [...document.querySelectorAll('.focus-toggle,.theme-toggle,.repo-link')].every(node => !node.textContent?.trim() && !!node.querySelector('svg')),
            code: [...document.querySelectorAll('diffs-container')].every(node => !!node.shadowRoot?.textContent),
          };
        });
        expect(layout).toEqual({ overflow: 0, duplicates: [], icons: true, code: true });
        await expect(page.getByText(/\d+ min read/i)).toHaveCount(0);
        if (path !== 'index.html') {
          await expect(page.locator('.collection-contents')).not.toHaveAttribute('open');
          await expect(page.locator('.prose').first()).toBeVisible();
          await expect(page.locator('.focus-toggle')).toHaveAccessibleName('Focus on reading');
          await expect(page.locator('.ambient-canvas')).toHaveCount(0);
          await expect(page.locator('.topic-dates time')).toHaveCount(2);
          await expect(page.locator('meta[property="article:published_time"]')).toHaveCount(1);
          await expect(page.locator('meta[property="article:modified_time"]')).toHaveCount(1);
        } else {
          await expect(page.locator('.topic-card')).toHaveCount(registry.topics.length);
          await expect(page.locator('.masthead .brand')).toHaveCount(0);
          await expect(page.locator('.wordmark .title-line')).toHaveCount(2);
          const headerAlignment = await page.evaluate(() => {
            document.querySelector('.collection-page')!.getAnimations({ subtree: true }).forEach(animation => animation.finish());
            const content = document.querySelector('.collection-list')!.getBoundingClientRect();
            const search = document.querySelector('.search-trigger')!.getBoundingClientRect();
            const repository = document.querySelector('.repo-link')!.getBoundingClientRect();
            return { search: search.left - content.left, repository: repository.right - content.right };
          });
          expect(headerAlignment.search).toBeCloseTo(0, 1);
          expect(headerAlignment.repository).toBeCloseTo(0, 1);
          await expect(page.locator('.collection-intro .intro-line')).toHaveCount(2);
          await expect(page.locator('body')).toHaveAttribute('data-ambient', 'F');
          await expect(page.locator('.ambient-canvas')).toHaveCSS('opacity', '0.2');
          await expect(page.locator('.ambient-canvas')).toHaveCSS('pointer-events', 'none');
          expect(await page.evaluate(() => getComputedStyle(document.body, '::before').animationName)).toBe('none');
        }
        await page.screenshot({ path: `test-results/folio-${path.replaceAll('/', '-')}-${width}-${theme}.png`, fullPage: false, animations: 'disabled' });
      }
      expect(errors).toEqual([]);
    });
  }
}

test('theme toggles in one click or keypress, shows the target icon, and returns to live System after idle expiry', async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto(url('index.html'));
  const toggle = page.locator('.theme-toggle');
  await expect(page.locator('.theme-picker,.theme-options,.theme-system')).toHaveCount(0);
  await expect(toggle).toHaveAccessibleName('Switch to dark theme');
  await expect(toggle.locator('.theme-dark')).toBeVisible();
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAccessibleName('Switch to light theme');
  await expect(toggle.locator('.theme-light')).toBeVisible();
  await expect(toggle.locator('.theme-dark')).not.toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.clock.fastForward(2 * 60 * 60 * 1000 + 1000);
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(toggle.locator('.theme-dark')).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle.locator('.theme-light')).toBeVisible();
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('sidebar starts collapsed, animates both ways, and persists after topic navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url(topicPath));
  const sidebar = page.locator('.collection-contents');
  const toggle = sidebar.locator('summary');
  const width = () => page.locator('.collection-nav').evaluate(node => node.getBoundingClientRect().width);
  expect(await width()).toBe(64);
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(sidebar).toHaveAttribute('open');
  const animated = await page.locator('.workspace').evaluate(node => node.getAnimations().some(animation => animation.playState === 'running'));
  expect(animated).toBe(true);
  await expect.poll(width).toBe(220);
  await toggle.click();
  await expect(sidebar).not.toHaveAttribute('open');
  await expect.poll(width).toBe(64);
  await toggle.click();
  await sidebar.locator('.nav-topic').last().click();
  await expect(page.locator('.collection-contents')).toHaveAttribute('open');
  await expect.poll(() => page.locator('.collection-nav').evaluate(node => node.getBoundingClientRect().width)).toBe(220);
});

for (const width of [1691, 1100]) {
  test(`left outline and header follow sidebar state at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1554 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(url(topicPath));
    await page.evaluate(() => document.fonts.ready);
    const geometry = () => page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const logo = box('.brand'), search = box('.search-trigger'), shell = box('.site-shell');
      const outline = box('.on-page'), article = box('.reading-main');
      return { logo: logo.left - shell.left, search: search.left, github: box('.repo-link').right,
        sidebar: box('.collection-nav').width, outlineRight: outline.right, articleLeft: article.left };
    });
    const collapsed = await geometry();
    expect(collapsed.logo).toBe(12);
    expect(collapsed.outlineRight).toBeLessThan(collapsed.articleLeft);
    expect(await page.locator('#main').evaluate(main => main.firstElementChild?.classList.contains('on-page'))).toBe(true);
    await page.locator('.collection-contents summary').click();
    const headerInset = width > 1200 ? 60 : 35;
    const sidebarWidth = width > 1200 ? 220 : 200;
    await expect.poll(async () => (await geometry()).sidebar).toBe(sidebarWidth);
    const expanded = await geometry();
    expect(expanded.logo).toBe(headerInset);
    expect(expanded.search - collapsed.search).toBeCloseTo(headerInset - 12, 1);
    expect(expanded.github).toBe(collapsed.github);
    expect(expanded.outlineRight).toBeLessThan(expanded.articleLeft);
    const navigationTop = await page.evaluate(() => {
      const textTop = (selector: string) => {
        const element = document.querySelector(selector)!;
        const node = [...element.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) ?? element.firstChild!;
        const range = document.createRange(); range.selectNodeContents(node); return range.getBoundingClientRect().top;
      };
      return [textTop('.collection-contents summary span'), textTop('.contents-label'), textTop('.breadcrumbs a')];
    });
    expect(Math.max(...navigationTop) - Math.min(...navigationTop)).toBeLessThanOrEqual(3);
    await page.screenshot({ path: `test-results/folio-left-navigation-expanded-${width}.png`, animations: 'disabled' });

    // Sample both actual CSS animations at halfway. Matching normalized travel
    // verifies synchronized motion rather than merely naming a transition in CSS.
    const midway = await page.evaluate(() => {
      document.querySelector<HTMLElement>('.collection-contents summary')!.click();
      const header = document.querySelector('.masthead')!, workspace = document.querySelector('.workspace')!;
      getComputedStyle(header).paddingLeft;
      getComputedStyle(workspace).gridTemplateColumns;
      const transitions = [header, workspace].map(node => node.getAnimations().find(animation =>
        animation instanceof CSSTransition && ['padding-left', 'grid-template-columns'].includes(animation.transitionProperty))!);
      transitions.forEach(animation => { animation.pause(); animation.currentTime = Number(animation.effect!.getTiming().duration) / 2; });
      return { inset: parseFloat(getComputedStyle(header).paddingLeft), sidebar: document.querySelector('.collection-nav')!.getBoundingClientRect().width };
    });
    const headerTravel = (headerInset - midway.inset) / (headerInset - 12);
    const sidebarTravel = (sidebarWidth - midway.sidebar) / (sidebarWidth - 64);
    expect(headerTravel).toBeGreaterThan(0);
    expect(headerTravel).toBeLessThan(1);
    expect(headerTravel).toBeCloseTo(sidebarTravel, 2);
    await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'paused').forEach(animation => animation.play()));
    await expect.poll(async () => (await geometry()).logo).toBe(12);
    await expect.poll(async () => (await geometry()).sidebar).toBe(64);
    expect((await geometry()).search).toBeCloseTo(collapsed.search, 1);

    // The outline remains sticky and its native anchor still reaches the section.
    const scrollEnd = page.evaluate(() => new Promise<void>(resolve => window.addEventListener('scrollend', () => resolve(), { once: true })));
    await page.locator('.toc-link', { hasText: 'Parallel Work' }).click();
    await scrollEnd;
    await expect(page).toHaveURL(/#worktrees-doc-2-parallel-work$/);
    await expect(page.locator('html')).toHaveClass(/is-scrolled/);
    await expect(page.locator('.contents')).toBeInViewport();
    await expect(page.locator('#worktrees-doc-2-parallel-work')).toBeInViewport();
    await expect.poll(() => page.locator('.masthead').evaluate(header => header.getBoundingClientRect().height)).toBe(60);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(page.locator('html')).not.toHaveClass(/is-scrolled/);
    await page.screenshot({ path: `test-results/folio-left-navigation-collapsed-${width}.png`, animations: 'disabled' });
  });
}

test('desktop navigation and reading columns can be resized with pointer and keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url(topicPath));
  await page.locator('.collection-contents summary').click();
  const collection = page.locator('.collection-nav');
  const collectionHandle = page.locator('.collection-resizer');
  await collectionHandle.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => collection.evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(230);
  await expect(collectionHandle).toHaveAttribute('aria-valuenow', '230');

  const toc = page.locator('.on-page');
  const tocHandle = page.locator('.toc-resizer');
  const before = await toc.evaluate(node => Math.round(node.getBoundingClientRect().width));
  const box = await tocHandle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 100);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 35, box!.y + 100);
  await page.mouse.up();
  await expect.poll(() => toc.evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(before + 35);
  await expect(tocHandle).toHaveAttribute('aria-valuenow', String(before + 35));

  const reading = page.locator('.reading-main');
  const readingHandle = page.locator('.reading-resizer');
  const initialReading = await reading.boundingBox();
  await readingHandle.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => reading.evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(Math.round(initialReading!.width) + 10);
  const resizedByKeyboard = await reading.boundingBox();
  expect(resizedByKeyboard!.x + resizedByKeyboard!.width / 2).toBeCloseTo(initialReading!.x + initialReading!.width / 2, 0);
  const readingHandleBox = await readingHandle.boundingBox();
  await page.mouse.move(readingHandleBox!.x + readingHandleBox!.width / 2, readingHandleBox!.y + 100);
  await page.mouse.down();
  await page.mouse.move(readingHandleBox!.x + readingHandleBox!.width / 2 + 25, readingHandleBox!.y + 100);
  await page.mouse.up();
  await expect.poll(() => reading.evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(Math.round(initialReading!.width) + 60);
  const resizedByPointer = await reading.boundingBox();
  expect(resizedByPointer!.x + resizedByPointer!.width / 2).toBeCloseTo(initialReading!.x + initialReading!.width / 2, 0);
  await expect(readingHandle).toHaveAttribute('aria-valuenow', String(Math.round(initialReading!.width) + 60));

  await page.reload();
  await expect(page.locator('.collection-contents')).toHaveAttribute('open');
  await expect.poll(() => page.locator('.collection-nav').evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(230);
  await expect.poll(() => page.locator('.on-page').evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(before + 35);
  await expect.poll(() => page.locator('.reading-main').evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(Math.round(initialReading!.width) + 60);
});

test('topic header shrinks on scroll and restores at the top without oscillating', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url(topicPath));
  const height = () => page.locator('.masthead').evaluate(node => node.getBoundingClientRect().height);
  await expect.poll(height).toBe(102);
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
  await expect.poll(height).toBe(60);
  await expect(page.locator('html')).toHaveClass(/is-scrolled/);
  await page.screenshot({ path: 'test-results/folio-compact-header.png' });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(height).toBe(102);
  await expect(page.locator('html')).not.toHaveClass(/is-scrolled/);
  await page.evaluate(() => window.scrollTo({ top: 130, behavior: 'instant' }));
  await expect.poll(height).toBe(60);
  await page.waitForTimeout(350); // Longer than the transition: catch threshold oscillation.
  expect(await height()).toBe(60);
});

test('search, section links, explorers, code copying, focus and print layout remain usable', async ({ page, context }) => {
  await context.setOffline(true);
  await page.goto(url(topicPath));
  await page.keyboard.press('ControlOrMeta+k');
  const search = page.getByRole('dialog');
  await expect(search).toBeVisible();
  const input = page.locator('#collection-search');
  await input.fill('permissions');
  await expect(page.locator('.search-result').first()).toBeVisible();
  expect(await page.locator('.search-results mark.search-hit').count()).toBeGreaterThan(0);
  await input.fill('zxxyynonexistent');
  await expect(page.locator('.search-result')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(search).not.toBeVisible();
  await page.keyboard.press('/');
  await expect(page.locator('#section-search')).toBeFocused();
  await expect(page.locator('#section-search')).toHaveCSS('outline-offset', '-2px');
  await page.locator('#section-search').fill('cleanup');
  await expect(page.locator('[data-search-status]')).toContainText('matching');
  expect(await page.locator('.article mark.search-hit').count()).toBeGreaterThan(0);
  await page.locator('#section-search').fill('Parallel Work');
  await expect(page.locator('.toc-link', { hasText: 'Parallel Work' }).locator('mark.search-hit')).toHaveCount(2);
  await expect(page.locator('#worktrees-doc-2-parallel-work mark.search-hit')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/folio-search-highlights.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.reading-main mark.search-hit,.contents mark.search-hit')).toHaveCount(0);
  await page.locator('.visual-guide summary').click();
  const control = page.locator('[data-select]').nth(1);
  await control.click();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  await control.press('ArrowRight');
  await expect(page.locator('[data-select]').nth(2)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.article [data-copy]').first().click();
  await expect(page.locator('.toast')).toHaveText(/Copied to clipboard/);
  const focus = page.locator('[data-focus]');
  await focus.click();
  const focusMotion = await page.evaluate(() => ({
    header: document.querySelector('.masthead')!.getAnimations().some(animation => animation.playState === 'running'),
    collection: document.querySelector('.collection-nav')!.getAnimations().some(animation => animation.playState === 'running'),
    workspace: document.querySelector('.workspace')!.getAnimations().some(animation => animation.playState === 'running'),
    outline: document.querySelector('.on-page')!.getAnimations().some(animation => animation.playState === 'running'),
    reading: document.querySelector('.reading-layout')!.getAnimations().some(animation => animation.playState === 'running'),
    icon: document.querySelector('[data-focus]')!.getAnimations().some(animation => animation.playState === 'running'),
  }));
  expect(focusMotion).toEqual({ header: true, collection: true, workspace: true, outline: true, reading: true, icon: true });
  await expect(page.locator('body')).toHaveClass(/focus-mode/);
  await expect(page.locator('.on-page')).not.toBeVisible();
  await expect(page.locator('.collection-nav')).not.toBeVisible();
  await expect(page.locator('.brand')).not.toBeVisible();
  await expect(focus).toHaveAccessibleName('Show navigation');
  await expect(focus).toHaveCSS('position', 'fixed');
  await page.waitForTimeout(350);
  const floating = await focus.boundingBox();
  const viewportWidth = await page.evaluate(() => innerWidth);
  expect(floating!.x + floating!.width).toBeGreaterThan(viewportWidth - 24);
  await page.screenshot({ path: 'test-results/folio-focus-mode.png', animations: 'disabled' });
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/focus-mode/);
  await expect(focus).toHaveAccessibleName('Show navigation');
  await page.keyboard.press('Escape');
  const restoreMotion = await page.evaluate(() => [
    document.querySelector('.masthead'), document.querySelector('.collection-nav'), document.querySelector('.workspace'),
    document.querySelector('.on-page'), document.querySelector('.reading-layout')
  ].every(node => node!.getAnimations().some(animation => animation.playState === 'running')));
  expect(restoreMotion).toBe(true);
  await expect(page.locator('body')).not.toHaveClass(/focus-mode/);
  await expect(page.locator('.on-page')).toBeVisible();
  await expect(page.locator('.masthead')).toBeVisible();
  await expect(focus).toHaveAccessibleName('Focus on reading');
  await page.locator('.visual-guide').evaluate((details: HTMLDetailsElement) => { details.open = false; });
  await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('.visual-guide')).toHaveAttribute('open');
  await page.evaluate(() => dispatchEvent(new Event('afterprint')));
  await expect(page.locator('.visual-guide')).not.toHaveAttribute('open');
  await page.locator('[data-open-search]').click();
  await input.fill('Create a worktree');
  await page.locator('.search-result').first().click();
  await expect(page).toHaveURL(/\?q=Create(?:\+|%20)a(?:\+|%20)worktree#worktrees-doc-/);
  await expect(search).not.toBeVisible();
  await expect(page.locator('#section-search')).toHaveValue('Create a worktree');
  expect(await page.locator('.article mark.search-hit').count()).toBeGreaterThan(0);
});

test('each topic restores its reading position', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(url(topicPath));
  await page.evaluate(() => scrollTo({ top: 700, behavior: 'instant' }));
  await page.waitForTimeout(500);
  const saved = await page.evaluate(() => Number(localStorage.getItem(`the-way-i-ai-scroll-${document.body.dataset.page}`)));
  expect(saved).toBeGreaterThan(600);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(Math.round(saved));
});

test('mobile focus mode collapses navigation without leaving empty space', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url(topicPath));
  const focus = page.locator('[data-focus]');
  await focus.click();
  await expect(page.locator('.collection-nav')).not.toBeVisible();
  await expect(page.locator('.on-page')).not.toBeVisible();
  await expect.poll(() => page.locator('.topic-hero').evaluate(node => Math.round(node.getBoundingClientRect().top))).toBeLessThan(80);
  await expect(focus).toHaveCSS('position', 'fixed');
  await focus.click();
  await expect(page.locator('.collection-nav')).toBeVisible();
  await expect(page.locator('.on-page')).toBeVisible();
});

test('the full article and native collection navigation work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto(url(topicPath));
  await expect(page.locator('.prose').first()).toBeVisible();
  await expect(page.locator('.theme-toggle')).not.toBeVisible();
  await page.locator('.collection-contents summary').click();
  await expect(page.locator('.collection-contents .nav-topic').first()).toBeVisible();
  await page.locator('.visual-guide summary').press('Enter');
  await expect(page.locator('.explorer-panel').last()).toBeVisible();
  await context.close();
});

test('reduced-motion users get immediate layout changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url(topicPath));
  await page.locator('.collection-contents summary').click();
  expect(await page.locator('.workspace').evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
  expect(await page.locator('.masthead').evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
  await expect(page.locator('html')).toHaveClass(/is-scrolled/);
  expect(await page.locator('.masthead').evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
});
