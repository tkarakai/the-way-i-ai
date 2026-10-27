import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Lexer, type Tokens } from 'marked';
import { splitFrontMatter } from '../scripts/markdown-source.ts';

const root = new URL('../_site/', import.meta.url);
const articleURL = new URL('topics/just-enough-context/index.html', root).href;
const markdown = await readFile(new URL('topics/just-enough-context/README.md', root), 'utf8');
const { body, metadata } = splitFrontMatter(markdown, 'README.md');
const headings = new Lexer().lex(body).filter((token): token is Tokens.Heading => token.type === 'heading');
const title = headings.find(heading => heading.depth === 1)!.text;
const chapters = headings.filter(heading => heading.depth === 2);
const subsections = headings.filter(heading => heading.depth === 3);

for (const width of [1440, 390, 320]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`article hierarchy and navigation work offline at ${width}px in ${theme}`, async ({ page, context }) => {
      await context.setOffline(true);
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(articleURL);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('h1')).toHaveText(title);
      await expect(page.locator('.source-heading,.source-title,.toc-group')).toHaveCount(0);
      await expect(page.locator('.topic-hero .lead')).toHaveText(String(metadata!.description));
      await expect(page.locator('.prose')).not.toContainText('description:');
      await expect(page.locator('.prose h2').first()).toHaveText('Introduction');
      await expect(page.locator('.prose blockquote').first()).toContainText('Vision:');
      await expect(page.locator('.article-reveal').first().locator('blockquote').last()).toContainText('Vision:');
      await expect(page.locator('.prose h2').nth(1)).toHaveText('TL;DR');
      expect(headings.every(heading => !/^\d+[.\s]/.test(heading.text))).toBe(true);
      await expect(page.locator('.prose')).not.toContainText('Terminology and one-sentence vision');
      await expect(page.locator('.article')).not.toContainText(/Working draft|Version 3|Concept essay|October 26, 2026/);
      expect(await page.locator('.toc-chapter > .toc-link').allTextContents()).toEqual(chapters.map(heading => heading.text));
      expect(await page.locator('.toc-chapter > ol > li > .toc-link').allTextContents()).toEqual(subsections.map(heading => heading.text));
      expect(await page.locator('.toc-chapter').evaluateAll(items => items.slice(0, 4).map(item => getComputedStyle(item).marginTop)))
        .toEqual(['0px', '8px', '8px', '22px']);
      const rhythm = await page.evaluate(() => {
        const first = document.querySelector<HTMLElement>('.prose h2')!;
        const chapter = document.querySelectorAll<HTMLElement>('.prose h2')[1];
        const subsection = document.querySelectorAll<HTMLElement>('.prose h3')[1];
        const hero = document.querySelector('.editorial-hero');
        const opening = hero ?? document.querySelector('.topic-dates') ?? document.querySelector('.topic-hero .lead')!;
        return {
          hasHero: Boolean(hero),
          firstGap: first.getBoundingClientRect().top - opening.getBoundingClientRect().bottom,
          firstMargin: getComputedStyle(first).marginTop,
          firstBorder: getComputedStyle(first).borderTopWidth,
          firstMark: getComputedStyle(first, '::before').display,
          chapterBorder: getComputedStyle(chapter).borderTopWidth,
          chapterRule: getComputedStyle(chapter, '::before').backgroundImage,
          subsectionMark: getComputedStyle(subsection, '::before').width,
          titleColor: getComputedStyle(document.querySelector('h1')!).color,
          chapterColor: getComputedStyle(chapter).color,
          subsectionColor: getComputedStyle(subsection).color,
        };
      });
      expect(rhythm.firstGap).toBeGreaterThanOrEqual(16);
      expect(rhythm.firstGap).toBeLessThanOrEqual(rhythm.hasHero ? 64 : 40);
      expect(rhythm).toMatchObject({ firstMargin: '0px', firstBorder: '0px', firstMark: 'none', chapterBorder: '0px', subsectionMark: '44px' });
      expect(rhythm.chapterRule).toContain('linear-gradient');
      expect(rhythm.chapterRule).toMatch(/^linear-gradient\(to right, rgb\(/);
      expect(rhythm.chapterRule).toContain('rgba(0, 0, 0, 0)');
      expect(rhythm).toMatchObject(theme === 'light'
        ? { titleColor: 'rgb(106, 73, 102)', chapterColor: 'rgb(40, 105, 107)', subsectionColor: 'rgb(134, 83, 68)' }
        : { titleColor: 'rgb(205, 177, 202)', chapterColor: 'rgb(148, 201, 197)', subsectionColor: 'rgb(220, 178, 154)' });
      await page.screenshot({ path: `test-results/article-${width}-${theme}.png`, animations: 'disabled' });

      if (width < 960) await page.locator('.contents > summary').click();
      const nestedLink = page.locator('.toc-chapter > ol .toc-link').first();
      await expect(nestedLink).toBeVisible();
      const target = await nestedLink.getAttribute('href');
      await nestedLink.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`${target}$`));
      await expect(page.locator(target!)).toBeInViewport();
      if (width >= 960) await expect(nestedLink).toHaveAttribute('aria-current', 'location');

      // A subsection match must retain its containing chapter and stay navigable.
      if (width < 960) await page.locator('.contents > summary').click();
      const search = page.locator('#section-search');
      await search.fill('token budget');
      await expect(page.locator('.toc-chapter:visible')).toHaveCount(1);
      await expect(nestedLink).toBeVisible();
      await expect(page.locator('.toc-chapter > .toc-link:visible')).toHaveText('Just Enough Context');
      await expect(page.locator('.prose mark.search-hit').first()).toBeVisible();
      await search.focus();
      await page.keyboard.press('Escape');
      expect(await page.locator('.toc-chapter:visible').count()).toBe(chapters.length);

      await page.goto(`${articleURL}#just-enough-context-doc-1-just-enough-context`);
      await page.screenshot({ path: `test-results/article-sections-${width}-${theme}.png`, animations: 'disabled' });

      // Collection search's introduction link still targets the single page title.
      await page.goto(`${articleURL}#just-enough-context-doc-1-title`);
      await expect(page.locator('h1')).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    });
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`JEC leads the homepage with its delivered illustration in ${theme}`, async ({ page, context }) => {
    await context.setOffline(true);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(new URL('index.html', root).href);
      await page.evaluate(() => document.fonts.ready);
      const card = page.locator('.topic-card').first();
      await expect(card).toHaveAttribute('href', 'topics/just-enough-context/index.html');
      await expect(card).toHaveAccessibleName(title);
      await expect(card.locator('.topic-visual img')).toBeVisible();
      await expect(card.locator('.topic-visual img')).toHaveAttribute('src', /^data:image\/(?:png|webp);base64,/);
      expect(await card.locator('.topic-visual img').evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1600, 900]);
      await card.screenshot({ path: `test-results/jec-cover-${width}-${theme}.png`, animations: 'disabled' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    }
  });
}

test('article chapters and nested links remain available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, offline: true });
  const page = await context.newPage();
  await page.goto(articleURL);
  await expect(page.locator('.toc-chapter > ol .toc-link').first()).toBeVisible();
  await expect(page.locator('.prose')).toContainText('Knowing when enough is enough');
  await page.locator('.toc-chapter > ol .toc-link').first().click();
  await expect(page.locator('#just-enough-context-doc-1-core-principle')).toBeInViewport();
  await context.close();
});
