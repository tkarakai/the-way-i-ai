import test from 'node:test';
import assert from 'node:assert/strict';
import { rssFeed, feedLink } from './feed.ts';
import type { Collection } from '../design-system/types.ts';
import type { PublishedPage } from './discovery.ts';

const collection: Collection = { title: 'Notes & ideas', displayTitle: 'Notes', description: 'A public notebook', siteUrl: 'https://example.com/blog/', author: { name: 'writer', url: 'https://github.com/writer' }, eyebrow: '', subtitle: '', introduction: [], topics: [] };
const article: PublishedPage = { path: 'topics/example/index.html', title: 'An <idea>', description: 'A & B < C. Literal <b>text</b>.', kind: 'article', category: 'Practice', created: '2026-01-02', updated: '2026-02-03' };

test('RSS reuses authored summaries and canonical URLs, with stable permalink GUIDs and escaped text', () => {
  const xml = rssFeed(collection, [article]);
  assert.match(xml, /<rss version="2.0"/);
  assert.match(xml, /<title>An &lt;idea&gt;<\/title>/);
  assert.match(xml, /<description>A &amp;amp; B &amp;lt; C. Literal &amp;lt;b&amp;gt;text&amp;lt;\/b&amp;gt;.<\/description>/);
  assert.match(xml, /<guid isPermaLink="true">https:\/\/example.com\/blog\/topics\/example\/index.html<\/guid>/);
  assert.match(xml, /<dc:creator>writer<\/dc:creator>/);
  assert.doesNotMatch(xml, /<author>/, 'RSS author requires email, not a GitHub name');
  assert.match(xml, /<pubDate>Fri, 02 Jan 2026 00:00:00 GMT<\/pubDate>/);
  assert.match(xml, /<atom:updated>2026-02-03T00:00:00Z<\/atom:updated>/);
  assert.match(xml, /<lastBuildDate>Tue, 03 Feb 2026 00:00:00 GMT<\/lastBuildDate>/);
  assert.match(xml, /href="https:\/\/example.com\/blog\/feed.xml" rel="self"/);
  assert.equal(xml, rssFeed(collection, [article]));
  assert.throws(() => rssFeed(collection, [article, article]), /Duplicate feed URL/);
});

test('undated articles remain in RSS without invented dates, and the channel may be empty', () => {
  const xml = rssFeed(collection, [{ ...article, created: undefined, updated: undefined }]);
  assert.equal((xml.match(/<item>/g) ?? []).length, 1);
  assert.doesNotMatch(xml, /pubDate|atom:updated|lastBuildDate/);
  const empty = rssFeed(collection, []);
  assert.doesNotMatch(empty, /<item>|lastBuildDate/);
  assert.match(empty, /<channel>/);
});

test('feed follows reverse collection order, excludes non-articles, and retains GUIDs on updates', () => {
  const next = { ...article, path: 'topics/next/index.html', title: 'Newest addition' };
  const home: PublishedPage = { path: 'index.html', kind: 'collection', title: 'Home', description: '' };
  const xml = rssFeed(collection, [home, article, next]);
  assert.equal((xml.match(/<item>/g) ?? []).length, 2);
  assert.ok(xml.indexOf('<title>Newest addition') < xml.indexOf('<title>An &lt;idea'));
  const changed = rssFeed(collection, [{ ...article, title: 'Edited title', updated: '2026-03-04' }]);
  assert.equal(changed.match(/<guid[^>]*>[^<]+/u)![0], rssFeed(collection, [article]).match(/<guid[^>]*>[^<]+/u)![0]);
});

test('feed autodiscovery is absolute, escaped, and does not introduce visible UI', () => {
  assert.equal(feedLink(collection), '<link rel="alternate" type="application/rss+xml" title="Notes &amp; ideas" href="https://example.com/blog/feed.xml">');
});
