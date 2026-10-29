import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const root = new URL('../_site/', import.meta.url);
const registry = JSON.parse(await readFile(new URL('topics/topics.json', root), 'utf8')) as { topics: string[] };
const url = (path: string) => new URL(path, 'http://127.0.0.1:4193/').href;
const pages = ['index.html', 'general-index/index.html', ...registry.topics.map(id => `topics/${id}/index.html`)];

for (const width of [1440, 390, 320]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`Field Atlas is the default and fits at ${width}px in ${theme}`, async ({ page, context }) => {
      await context.route(/^https?:/, route => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
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
    await page.waitForLoadState();
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
    await expect(next).toHaveAttribute('src', /^\.\.\/\.\.\/assets\/.*-360-[a-f0-9]+\.webp$/);
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

test('focus mode still animates after switching designs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url(`topics/${registry.topics[0]}/index.html`));
  await page.evaluate(() => document.fonts.ready);
  for (const design of ['folio', 'atlas'] as const) {
    await page.locator(`[data-design-choice="${design}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-design', design);
    await expect(page.locator('html')).not.toHaveClass(/design-switching/);
    await page.locator('[data-focus]').click();
    expect(await page.evaluate(() => document.getAnimations().filter(animation => animation instanceof CSSTransition).length), design).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
  }
});

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

for (const design of ['atlas', 'folio'] as const) {
  test(`${design}: every logo menu choice plays with the mouse, and keyboard selection and dismissal work`, async ({ page, context }) => {
    await context.addInitScript(choice => localStorage.setItem('the-way-i-ai-design', choice), design);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url('index.html'));
    const logo = page.locator('.hero-wordmark .wordmark');
    const picker = page.getByRole('dialog', { name: 'Logo tricks' });
    for (const trick of tricks) {
      await page.locator('body').press('a');
      await page.keyboard.press('i');
      await picker.locator(`[data-pick="${trick}"]`).click();
      await expect(picker).toHaveCount(0);
      await expect(logo).toHaveAttribute('data-trick', trick);
      expect(await logo.evaluate(node => node.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'))).toBe(true);
      // Finish each performance so every choice starts from rest, on the real browser clock.
      await logo.evaluate(node => node.parentElement!.getAnimations({ subtree: true }).filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity).forEach(animation => animation.finish()));
      await expect(logo).not.toHaveAttribute('data-trick');
    }
    await page.keyboard.type('ai');
    await page.keyboard.press('ArrowDown');
    await expect(picker.locator('[data-pick="glow"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(logo).toHaveAttribute('data-trick', 'glow');
    await expect(picker).toHaveCount(0);
    await page.keyboard.type('ai');
    // Tab away from the final item dismisses the nonmodal menu.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Tab');
    await expect(picker).toHaveCount(0);
    await page.locator('body').press('a');
    await page.keyboard.press('i');
    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);
  });
}

for (const design of ['atlas', 'folio'] as const) {
  test(`${design}: F turns focus mode on and off, and is ignored while typing`, async ({ page, context }) => {
    await context.addInitScript(choice => localStorage.setItem('the-way-i-ai-design', choice), design);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url(`topics/${registry.topics[1]}/index.html`));
    await page.locator('body').press('f');
    await expect(page.locator('body')).toHaveClass(/focus-mode/);
    await page.locator('body').press('f');
    await expect(page.locator('body')).not.toHaveClass(/focus-mode/);
    await page.locator('#section-search').fill('f');
    await expect(page.locator('body')).not.toHaveClass(/focus-mode/);
  });
}

for (const design of ['atlas', 'folio'] as const) {
  test(`${design}: reading shortcuts move between chapters and topics, share, copy, and switch theme and design`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await context.addInitScript(choice => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('the-way-i-ai-design', choice); } }, design);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url(`topics/${registry.topics[1]}/index.html`));
    const chapters = page.locator('.toc-chapter > .toc-link');
    const body = page.locator('body');
    await body.press('j');
    await expect(page).toHaveURL(new RegExp(`${await chapters.nth(0).getAttribute('href')}$`));
    await body.press('j');
    await expect(page).toHaveURL(new RegExp(`${await chapters.nth(1).getAttribute('href')}$`));
    await expect(chapters.nth(1)).toHaveAttribute('aria-current', 'location');
    await body.press('k');
    await expect(page).toHaveURL(new RegExp(`${await chapters.nth(0).getAttribute('href')}$`));
    await expect(chapters.nth(0)).toHaveAttribute('aria-current', 'location');
    await body.press('c');
    await expect(page.locator('.toast')).toContainText('copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`https://thewayiai.com/topics/${registry.topics[1]}/${await chapters.nth(0).getAttribute('href')}`);
    await body.press('s');
    await expect(page.locator('.share-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.share-dialog')).toBeHidden();
    const theme = await page.locator('html').getAttribute('data-theme');
    await body.press('t');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', theme ?? '');
    await body.press('d');
    await expect(page.locator('html')).toHaveAttribute('data-design', design === 'atlas' ? 'folio' : 'atlas');
    await body.press('d');
    await expect(page.locator('html')).toHaveAttribute('data-design', design);
    await body.press(']');
    await expect(page).toHaveURL(new RegExp(`topics/${registry.topics[2]}/index.html`));
    await page.waitForLoadState();
    await page.locator('body').press('[');
    await expect(page).toHaveURL(new RegExp(`topics/${registry.topics[1]}/index.html`));
    await page.waitForLoadState();
    await page.locator('body').press('g');
    await page.locator('body').press('i');
    await expect(page).toHaveURL(/general-index\/index\.html$/);
    await page.waitForLoadState();
    await page.locator('body').press('g');
    await page.locator('body').press('h');
    await expect(page).toHaveURL(/\/index\.html$/);
    await expect(page.locator('body')).toHaveAttribute('data-page', 'collection');
  });
}

test('← → browse the topics on the home page without selecting the spread first', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url('index.html'));
  const title = page.locator('.spread-recto h3');
  const first = await title.innerText();
  await page.locator('body').press('ArrowRight');
  await expect(title).not.toHaveText(first);
  await page.locator('body').press('ArrowLeft');
  await expect(title).toHaveText(first);
});

test('home: J/K select topics in the list, the spread follows, and Enter opens the selection', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url('index.html'));
  const cards = page.locator('.topic-card');
  await page.locator('body').press('j');
  await expect(cards.nth(0)).toBeFocused();
  await page.keyboard.press('j');
  await expect(cards.nth(1)).toBeFocused();
  await expect(page.locator('[data-atlas-spread]')).toHaveAttribute('data-href', (await cards.nth(1).getAttribute('href'))!);
  await page.keyboard.press('End');
  await expect(cards.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(cards.first()).toBeFocused();
  await page.keyboard.press('j');
  const href = (await cards.nth(1).getAttribute('href'))!;
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(href.replace(/\./g, '\\.') + '$'));
});

