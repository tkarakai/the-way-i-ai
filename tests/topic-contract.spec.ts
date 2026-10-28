import { test, expect } from './fixtures.ts';
import { readFile } from 'node:fs/promises';
import { Lexer, Marked, type Tokens } from 'marked';
import { topicSource } from '../scripts/markdown-source.ts';
import { searchText } from '../design-system/search.ts';

const root = new URL('../_site/', import.meta.url);
const registry = JSON.parse(await readFile(new URL('topics/topics.json', root), 'utf8')) as { topics: string[] };
const parser = new Marked({ async: false });
const visible = (text: string) => searchText(parser.parseInline(text, { async: false }));
const sources = await Promise.all(registry.topics.map(async id => {
  const { topic, body } = topicSource(await readFile(new URL(`topics/${id}/README.md`, root), 'utf8'), `${id}/README.md`);
  const documents = await Promise.all(topic.documents.map(async (document, index) => {
    const markdown = index === 0 ? body : await readFile(new URL(`topics/${id}/${document.file}`, root), 'utf8');
    const headings = new Lexer().lex(markdown).filter((token): token is Tokens.Heading => token.type === 'heading');
    return { file: document.file, title: visible(headings[0].text), headings: headings.slice(1) };
  }));
  return { id, topic, documents };
}));

for (const width of [1440, 390, 320]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`every topic follows the same Markdown publishing contract at ${width}px in ${theme}`, async ({ page, context }) => {
      await context.setOffline(true);
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const { id, topic, documents } of sources) {
        await page.goto(new URL(`topics/${id}/index.html`, root).href);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('h1')).toHaveText(documents[0].title);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('.topic-hero .lead')).toHaveText(topic.description);
        await expect(page.locator('.source-heading,.source-title,.toc-group')).toHaveCount(0);
        await expect(page.locator('.source-document')).toHaveCount(documents.length);
        expect(await page.locator('.document-title').allTextContents()).toEqual(documents.slice(1).map(document => document.title));
        expect(await page.locator('.toc-document-title').allTextContents()).toEqual(documents.length > 1 ? documents.map(document => document.title) : []);
        for (const [index, document] of documents.entries()) {
          const outline = page.locator('.toc-document').nth(index);
          expect(await outline.locator('.toc-chapter > .toc-link').allTextContents()).toEqual(document.headings.filter(heading => heading.depth === 2).map(heading => visible(heading.text)));
          expect(await outline.locator('.toc-chapter > ol > li > .toc-link').allTextContents()).toEqual(document.headings.filter(heading => heading.depth === 3).map(heading => visible(heading.text)));
          const prose = page.locator('.prose').nth(index);
          expect(await prose.locator('h2,h3,h4,h5,h6').allTextContents()).toEqual(document.headings.map(heading => visible(heading.text)));
          await expect(prose.locator('.article-reveal').first()).toHaveCSS('opacity', '1');
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
        await page.screenshot({ path: `test-results/topic-contract-${id}-${width}-${theme}.png`, animations: 'disabled' });
      }
      expect(errors).toEqual([]);
    });
  }
}

test('multipart companion chapters reveal on scroll and remain searchable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(new URL('topics/worktrees/index.html', root).href);
  const companion = page.locator('.prose[data-source="WORKFLOW.md"]');
  await expect(companion.locator('.article-reveal').first()).toHaveAttribute('data-reveal', 'pending');
  const chapter = companion.locator('.article-reveal').first();
  await chapter.evaluate(section => section.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await expect(chapter).toHaveAttribute('data-reveal', 'entering');
  await chapter.evaluate(section => section.getAnimations().forEach(animation => animation.finish()));
  await expect(chapter).toHaveAttribute('data-reveal', 'shown');
  await page.locator('#section-search').fill('port conflicts');
  await expect(page.locator('.toc-document').first()).toBeHidden();
  await expect(page.locator('.toc-chapter > .toc-link:visible')).toHaveText('Working on a Task');
  await expect(companion.locator('mark.search-hit').first()).toBeVisible();
});
