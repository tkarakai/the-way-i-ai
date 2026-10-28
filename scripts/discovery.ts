import type { Collection } from '../design-system/types.ts';

const xml = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
const safeJSON = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');

export interface PublishedPage {
  path: string;
  title: string;
  description: string;
  kind: 'collection' | 'index' | 'article' | 'page';
  category?: string;
  created?: string;
  updated?: string;
  sharingImage?: { path: string; alt: string; width: number; height: number };
}

export function validatePublication(collection: Collection): void {
  if (typeof collection.siteUrl !== 'string') throw new Error('siteUrl must be an absolute HTTPS URL ending in /.');
  const url = new URL(collection.siteUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/')) {
    throw new Error('siteUrl must be an absolute HTTPS URL ending in /, without credentials, query, or fragment.');
  }
  if (!collection.author || typeof collection.author.name !== 'string' || !collection.author.name.trim() || typeof collection.author.url !== 'string') {
    throw new Error('author requires a nonempty name and an HTTPS profile URL.');
  }
  const author = new URL(collection.author.url);
  if (author.protocol !== 'https:' || author.username || author.password) throw new Error('author.url must be an HTTPS profile URL.');
}

export function canonicalURL(siteUrl: string, path: string): string {
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => part === '.' || part === '..') || /[?#]/.test(path)) {
    throw new Error(`Invalid publication path: ${path}`);
  }
  const base = new URL(siteUrl);
  const url = new URL(path === 'index.html' ? './' : path, base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error(`Publication path escapes siteUrl: ${path}`);
  return url.href;
}

export function pageMetadata(collection: Collection, page: PublishedPage): string {
  const url = canonicalURL(collection.siteUrl, page.path);
  const home = canonicalURL(collection.siteUrl, 'index.html');
  const author = { '@type': 'Person', name: collection.author.name, url: collection.author.url };
  const image = page.sharingImage ? { '@type': 'ImageObject', url: canonicalURL(collection.siteUrl, page.sharingImage.path), width: page.sharingImage.width, height: page.sharingImage.height, caption: page.sharingImage.alt } : undefined;
  const website = { '@type': 'WebSite', '@id': `${home}#website`, url: home, name: collection.title, description: collection.description, author, inLanguage: 'en', ...(image && page.kind === 'collection' ? { image } : {}) };
  const entity = {
    '@context': 'https://schema.org',
    ...(page.kind === 'collection' ? website : {
      '@type': page.kind === 'article' ? 'Article' : page.kind === 'page' ? 'WebPage' : 'CollectionPage',
      '@id': `${url}#${page.kind === 'article' ? 'article' : 'webpage'}`,
      url,
      ...(page.kind === 'article' ? { headline: page.title, author, mainEntityOfPage: { '@type': 'WebPage', '@id': url }, articleSection: page.category } : { name: page.title }),
      description: page.description,
      ...(image ? { image } : {}),
      inLanguage: 'en',
      isPartOf: { '@type': 'WebSite', '@id': website['@id'], url: home, name: collection.title },
      ...(page.created ? { datePublished: page.created } : {}),
      ...(page.updated ? { dateModified: page.updated } : {})
    })
  };
  const meta = (name: string, content: string, attribute = 'property') => `<meta ${attribute}="${xml(name)}" content="${xml(content)}">`;
  return `<link rel="canonical" href="${xml(url)}">`
    + meta('og:type', page.kind === 'article' ? 'article' : 'website')
    + meta('og:url', url) + meta('og:title', page.title) + meta('og:description', page.description) + meta('og:site_name', collection.title)
    + meta('twitter:card', image ? 'summary_large_image' : 'summary', 'name')
    + meta('twitter:title', page.title, 'name') + meta('twitter:description', page.description, 'name')
    + (image ? meta('og:image', image.url) + meta('og:image:type', 'image/jpeg') + meta('og:image:width', String(image.width)) + meta('og:image:height', String(image.height)) + meta('og:image:alt', page.sharingImage!.alt)
      + meta('twitter:image', image.url, 'name') + meta('twitter:image:alt', page.sharingImage!.alt, 'name') : '')
    + (page.kind === 'article' ? meta('author', collection.author.name, 'name') + meta('article:author', collection.author.url) + (page.category ? meta('article:section', page.category) : '') : '')
    + `<script type="application/ld+json">${safeJSON(entity)}</script>`;
}

export function sitemap(collection: Collection, pages: PublishedPage[]): string {
  const urls = new Set<string>();
  const entries = pages.map(page => {
    const url = canonicalURL(collection.siteUrl, page.path);
    if (urls.has(url)) throw new Error(`Duplicate sitemap URL: ${url}`);
    urls.add(url);
    // Only article dates describe changes to that page. Collection/index dates
    // cannot be inferred from the latest article date or the build clock.
    const modified = page.kind === 'article' ? page.updated ?? page.created : undefined;
    return `  <url><loc>${xml(url)}</loc>${modified ? `<lastmod>${xml(modified)}</lastmod>` : ''}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}
