import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const root = new URL('../_site/', import.meta.url);
const registry = JSON.parse(await readFile(new URL('topics/topics.json', root), 'utf8')) as { topics: string[] };
const url = (path: string) => new URL(path, root).href;
const pages = ['index.html', 'general-index/index.html', ...registry.topics.map(id => `topics/${id}/index.html`)];

for (const width of [1440, 390, 320]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`Field Atlas is the default and fits at ${width}px in ${theme}`, async ({ page, context }) => {
      await context.setOffline(true);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const path of pages) {
        await page.goto(url(path));
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('html')).toHaveAttribute('data-design', 'atlas');
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('.design-switch')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), path).toBe(0);
        // The approved lettering is unchanged: Newsreader, two lines, wave included.
        const wordmark = page.locator(path === 'index.html' ? '.hero-wordmark .wordmark' : '.brand .wordmark');
        expect(await wordmark.evaluate(node => getComputedStyle(node).fontFamily)).toContain('Newsreader');
        await expect(wordmark.locator('.title-art')).toHaveCount(1);
      }
      expect(errors).toEqual([]);
    });
  }
}

test('the design switch changes presentation in place, keeps the reading position and persists', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url(`topics/${registry.topics[0]}/index.html`));
  const heading = page.locator('.prose h2').nth(3);
  // The heading nearest the top of the reading area is the one kept in place.
  await heading.evaluate(node => { node.scrollIntoView({ block: 'start', behavior: 'instant' }); scrollBy({ top: -40, behavior: 'instant' }); });
  // Let the chapter finish its one-time entrance before measuring.
  await expect(heading.locator('xpath=..')).toHaveAttribute('data-reveal', 'shown');
  const settle = () => page.evaluate(() => document.getAnimations().forEach(animation => animation.finish()));
  await settle();
  const before = await heading.evaluate(node => node.getBoundingClientRect().top);
  const text = await page.locator('.article').textContent();
  // Pointer clicks in Playwright scroll sticky controls into view first; activate it as a reader would.
  await page.getByRole('button', { name: 'Folio' }).evaluate((button: HTMLElement) => button.click());
  await expect(page.locator('html')).toHaveAttribute('data-design', 'folio');
  await expect(page.getByRole('button', { name: 'Folio' })).toHaveAttribute('aria-pressed', 'true');
  await settle();
  expect(Math.abs(await heading.evaluate(node => node.getBoundingClientRect().top) - before)).toBeLessThan(4);
  expect(await page.locator('.article').textContent()).toBe(text);
  await expect(page.locator('.collection-nav')).toBeVisible();
  await expect(page.locator('.plate-margin')).toBeHidden();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-design', 'folio');
  await page.getByRole('button', { name: 'Atlas' }).click();
  await expect(page.locator('.plate-margin')).toBeVisible();
  await expect(page.locator('.collection-nav')).toBeHidden();
});

test('the home spread pages through plates with keys and reuses the card images', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url('index.html'));
  const spread = page.locator('[data-atlas-spread]');
  const newest = registry.topics.at(-1)!;
  await expect(spread.locator('.spread-recto h3 a')).toHaveAttribute('href', `topics/${newest}/index.html`);
  const cardSource = await page.locator(`.topic-card[href="topics/${newest}/index.html"] img`).getAttribute('src');
  await expect(spread.locator('.spread-verso img')).toHaveAttribute('src', cardSource!);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expect(spread.getByRole('button', { name: 'Newer topic' })).toBeDisabled();
  await spread.focus();
  await page.keyboard.press('ArrowRight');
  await expect(spread.locator('.spread-recto h3 a')).toHaveAttribute('href', `topics/${registry.topics.at(-2)}/index.html`);
  await expect(page.locator('[data-spread-status]')).toContainText('Topic');
  await page.keyboard.press('ArrowLeft');
  await expect(spread.locator('.spread-recto h3 a')).toHaveAttribute('href', `topics/${newest}/index.html`);
  // Every topic card remains one native link.
  await expect(page.locator('.topic-card a')).toHaveCount(0);
  const filter = page.locator('.habitat-filters button').nth(1);
  await filter.click();
  const habitat = await filter.getAttribute('data-habitat');
  for (const card of await page.locator('.topic-card').all()) {
    expect(await card.isVisible()).toBe(await card.getAttribute('data-habitat') === habitat);
  }
});

test('topic list drawer, running head and topic turning work on a topic page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const topic = registry.topics[1];
  await page.goto(url(`topics/${topic}/index.html`));
  await page.locator('.plates-menu summary').click();
  await expect(page.locator('.drawer-plate[aria-current="page"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.plates-menu')).not.toHaveAttribute('open', '');
  await expect(page.locator('.plates-menu summary')).toBeFocused();
  const runningHead = page.locator('.running-head');
  await expect(runningHead).not.toHaveClass(/is-on/);
  await page.locator('.prose h2').nth(2).scrollIntoViewIfNeeded();
  await expect(runningHead).toHaveClass(/is-on/);
  await expect(page.locator('[data-running-chapter]')).not.toBeEmpty();
  await page.locator('body').press(']');
  await expect(page).toHaveURL(new RegExp(`topics/${registry.topics[2]}/index.html`));
  await page.locator('body').press('[');
  await expect(page).toHaveURL(new RegExp(`topics/${topic}/index.html`));
});