test('home: the spread is one Tab stop; arrows select a topic and Enter opens it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url('index.html'));
  const spread = page.locator('[data-atlas-spread]');
  await expect(spread.locator('a:not([tabindex="-1"]), button:not([tabindex="-1"])')).toHaveCount(0);
  await page.locator('body').press('ArrowRight');
  await expect(spread).toBeFocused();
  const href = (await spread.getAttribute('data-href'))!;
  expect(href).toBe(`topics/${registry.topics.at(-2)}/index.html`);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(href.replace(/\./g, '\\.') + '$'));
});

for (const design of ['atlas', 'folio'] as const) {
  test(`${design}: skip links reach the text or the outline, J moves focus to the chapter, and G T shows all topics`, async ({ page, context }) => {
    await context.addInitScript(choice => localStorage.setItem('the-way-i-ai-design', choice), design);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url(`topics/${registry.topics[1]}/index.html`));
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link').first()).toHaveText('Skip to the text');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('#text')))).toBe(true);
    await page.locator('body').press('j');
    const first = await page.locator('.toc-chapter > .toc-link').first().getAttribute('href');
    await expect(page.locator(first!)).toBeFocused();
    await page.keyboard.press('g');
    await page.keyboard.press('t');
    if (design === 'atlas') await expect(page.locator('.plates-menu')).toHaveAttribute('open', '');
    else await expect(page.locator('.collection-contents')).toHaveAttribute('open', '');
    await expect(page.locator(design === 'atlas' ? '.drawer-plate[aria-current="page"]' : '.nav-topic[aria-current="page"]')).toBeFocused();
  });
}

