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
          const logo = header.querySelector('.brand')!;
          const search = header.querySelector('[data-open-search]')!;
          const actions = header.querySelector('.header-actions')!;
          return logo.nextElementSibling === search && search.nextElementSibling === actions
            && logo.getBoundingClientRect().right <= search.getBoundingClientRect().left
            && search.getBoundingClientRect().right <= actions.getBoundingClientRect().left;
        });
        expect(headerOrder).toBe(true);
        await expect(page.locator('.collection-nav a[href*="github.com"],.footer a[href*="github.com"]')).toHaveCount(0);
        await expect(page.locator('.reading-status,.reading-track,[data-progress]')).toHaveCount(0);
        await expect(page.locator('.theme-picker summary')).toHaveAccessibleName('Color theme: System. Choose a theme');
        const layout = await page.evaluate(() => {
          const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
          return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            duplicates: ids.filter((id, i) => ids.indexOf(id) !== i),
            icons: [...document.querySelectorAll('.theme-picker summary,.theme-options button,.repo-link')].every(node => !node.textContent?.trim() && !!node.querySelector('svg')),
            code: [...document.querySelectorAll('diffs-container')].every(node => !!node.shadowRoot?.textContent),
          };
        });
        expect(layout).toEqual({ overflow: 0, duplicates: [], icons: true, code: true });
        if (path !== 'index.html') {
          await expect(page.locator('.collection-contents')).not.toHaveAttribute('open');
          await expect(page.locator('.prose').first()).toBeVisible();
        } else {
          await expect(page.locator('.topic-card')).toHaveCount(registry.topics.length);
          await expect(page.locator('.wordmark .title-line')).toHaveCount(4);
        }
        await page.screenshot({ path: `test-results/folio-${path.replaceAll('/', '-')}-${width}-${theme}.png`, fullPage: false, animations: 'disabled' });
      }
      expect(errors).toEqual([]);
    });
  }
}

test('theme icons support keyboard choice, persistence and live System changes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(url('index.html'));
  const picker = page.locator('.theme-picker summary');
  await picker.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'System theme', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dark theme', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(picker).toBeFocused();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await picker.click();
  await page.getByRole('button', { name: 'System theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await picker.click();
  await expect(page.getByRole('button', { name: 'System theme', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('.theme-picker')).not.toHaveAttribute('open');
});

test('sidebar starts collapsed, animates both ways, and resets after topic navigation', async ({ page }) => {
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
  await expect(sidebar).not.toHaveAttribute('open');
  await expect.poll(width).toBe(64);
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

test('search, section links, explorers, code copying, focus and print remain usable', async ({ page, context }) => {
  await context.setOffline(true);
  await page.goto(url(topicPath));
  await page.keyboard.press('ControlOrMeta+k');
  const search = page.getByRole('dialog');
  await expect(search).toBeVisible();
  const input = page.locator('#collection-search');
  await input.fill('permissions');
  await expect(page.locator('.search-result').first()).toBeVisible();
  await input.fill('zxxyynonexistent');
  await expect(page.locator('.search-result')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(search).not.toBeVisible();
  await page.keyboard.press('/');
  await expect(page.locator('#section-search')).toBeFocused();
  await page.locator('#section-search').fill('cleanup');
  await expect(page.locator('[data-search-status]')).toContainText('matching');
  await page.keyboard.press('Escape');
  await page.locator('.visual-guide summary').click();
  const control = page.locator('[data-select]').nth(1);
  await control.click();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  await control.press('ArrowRight');
  await expect(page.locator('[data-select]').nth(2)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.article [data-copy]').first().click();
  await expect(page.locator('.toast')).toHaveText(/Copied to clipboard/);
  await page.locator('[data-focus]').click();
  await expect(page.locator('.on-page')).not.toBeVisible();
  await page.locator('[data-focus]').click();
  await expect(page.locator('.on-page')).toBeVisible();
  await page.locator('.visual-guide summary').click();
  await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('.visual-guide')).toHaveAttribute('open');
  await page.evaluate(() => dispatchEvent(new Event('afterprint')));
  await expect(page.locator('.visual-guide')).not.toHaveAttribute('open');
  await page.locator('[data-open-search]').click();
  await input.fill('Create a worktree');
  await page.locator('.search-result').first().click();
  await expect(page).toHaveURL(/#worktrees-doc-/);
  await expect(search).not.toBeVisible();
});

test('the full article and native collection navigation work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto(url(topicPath));
  await expect(page.locator('.prose').first()).toBeVisible();
  await expect(page.locator('.theme-picker')).not.toBeVisible();
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