test('the A–Z index lists authored headings and links to their anchors', async ({ page }) => {
  await page.goto(url('general-index/index.html'));
  const links = page.locator('.index-entry a');
  expect(await links.count()).toBeGreaterThan(40);
  const href = await links.first().getAttribute('href');
  const text = await links.first().locator('.index-text').innerText();
  await links.first().click();
  await expect(page).toHaveURL(url(`general-index/${href}`).replace('/general-index/../', '/'));
  await expect(page.locator(`[id="${decodeURIComponent(href!.split('#')[1])}"]`)).toHaveText(text);
});

for (const design of ['atlas', 'folio'] as const) {
  test(`${design}: focus mode hides navigation and the design switch, and next links show the neighbouring animal`, async ({ page, context }) => {
    await context.addInitScript(choice => localStorage.setItem('the-way-i-ai-design', choice), design);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url(`topics/${registry.topics[1]}/index.html`));
    await expect(page.locator('html')).toHaveAttribute('data-design', design);
    const next = page.locator(design === 'atlas' ? '[data-plate-next] img' : '.next-topic-portrait img');
    await expect(next).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
    expect(await next.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(360);
    if (design === 'atlas') await expect(page.locator('[data-plate-previous] img')).toHaveCount(1);
    await page.locator('[data-focus]').click();
    await expect(page.locator('body')).toHaveClass(/focus-mode/);
    await expect(page.locator('.design-switch')).toBeHidden();
    await expect(page.locator('.on-page')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('.design-switch')).toBeVisible();
  });
}

test('the topic list drawer slides closed and the browse picture opens its topic', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url('general-index/index.html'));
  await page.locator('.plates-menu summary').click();
  await expect(page.locator('.drawer-plate img').first()).toHaveJSProperty('complete', true);
  // The closing slide lasts 300ms, too briefly to poll for on a slow runner, so record it as it happens.
  await page.locator('.plates-menu').evaluate(menu => {
    const observer = new MutationObserver(() => { if (menu.classList.contains('is-closing')) { menu.dataset.sawClosing = 'true'; observer.disconnect(); } });
    observer.observe(menu, { attributes: true, attributeFilter: ['class'] });
  });
  await page.locator('[data-close-plates]').click();
  await expect(page.locator('.plates-menu')).toHaveAttribute('data-saw-closing', 'true');
  await expect(page.locator('.plates-menu')).not.toHaveAttribute('open', '');
  // The home page already presents every topic, so it has no topic list button.
  await page.goto(url('index.html'));
  await expect(page.locator('.plates-menu')).toHaveCount(0);
  await page.locator('.spread-plate-link').click();
  await expect(page).toHaveURL(new RegExp(`topics/${registry.topics.at(-1)}/index.html`));
});