test('the A–Z index steps through letters with J/K, and G A opens About', async ({ page }) => {
  await page.goto(url('general-index/index.html'));
  const letters = page.locator('.index-columns h2');
  await page.locator('body').press('j');
  await expect(letters.nth(0)).toBeFocused();
  await page.keyboard.press('j');
  await expect(letters.nth(1)).toBeFocused();
  await page.keyboard.press('g');
  await page.keyboard.press('a');
  await expect(page).toHaveURL(/about\/index\.html$/);
});

for (const design of ['atlas', 'folio'] as const) {
  test(`${design}: keys that need navigation leave focus mode; the others keep it`, async ({ page, context }) => {
    await context.addInitScript(choice => localStorage.setItem('the-way-i-ai-design', choice), design);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url(`topics/${registry.topics[1]}/index.html`));
    const body = page.locator('body');
    const focusMode = async () => { await body.press('f'); await expect(body).toHaveClass(/focus-mode/); };
    await focusMode();
    await body.press('j');
    await expect(body).toHaveClass(/focus-mode/);
    await page.keyboard.press('/');
    await expect(body).not.toHaveClass(/focus-mode/);
    await expect(page.locator('#section-search')).toBeFocused();
    await expect(page.locator('#section-search')).toBeVisible();
    await page.keyboard.press('Escape');
    await focusMode();
    await page.keyboard.press('g');
    await page.keyboard.press('t');
    await expect(body).not.toHaveClass(/focus-mode/);
    await expect(page.locator(design === 'atlas' ? '.plates-drawer' : '.collection-contents nav')).toBeVisible();
  });
}

test('modals keep the page behind them still while their own content scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 560 });
  await page.goto(url(`topics/${registry.topics[1]}/index.html`));
  const openers: [string, () => Promise<void>][] = [
    ['shortcuts', () => page.locator('body').press('?')],
    ['share', () => page.locator('body').press('s')],
    ['drawer', async () => { await page.locator('body').press('g'); await page.keyboard.press('t'); }],
  ];
  for (const [name, open] of openers) {
    await page.evaluate(() => scrollTo({ top: 3000, behavior: 'instant' }));
    // The header compacts after a jump and the page settles; measure once it has stopped moving.
    let before = -1;
    await expect.poll(async () => { const now = await page.evaluate(() => scrollY); const settled = now === before; before = now; return settled; }, { intervals: [150] }).toBe(true);
    await open();
    await expect(page.locator('dialog[open], .plates-menu[open]')).toHaveCount(1);
    for (let press = 0; press < 8; press++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('PageDown');
    expect(await page.evaluate(() => scrollY), name).toBe(before);
    if (name === 'shortcuts') expect(await page.locator('.shortcuts-dialog').evaluate(dialog => dialog.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open], .plates-menu[open]')).toHaveCount(0);
    expect(await page.evaluate(() => scrollY), name).toBe(before);
  }
});

test('“?” lists this page’s keyboard shortcuts and Esc closes them without leaving focus mode', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url(`topics/${registry.topics[1]}/index.html`));
  await page.locator('[data-focus]').click();
  await page.locator('body').press('?');
  const dialog = page.locator('.shortcuts-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Find on this page');
  await expect(dialog).toContainText('Previous or next topic');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('body')).toHaveClass(/focus-mode/);
  // The home page lists only the keys it understands.
  await page.goto(url('index.html'));
  await page.locator('.footer-shortcuts').click();
  await expect(page.locator('.shortcuts-dialog')).toContainText('Browse the topics');
  await expect(page.locator('.shortcuts-dialog')).not.toContainText('Find on this page');
});

