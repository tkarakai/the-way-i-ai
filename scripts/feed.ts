import type { Collection } from '../design-system/types.ts';
import type { PublishedPage } from './discovery.ts';
import { canonicalURL } from './discovery.ts';

const xml = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
// RSS dates require a time. Authored day-only dates use midnight UTC as a
// serialization convention, not a claimed publication time or the build clock.
const rssDate = (date: string) => new Date(`${date}T00:00:00Z`).toUTCString();

export function feedLink(collection: Collection): string {
  return `<link rel="alternate" type="application/rss+xml" title="${xml(collection.title)}" href="${xml(canonicalURL(collection.siteUrl, 'feed.xml'))}">`;
}

/** Short source-owned summaries, not a second edition of each article. */
export function rssFeed(collection: Collection, pages: PublishedPage[]): string {
  // Match the homepage: newest-added topic first, without altering canonical
  // numbering or claiming unknown publication dates. Non-article pages stay out.
  const articles = pages.filter(page => page.kind === 'article').toReversed();
  const dates = articles.flatMap(page => [page.created, page.updated]).filter((date): date is string => Boolean(date)).sort();
  const latest = dates.at(-1);
  const seen = new Set<string>();
  const items = articles.map(page => {
    const url = canonicalURL(collection.siteUrl, page.path);
    if (seen.has(url)) throw new Error(`Duplicate feed URL: ${url}`);
    seen.add(url);
    return `    <item>\n      <title>${xml(page.title)}</title>\n      <link>${xml(url)}</link>\n      <guid isPermaLink="true">${xml(url)}</guid>\n      <description>${xml(xml(page.description))}</description>\n      <dc:creator>${xml(collection.author.name)}</dc:creator>${page.category ? `\n      <category>${xml(page.category)}</category>` : ''}${page.created ? `\n      <pubDate>${rssDate(page.created)}</pubDate>` : ''}${page.updated ? `\n      <atom:updated>${page.updated}T00:00:00Z</atom:updated>` : ''}\n    </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n  <channel>\n    <title>${xml(collection.title)}</title>\n    <link>${xml(canonicalURL(collection.siteUrl, 'index.html'))}</link>\n    <description>${xml(collection.description)}</description>\n    <language>en</language>\n    <atom:link href="${xml(canonicalURL(collection.siteUrl, 'feed.xml'))}" rel="self" type="application/rss+xml"/>${latest ? `\n    <lastBuildDate>${rssDate(latest)}</lastBuildDate>` : ''}\n${items.join('\n')}\n  </channel>\n</rss>\n`;
}