for (const width of [1440, 900, 390, 320]) {
  test(`the header does not move when switching designs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ['index.html', `topics/${registry.topics[0]}/index.html`]) {
      await page.goto(url(path));
      await page.evaluate(() => document.fonts.ready);
      const layout = () => page.evaluate(() => ['.masthead', '.design-switch', '.theme-toggle', '.repo-link']
        .map(selector => { const box = document.querySelector(selector)!.getBoundingClientRect(); return [box.left, box.top, box.width, box.height].map(Math.round); }));
      const atlas = await layout();
      await page.locator('[data-design-choice="folio"]').evaluate((button: HTMLElement) => button.click());
      await expect(page.locator('html')).toHaveAttribute('data-design', 'folio');
      await page.evaluate(() => document.getAnimations().forEach(animation => animation.finish()));
      expect(await layout(), path).toEqual(atlas);
      await page.evaluate(() => localStorage.removeItem('the-way-i-ai-design'));
    }
  });
}

test('switching designs on the home page replays its arrival, as after a reload', async ({ page }) => {
  await page.goto(url('index.html'));
  await page.evaluate(() => document.getAnimations().filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity).forEach(animation => animation.finish()));
  for (const choice of ['folio', 'atlas']) {
    await page.locator(`[data-design-choice="${choice}"]`).evaluate((button: HTMLElement) => button.click());
    const running = await page.locator('.collection-intro').evaluate(node => node.getAnimations().some(animation => (animation as CSSAnimation).animationName === 'collection-enter' && animation.playState === 'running'));
    expect(running, choice).toBe(true);
    await page.evaluate(() => document.getAnimations().filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity).forEach(animation => animation.finish()));
  }
});

test('[a|b|c] collection copy rotates in order and loops; reduced motion and screen readers get stable text', async ({ page }) => {
  await page.clock.install();
  await page.goto(url('index.html'));
  const items = page.locator('.rotator-item');
  const options = await items.allTextContents();
  expect(options.length).toBeGreaterThan(2);
  await expect(page.locator('.rotator .sr-only')).toHaveText(options.join(', '));
  await expect(page.locator('.rotator-window')).toHaveAttribute('aria-hidden', 'true');
  const seen = [await page.locator('.rotator-item.is-current').textContent()];
  const current = () => page.locator('.rotator-item.is-current').textContent();
  for (let step = 0; step < options.length; step++) {
    // Each phrase stays 3s; advance until the next one arrives.
    const before = await current();
    for (let waited = 0; waited < 3500 && await current() === before; waited += 100) await page.clock.runFor(100);
    seen.push(await current());
  }
  expect(seen).toEqual([...options, options[0]]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const still = await page.locator('.rotator-item.is-current').textContent();
  await page.clock.runFor(10000);
  await expect(page.locator('.rotator-item.is-current')).toHaveText(still!);
});

const tricks = ['backflip', 'ripple', 'swap', 'wave', 'flicker', 'glow', 'butterfly', 'topple', 'timeTravel', 'magnet', 'glitch', 'origami'];

test('the home logo drops in, performs rare idle tricks without moving its letters, and the full stop chases each phrase', async ({ page }) => {
  await page.clock.install();
  await page.goto(url('index.html'));
  const logo = page.locator('.hero-wordmark .wordmark');
  await expect(logo.locator('.logo-word')).toHaveCount(2);
  await expect(logo.locator('.logo-stem, .logo-rest, .title-initial.logo-part')).toHaveCount(3);
  expect(await logo.locator('.logo-stem').evaluate(node => getComputedStyle(node).animationName)).toBe('logo-drop');
  await page.clock.runFor(3000);
  const positions = () => logo.locator('.logo-part').evaluateAll(parts => parts.map(part => Math.round(part.getBoundingClientRect().left)));
  const atRest = await positions();
  for (const trick of tricks) {
    await page.evaluate(name => document.dispatchEvent(new CustomEvent('logo-trick', { detail: name })), trick);
    await expect(logo).toHaveAttribute('data-trick', trick);
    // Animations run on real time even with a fake clock; finish the trick instead of waiting for it.
    await page.evaluate(() => document.querySelector('.hero-wordmark')!.getAnimations({ subtree: true }).filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity).forEach(animation => animation.finish()));
    await page.clock.runFor(100);
    await expect(logo).not.toHaveAttribute('data-trick');
    // Cleanup runs on the finish event, a moment after finishing.
    await expect.poll(positions, { message: trick }).toEqual(atRest);
    await expect(page.locator('.logo-temp, .logo-squiggle, .logo-butterfly, .logo-effects')).toHaveCount(0);
    await expect.poll(() => logo.evaluate(node => (node as HTMLElement).style.cssText), { message: trick }).toBe('');
  }
  // Idle: nothing before 20 seconds without activity, then one trick.
  await page.mouse.move(10, 10);
  await page.clock.runFor(15000);
  await expect(logo).not.toHaveAttribute('data-trick');
  await page.clock.runFor(7000);
  await expect(logo).toHaveAttribute('data-trick', new RegExp(`^(${tricks.join('|')})$`));
  // The full stop is its own element and moves on a phrase change.
  const tail = page.locator('.rotator-tail');
  await expect(tail).toHaveText('.');
  const current = () => page.locator('.rotator-item.is-current').textContent();
  const before = await current();
  for (let waited = 0; waited < 3500 && await current() === before; waited += 50) await page.clock.runFor(50);
  await page.clock.runFor(150);
  expect(await tail.evaluate(node => (node as HTMLElement).style.transform)).toContain('scale(');
  await page.clock.runFor(1000);
  expect(await tail.evaluate(node => (node as HTMLElement).style.transform)).toBe('');
});

test('reduced motion: no logo tricks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto(url('index.html'));
  await page.clock.runFor(60000);
  await expect(page.locator('.hero-wordmark .wordmark')).not.toHaveAttribute('data-trick');
});

test('secret: triple-click plays the next trick; typing “ai” opens a menu that plays exactly the chosen one', async ({ page }) => {
  await page.clock.install();
  await page.goto(url('index.html'));
  await page.clock.runFor(3000);
  const logo = page.locator('.hero-wordmark .wordmark');
  await logo.click({ clickCount: 3 });
  await page.clock.runFor(50);
  await expect(logo).toHaveAttribute('data-trick', new RegExp(`^(${tricks.join('|')})$`));
  await page.keyboard.type('ai');
  const picker = page.getByRole('dialog', { name: 'Logo tricks' });
  await expect(picker).toBeVisible();
  await expect(picker.locator('[data-pick]')).toHaveCount(tricks.length + 1);
  await expect(picker.getByRole('button', { name: 'Surprise me' })).toBeFocused();
  // Choosing a trick interrupts the one playing and plays exactly the choice.
  await picker.getByRole('button', { name: 'Magnet' }).click();
  await expect(picker).toHaveCount(0);
  await page.clock.runFor(100);
  await expect(logo).toHaveAttribute('data-trick', 'magnet');
  await page.keyboard.type('ai');
  await expect(picker).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
});