test('the share button shows the page’s own card and copies its canonical link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url(`topics/${registry.topics[0]}/index.html`));
  await page.locator('.masthead [data-open-share]').click();
  const dialog = page.locator('.share-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toHaveText('Share this topic');
  const image = dialog.locator('.sharing-card img');
  await expect(image).toHaveAttribute('src', /^\.\.\/\.\.\/assets\/sharing\/.+\.jpg$/);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1200);
  await expect(dialog.locator('.sharing-title')).toHaveText(await page.locator('h1').innerText());
  const link = `https://thewayiai.com/topics/${registry.topics[0]}/`;
  await expect(dialog.locator('#share-url')).toHaveValue(link);
  await expect(dialog.locator('[data-share-target="linkedin"]')).toHaveAttribute('href', `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`);
  await dialog.locator('[data-copy-link]').click();
  await expect(dialog.locator('[data-copy-link]')).toHaveText('Copied ✓');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  // Phone topic pages have no room in the masthead; the topic ends with its own share button.
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.locator('.masthead [data-open-share]')).toBeHidden();
  await page.locator('.share-end button').click();
  await expect(dialog).toBeVisible();
});

test('the Atlas logo, content and GitHub icon share both edges at every width', async ({ page }) => {
  for (const width of [390, 900, 1180, 1440, 1728, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url(`topics/${registry.topics[1]}/index.html`));
    const edges = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      return [Math.round(box('.brand .wordmark').left) - Math.round(box('.frontis').left), Math.round(box('.repo-link').right) - Math.round(box('.frontis').right)];
    });
    expect(edges, `${width}px`).toEqual([0, 0]);
  }
});

test('dates read as how long ago, with the exact date on hover, and the A–Z index is in every footer', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-28T12:00:00'));
  await page.goto(url('topics/worktrees/index.html'));
  // Let the header's arrival finish, so the pointer stays over the date.
  await page.evaluate(() => document.getAnimations().forEach(animation => animation.finish()));
  const created = page.locator('.topic-dates time').first();
  await expect(created).toHaveAttribute('datetime', '2026-02-16');
  await expect(created.locator('.date-relative')).toHaveText('8 months ago');
  await expect(created.locator('.date-exact')).toHaveText('Feb 16, 2026');
  await expect(created.locator('.date-exact')).toHaveCSS('opacity', '0');
  await created.hover();
  await expect(created.locator('.date-exact')).toHaveCSS('opacity', '1');
  await page.locator('.footer-links').getByRole('link', { name: 'A–Z index' }).click();
  await expect(page).toHaveURL(/general-index\/index\.html$/);
});

for (const design of ['atlas', 'folio'] as const) {
  test(`${design}: the phone bottom bar shows the neighbouring animals`, async ({ page, context }) => {
    await context.addInitScript(choice => localStorage.setItem('the-way-i-ai-design', choice), design);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(url(`topics/${registry.topics[1]}/index.html`));
    await expect(page.locator('.plate-bar')).toBeVisible();
    await expect(page.locator('.plate-bar .bar-portrait')).toHaveCount(2);
    await expect(page.locator('.plate-bar a').first()).toHaveAccessibleName(/previous topic/);
  });
}

test('topics close with their own animal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(url(`topics/${registry.topics[1]}/index.html`));
  await expect(page.locator('[data-tailpiece] img')).toHaveCount(1);
});
