import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { topicSource } from '../scripts/markdown-source.ts';

const root = resolve(import.meta.dirname, '..');
test('published RSS is valid XML with complete, plain-text source summaries and autodiscovery', async ({ page, context }) => {
  await context.route(/^https?:/, route => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
  const registry = JSON.parse(await readFile(resolve(root, 'topics/topics.json'), 'utf8')) as { topics: string[] };
  const expected = await Promise.all(registry.topics.toReversed().map(async id => {
    const source = topicSource(await readFile(resolve(root, `topics/${id}/README.md`), 'utf8'), `${id}/README.md`);
    return { description: source.topic.description, category: source.topic.category };
  }));
  const xml = await readFile(resolve(root, '_site/feed.xml'), 'utf8');
  const parsed = await page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return {
      error: doc.querySelector('parsererror')?.textContent,
      version: doc.documentElement.getAttribute('version'),
      items: [...doc.querySelectorAll('item')].map(item => ({
        description: new DOMParser().parseFromString(item.querySelector('description')!.textContent!, 'text/html').body.textContent,
        category: item.querySelector('category')!.textContent
      }))
    };
  }, xml);
  expect(parsed.error).toBeUndefined();
  expect(parsed.version).toBe('2.0');
  expect(parsed.items).toEqual(expected);
  await page.goto(new URL('index.html', 'http://127.0.0.1:4193/').href);
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute('href', 'https://thewayiai.com/feed.xml');
});
