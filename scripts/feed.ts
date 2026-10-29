import type { Collection } from '../design-system/types.ts';
import type { PublishedPage } from './discovery.ts';
import { canonicalURL } from './discovery.ts';

const xml = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
// Readers treat descriptions as HTML, so plain text is HTML-escaped first. Only &, < and >
// need it: HTML 4 readers do not know &apos;, and would show it literally.
const htmlText = (text: string) => text.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]!));
// RSS dates require a time. Authored day-only dates use midnight UTC as a
// serialization convention, not a claimed publication time or the build clock.
const rssDate = (date: string) => new Date(`${date}T00:00:00Z`).toUTCString();

export function feedLink(collection: Collection): string {
  return `<link rel="alternate" type="application/rss+xml" title="${xml(collection.title)}" href="${xml(canonicalURL(collection.siteUrl, 'feed.xml'))}">`;
}

/** Full text in feed readers: the source-owned summary as the description, and the complete topic as content. */
export function rssFeed(collection: Collection, pages: PublishedPage[]): string {
  // Match the homepage: newest-added topic first, without altering canonical
  // numbering or claiming unknown publication dates. Non-article pages stay out.
  const articles = pages.filter(page => page.kind === 'article').toReversed();
  const dates = articles.flatMap(page => [page.created, page.updated]).filter((date): date is string => Boolean(date)).sort();
  const latest = dates.at(-1);
  const seen = new Set<string>();
  const items = articles.map(page => {
    const url = canonicalURL(collection.siteUrl, page.path);
    // Keep the original permalink identifier across the move to clean canonicals,
    // so subscribers do not receive every existing article again.
    const guid = new URL(page.path, collection.siteUrl).href;
    if (seen.has(url)) throw new Error(`Duplicate feed URL: ${url}`);
    seen.add(url);
    return `    <item>\n      <title>${xml(page.title)}</title>\n      <link>${xml(url)}</link>\n      <guid isPermaLink="true">${xml(guid)}</guid>\n      <description>${xml(htmlText(page.description))}</description>${page.content ? `\n      <content:encoded><![CDATA[${page.content.replaceAll(']]>', ']]]]><![CDATA[>')}]]></content:encoded>` : ''}\n      <dc:creator>${xml(collection.author.name)}</dc:creator>${page.category ? `\n      <category>${xml(page.category)}</category>` : ''}${page.created ? `\n      <pubDate>${rssDate(page.created)}</pubDate>` : ''}${page.updated ? `\n      <atom:updated>${page.updated}T00:00:00Z</atom:updated>` : ''}\n    </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n  <channel>\n    <title>${xml(collection.title)}</title>\n    <link>${xml(canonicalURL(collection.siteUrl, 'index.html'))}</link>\n    <description>${xml(collection.description)}</description>\n    <language>en</language>\n    <atom:link href="${xml(canonicalURL(collection.siteUrl, 'feed.xml'))}" rel="self" type="application/rss+xml"/>${latest ? `\n    <lastBuildDate>${rssDate(latest)}</lastBuildDate>` : ''}\n${items.join('\n')}\n  </channel>\n</rss>\n`;
}
