import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalURL, pageMetadata, sitemap, validatePublication } from './discovery.ts';
import type { PublishedPage } from './discovery.ts';
import type { Collection } from '../design-system/types.ts';

const collection: Collection = {
  title: 'A & B', displayTitle: 'A & B', description: 'Notes <and> ideas', eyebrow: '', subtitle: '', introduction: [], topics: [],
  siteUrl: 'https://example.com/collection/', author: { name: 'writer', url: 'https://github.com/writer' }
};
const article: PublishedPage = { path: 'topics/example/index.html', title: 'An "idea" </script><script>alert(1)</script>', description: 'A & B < C', kind: 'article', category: 'Practice', created: '2026-01-02', updated: '2026-02-03' };
const structured = (html: string) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);

test('canonical URLs retain explicit article filenames and work under a repository subpath', () => {
  assert.equal(canonicalURL(collection.siteUrl, 'index.html'), 'https://example.com/collection/');
  assert.equal(canonicalURL(collection.siteUrl, article.path), 'https://example.com/collection/topics/example/index.html');
  for (const path of ['../index.html', '/index.html', 'https://elsewhere.com/', 'x?tracking=true', 'x#section', 'a\\b']) {
    assert.throws(() => canonicalURL(collection.siteUrl, path));
  }
});

test('publication settings require an HTTPS base and identifiable author', () => {
  assert.doesNotThrow(() => validatePublication(collection));
  for (const siteUrl of ['http://example.com/', 'https://example.com/path', 'https://example.com/?x=1', 'https://example.com/#x', 'https://user@example.com/']) {
    assert.throws(() => validatePublication({ ...collection, siteUrl }));
  }
  assert.throws(() => validatePublication({ ...collection, author: { name: '', url: collection.author.url } }));
  assert.throws(() => validatePublication({ ...collection, author: { name: 'writer', url: 'javascript:alert(1)' } }));
});

test('article metadata reuses authored content, escapes HTML and script boundaries, and preserves dates', () => {
  const html = pageMetadata(collection, article);
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
  assert.match(html, /property="og:type" content="article"/);
  assert.match(html, /content="A &amp; B &lt; C"/);
  assert.doesNotMatch(html, /<script>alert/);
  const data = structured(html);
  assert.equal(data['@type'], 'Article');
  assert.equal(data.headline, article.title);
  assert.equal(data.description, article.description);
  assert.equal(data.articleSection, article.category);
  assert.equal(data.datePublished, article.created);
  assert.equal(data.dateModified, article.updated);
  assert.equal(data.author.name, collection.author.name);
  assert.equal(data.author.url, collection.author.url);
  assert.equal(data.mainEntityOfPage['@id'], data.url);
  const undated = structured(pageMetadata(collection, { ...article, created: undefined, updated: undefined }));
  assert.ok(!('datePublished' in undated));
  assert.ok(!('dateModified' in undated));
});

test('sharing metadata uses public HTTPS JPEG URLs and descriptive alternatives', () => {
  const sharingImage = { path: 'assets/sharing/example-123.jpg', alt: 'A & B: article preview', width: 1200, height: 630 };
  const html = pageMetadata(collection, { ...article, sharingImage });
  const url = 'https://example.com/collection/assets/sharing/example-123.jpg';
  assert.ok(html.includes(`<meta property="og:image" content="${url}">`));
  assert.ok(html.includes(`<meta name="twitter:image" content="${url}">`));
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  assert.match(html, /property="og:image:alt" content="A &amp; B: article preview"/);
  assert.deepEqual(structured(html).image, { '@type': 'ImageObject', url, width: 1200, height: 630, caption: sharingImage.alt });
  const absent = pageMetadata(collection, article);
  assert.match(absent, /name="twitter:card" content="summary"/);
  assert.doesNotMatch(absent, /property="og:image"/);
});

test('home and index metadata do not claim to be articles', () => {
  for (const kind of ['collection', 'index'] as const) {
    const html = pageMetadata(collection, { path: 'index.html', title: collection.title, description: collection.description, kind });
    const data = structured(html);
    assert.equal(data['@type'], kind === 'collection' ? 'WebSite' : 'CollectionPage');
    assert.match(html, /property="og:type" content="website"/);
    assert.doesNotMatch(html, /article:author/);
    assert.ok(!('datePublished' in data));
  }
});

test('sitemap is deterministic, escapes XML, rejects duplicates, and omits guessed collection dates', () => {
  const pages: PublishedPage[] = [
    { path: 'index.html', kind: 'collection', title: 'Home', description: '', updated: article.updated },
    article,
    { ...article, path: 'topics/created-only/index.html', updated: undefined },
    { ...article, path: 'topics/no-dates/index.html', created: undefined, updated: undefined },
    { ...article, path: 'topics/a&b/index.html' }
  ];
  const xml = sitemap(collection, pages);
  assert.equal(xml, sitemap(collection, pages));
  assert.match(xml, /xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
  assert.match(xml, /<loc>https:\/\/example.com\/collection\/<\/loc><\/url>/);
  assert.match(xml, /created-only\/index.html<\/loc><lastmod>2026-01-02<\/lastmod>/);
  assert.match(xml, /no-dates\/index.html<\/loc><\/url>/);
  assert.match(xml, /a&amp;b\/index.html/);
  assert.equal((xml.match(/<url>/g) ?? []).length, pages.length);
  assert.throws(() => sitemap(collection, [article, article]), /Duplicate/);
});
