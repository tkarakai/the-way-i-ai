import type { Collection, RenderedTopic, SourceDocument, RenderedDocument, RenderedPage, PageLink, Heading } from '../design-system/types.ts';
import type { Tokens } from 'marked';
import { readFile, writeFile, access, mkdir, rm, cp, rename, realpath, readdir, lstat } from 'node:fs/promises';
import { dirname, resolve, relative, basename, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { Marked, Renderer } from 'marked';
import { preloadFile } from '@pierre/diffs/ssr';
import { shell, collectionBody, readerBody, indexBody, pageBody, escape } from '../design-system/layout.ts';
import { explorerFor } from '../design-system/explorers.ts';
import { parseWavePosition, wordmarkStyles } from '../design-system/wordmark.ts';
import { collectionSearch } from '../design-system/search.ts';
import { topicSource, splitFrontMatter } from './markdown-source.ts';
import { loadIllustrations } from './illustrations.ts';
import { validatePublication, pageMetadata, sitemap } from './discovery.ts';
import type { PublishedPage } from './discovery.ts';
import { loadIcons, iconMetadata } from './icons.ts';
import { sharingCard, renderSharingCards } from './sharing.ts';
import { feedLink, rssFeed } from './feed.ts';
import { Assets, ROOT, imageAttributes } from './assets.ts';
import type { PublishedImage } from './assets.ts';
import { assertSafeMarkdown, assertSafeSVG } from './safety.ts';
import { buildEdition, topicMarkdown, pageMarkdown, llmsIndex, llmsFull, securityTxt } from './agents.ts';
import { topicTable, withTopicTable } from './topic-registry.ts';
import { registerCodeThemes } from '../design-system/code-theme.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// build writes _site/; --site also renders the sharing JPEGs (needs Playwright Chromium);
// --check validates every source and page without writing anything.
const check = process.argv.includes('--check');
const site = process.argv.includes('--site');
if (check && site) throw new Error('Use --check and --site separately.');
const assets = new Assets();
const outputRoot = resolve(root, '_site');
// A check of an existing bundle uses its recorded provenance, not a new build clock.
const existingEdition = check ? await readFile(resolve(outputRoot, 'version.json'), 'utf8').then(text => JSON.parse(text) as import('../design-system/types.ts').Edition, () => undefined) : undefined;
const edition = existingEdition ?? buildEdition(root);
const read = (path: string) => readFile(resolve(root, path), 'utf8');
const compile = (path: string) => read(path).then(source => stripTypeScriptTypes(source));
const [registry, css, js, themeJS] = await Promise.all([
  read('topics/topics.json').then(text => JSON.parse(text) as Collection),
  // Folio is the base stylesheet; the Field Atlas (default) is scoped to :root[data-design="atlas"].
  Promise.all([read('design-system/theme.css'), read('design-system/atlas.css')]).then(sheets => sheets.join('\n')),
  Promise.all([compile('design-system/reader.ts'), compile('design-system/atlas.ts'), compile('design-system/logo.ts')]).then(scripts => scripts.join('\n')),
  Promise.all([compile('design-system/design.ts'), compile('design-system/theme.ts')]).then(scripts => scripts.join('\n'))
]);
validatePublication(registry);
if (registry.ambientBackground !== undefined && registry.ambientBackground !== 'F') throw new Error('Unsupported ambientBackground: expected F.');
if (registry.ambientIntensity !== undefined && (!Number.isFinite(registry.ambientIntensity) || registry.ambientIntensity < 0 || registry.ambientIntensity > 1)) throw new Error('ambientIntensity must be a number between 0 and 1.');
const ambientJS = registry.ambientBackground === 'F'
  ? (await Promise.all(['design-system/murmuration.ts', 'design-system/ambient.ts'].map(compile))).join('\n')
  : '';
const fontLicenses = await Promise.all(['newsreader-OFL.txt', 'dm-sans-OFL.txt', 'cormorant-garamond-OFL.txt', 'spectral-OFL.txt', 'ibm-plex-mono-OFL.txt', 'pierre-diffs-Apache-2.0.txt', 'octicons-MIT.txt'].map(file => read(`design-system/licenses/${file}`)));
// Folio: Newsreader + DM Sans. Field Atlas: Cormorant Garamond, Spectral and IBM Plex Mono (Newsreader stays for the wordmark).
const fontFaces: [name: string, path: string, style: string, weight: string][] = [
  ['Newsreader', '@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2', 'normal', '100 900'],
  ['Newsreader', '@fontsource-variable/newsreader/files/newsreader-latin-wght-italic.woff2', 'italic', '100 900'],
  ['DM Sans', '@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2', 'normal', '100 900'],
  ['Cormorant Garamond', '@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2', 'normal', '300 700'],
  ['Cormorant Garamond', '@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-italic.woff2', 'italic', '300 700'],
  ['Spectral', '@fontsource/spectral/files/spectral-latin-400-normal.woff2', 'normal', '400'],
  ['Spectral', '@fontsource/spectral/files/spectral-latin-400-italic.woff2', 'italic', '400'],
  ['Spectral', '@fontsource/spectral/files/spectral-latin-600-normal.woff2', 'normal', '600'],
  ['IBM Plex Mono', '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', 'normal', '400'],
  ['IBM Plex Mono', '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2', 'normal', '500'],
];
const licenses = `/* Font, icon, and code-renderer licenses:\n${fontLicenses.join('\n\n').replaceAll('*/', '* /')}\n*/\n`;
const fontFiles = await Promise.all(fontFaces.map(async ([name, path, style, weight]) => ({ name, style, weight, file: basename(path), data: await readFile(resolve(root, `node_modules/${path}`)) })));
const fontCSS = (source: (font: typeof fontFiles[number]) => string) => licenses + fontFiles.map(font => `@font-face{font-family:'${font.name}';font-style:${font.style};font-weight:${font.weight};font-display:swap;src:url(${source(font)}) format('woff2');}`).join('\n');
// Pages share font files beside the stylesheet; browsers fetch only the faces a design uses.
const siteFonts = fontCSS(font => posix.relative('assets', assets.add(font.file, font.data, 'assets/fonts')));
// Sharing cards render offline in a browser at build time, so they embed their fonts.
const embeddedFonts = fontCSS(font => `data:font/woff2;base64,${font.data.toString('base64')}`);

const slug = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
const plain = (text: string) => text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const safeJSON = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
registerCodeThemes();
const codeCache = new Map<string, Promise<string>>();
const renderedCode = new WeakMap<Tokens.Code, string>();
async function topicAsset(topic: string, path: string) {
  const directory = resolve(root, 'topics', topic);
  const actual = await realpath(path);
  if (!actual.startsWith(`${directory}/`)) throw new Error(`${topic}: assets must stay inside their topic folder.`);
  return actual;
}
async function embedImage(imagePath: string) {
  const extension = imagePath.split('.').at(-1)!.toLowerCase();
  const mime = ({ svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' } as Record<string, string>)[extension];
  if (!mime) throw new Error(`Unsupported image format: ${imagePath}`);
  return `data:${mime};base64,${(await readFile(imagePath)).toString('base64')}`;
}
// Markdown images: each published once, with responsive widths, and their source URLs for the Markdown editions.
const markdownImages = new WeakMap<Tokens.Image, PublishedImage>();
const imageURLs = new Map<string, string>();
async function renderCode(text: string, lang: string) {
  const key = `${lang}\n${text}`;
  if (!codeCache.has(key)) codeCache.set(key, preloadFile({
    file: { name: `example.${lang === 'yaml' ? 'yaml' : lang === 'bash' || lang === 'sh' ? 'sh' : 'txt'}`, contents: text, lang: (lang || 'text') as NonNullable<Parameters<typeof preloadFile>[0]['file']['lang']> },
    options: { theme: { light: 'reader-light', dark: 'reader-dark' }, themeType: 'system', overflow: 'wrap', disableLineNumbers: true, disableFileHeader: true,
      unsafeCSS: ':host { color-scheme: inherit; --diffs-bg: var(--code); --diffs-fg: var(--ink); } [data-code] { padding-block: 12px; }' }
  }).then(result => (result.prerenderedHTML ?? '').replace(/(<pre\b[^>]*?) tabindex="0"/g, '$1').replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (_, css: string) => `<link rel="stylesheet" href="${ROOT}${assets.add('code.css', css)}">`)));
  return codeCache.get(key)!;
}

const articleBodies = new Map<string, string>();
async function renderDocument(topic: RenderedTopic, document: SourceDocument, index: number): Promise<RenderedDocument> {
  const markdown = await read(`topics/${topic.id}/${document.file}`);
  if (index > 0 && splitFrontMatter(markdown, `${topic.id}/${document.file}`).metadata) throw new Error(`${topic.id}/${document.file}: topic metadata belongs only in README.md.`);
  const content = index === 0 ? articleBodies.get(topic.id)! : markdown;
  const docId = `${topic.id}-doc-${index + 1}`;
  let codeIndex = 0;
  const headings: Heading[] = [];
  const used = new Set();
  let previousLevel = 1;
  const tableCounts = new Map<string, number>();
  const parser = new Marked({
    async: true, gfm: true,
    async walkTokens(token) {
      assertSafeMarkdown(token, `${topic.id}/${document.file}`);
      if (token.type === 'code') renderedCode.set(token as Tokens.Code, await renderCode(token.text, token.lang?.split(/\s/)[0] || 'text'));
      if (token.type === 'image' && !markdownImages.has(token as Tokens.Image)) {
        if (/^(?:[a-z]+:|\/\/)/i.test(token.href)) throw new Error(`Download remote images into ${topic.id}/ before building: ${token.href}`);
        const imagePath = await topicAsset(topic.id, resolve(root, 'topics', topic.id, dirname(document.file), decodeURIComponent(token.href)));
        const published = await assets.image(imagePath);
        markdownImages.set(token as Tokens.Image, published);
        const page = new URL(`topics/${topic.id}/`, registry.siteUrl);
        imageURLs.set(new URL(token.href, new URL(document.file, page)).href, new URL(published.src, registry.siteUrl).href);
      }
    },
    renderer: {
      image(token) {
        const published = markdownImages.get(token);
        if (!published) throw new Error(`${topic.id}/${document.file}: unpublished image ${token.href}`);
        return `<img ${imageAttributes(published, '(max-width: 760px) 100vw, 760px')} alt="${escape(token.text)}"${token.title ? ` title="${escape(token.title)}"` : ''} loading="lazy" decoding="async">`;
      },
      heading(token) {
        if (token.depth === 1) throw new Error(`${topic.id}/${document.file}: each document requires exactly one level-one title.`);
        if (token.depth > previousLevel + 1) throw new Error(`${topic.id}/${document.file}: headings must not skip levels.`);
        previousLevel = token.depth;
        const content = this.parser.parseInline(token.tokens);
        const text = plain(content);
        let id = `${docId}-${slug(text)}`;
        while (used.has(id)) id += '-2';
        used.add(id);
        const level = token.depth;
        headings.push({ id, text, level, excerpt: '' });
        // The heading's own link is for pointers; keyboard readers reach every section from the outline (or J/K and C),
        // so it is not a Tab stop between every heading and its text.
        return `<h${level} id="${id}"><a class="heading-link" href="#${id}" tabindex="-1">${content}</a></h${level}>\n`;
      },
      code(token) {
        const id = `${docId}-code-${++codeIndex}`;
        return `<div class="code-example"><div class="code-toolbar"><span>${escape(token.lang || 'Terminal example')}</span><button class="small-button js-only" data-copy="${id}" aria-label="Copy code example">Copy</button></div><diffs-container><template shadowrootmode="open">${renderedCode.get(token)}</template></diffs-container><script type="application/json" id="${id}">${safeJSON(token.text)}</script></div>\n`;
      },
      table(token) {
        // A scrollable region needs a name of its own: the section it belongs to, numbered if it holds several tables.
        const section = headings.at(-1)?.text ?? topic.title;
        const count = (tableCounts.get(section) ?? 0) + 1;
        tableCounts.set(section, count);
        const name = `Table${count > 1 ? ` ${count}` : ''}: ${section}`;
        return `<div class="table-wrap" tabindex="0" role="region" aria-label="${escape(name)}">${Renderer.prototype.table.call(this, token)}</div>`;
      },
      list(token) {
        const html = Renderer.prototype.list.call(this, token);
        return !token.ordered && token.items.length >= 7 ? html.replace('<ul>', '<ul class="long-list">') : html;
      }
    }
  });
  const tokens = parser.lexer(content);
  const first = tokens.findIndex(token => token.type !== 'space');
  if (tokens[first]?.type !== 'heading' || tokens[first].depth !== 1) throw new Error(`${topic.id}/${document.file} must start with a level-one title.`);
  const title = plain(await parser.parseInline(tokens[first].text));
  if (!title.trim()) throw new Error(`${topic.id}/${document.file}: document title must not be empty.`);
  const bodyMarkdown = content.replace(tokens[first].raw, '');
  const html = await parser.parse(bodyMarkdown);
  // Extract each heading's complete section, including subsections, directly from the rendered source.
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const start = html.indexOf(`</h${heading.level}>`, html.indexOf(`id="${heading.id}"`)) + 6;
    const next = headings.slice(i + 1).find(h => h.level <= heading.level);
    const end = next ? html.indexOf(`<h${next.level} id="${next.id}"`) : html.length;
    heading.excerpt = html.slice(start, end).replace(/<hr>\s*$/, '').trim();
  }
  const excerpts = new Map();
  for (const match of html.matchAll(/<!-- excerpt:([a-z0-9-]+) -->[\s\S]*?<!-- \/excerpt:\1 -->/g)) {
    if (excerpts.has(match[1])) throw new Error(`${topic.id}/${document.file}: duplicate excerpt ${match[1]}`);
    excerpts.set(match[1], match[0].replace(/^<!--[^>]+-->|<!--[^>]+-->$/g, '').trim());
  }
  return { ...document, id: docId, title, markdown, html, headings, excerpts, sha256: createHash('sha256').update(markdown).digest('hex') };
}

async function loadSVG(topic: RenderedTopic, file: string, prefix = '') {
  const source = await readFile(await topicAsset(topic.id, resolve(root, 'topics', topic.id, file)), 'utf8');
  if (!source.trim().startsWith('<svg') || !/viewBox=/.test(source)) throw new Error(`${topic.id}/${file}: expected a standalone SVG with a viewBox`);
  assertSafeSVG(source, `${topic.id}/${file}`);
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) throw new Error(`${topic.id}/${file}: duplicate SVG ids`);
  if (!/<title\b[^>]*>\s*[^<\s][^<]*<\/title>/i.test(source)) throw new Error(`${topic.id}/${file}: SVG needs a nonempty <title> for its accessible name`);
  if (!prefix) return source;
  return source.replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/(aria-labelledby|aria-describedby)="([^"]+)"/g, (_, name, value) => `${name}="${value.split(/\s+/).map((id: string) => prefix + id).join(' ')}"`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`);
}

const ids = new Set();
const topics: RenderedTopic[] = [];
const publishedSources = new Set<string>(['topics/topics.json']);
async function validateSourceTree(directory: string): Promise<void> {
  if ((await lstat(directory)).isSymbolicLink()) throw new Error(`Published sources must not be symbolic links: ${directory}`);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Published sources must not be symbolic links: ${path}`);
    if (entry.isDirectory()) await validateSourceTree(path);
    else {
      if (path.endsWith('.svg')) assertSafeSVG(await readFile(path, 'utf8'), path);
      if (!path.endsWith('.html') && !relative(root, path).includes('/assets/illustrations/')) publishedSources.add(relative(root, path));
    }
  }
}
for (const [index, id] of registry.topics.entries()) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Invalid topic id: ${id}`);
  await validateSourceTree(resolve(root, 'topics', id));
  const json = await read(`topics/${id}/topic.json`).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (json !== undefined) throw new Error(`${id}: topic.json is no longer supported; move metadata to README.md front matter.`);
  const source = topicSource(await read(`topics/${id}/README.md`), `${id}/README.md`);
  articleBodies.set(id, source.body);
  topics.push({ ...source.topic, title: '', id, coverSVG: '', diagramSVG: '', rendered: [], number: String(index + 1).padStart(2, '0') });
}
for (const topic of topics) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.id) || ids.has(topic.id)) throw new Error(`Invalid or duplicate topic id: ${topic.id}`);
  ids.add(topic.id);
  topic.coverSVG = topic.cover ? await loadSVG(topic, topic.cover, `cover-${topic.id}-`) : '';
  topic.diagramSVG = topic.explorer ? await loadSVG(topic, topic.explorer.diagram) : '';
  topic.rendered = [];
  for (const [index, document] of topic.documents.entries()) topic.rendered.push(await renderDocument(topic, document, index));
  topic.title = topic.rendered[0].title;
  topic.illustrations = await loadIllustrations(root, topic.id, topic.rendered, assets);
}

// The root README's topic table is generated from the registry and each topic's sources.
// The README documents the repository, not the site, so source-only fixtures may omit it.
const readmePath = resolve(root, 'README.md');
const readme = await readFile(readmePath, 'utf8').catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ENOENT') return undefined;
  throw error;
});
const generatedReadme = readme === undefined ? undefined : withTopicTable(readme, topicTable(registry.siteUrl, topics.map(topic => ({
  id: topic.id, number: topic.number, title: topic.title, description: topic.description,
  documents: topic.rendered.map(doc => ({ file: doc.file, title: doc.title }))
}))));
if (check && generatedReadme !== readme) throw new Error('The README.md topic table is out of date. Run npm run build.');

// Site pages: About, Privacy and Licensing in footer order, plus the GitHub Pages 404 page.
// GitHub Pages serves 404.html at any missing path, so its links start from the site root.
const sitePageIds = ['about', 'privacy', 'licensing', 'accessibility'];
const missingPrefix = new URL(registry.siteUrl).pathname;
async function renderPage(id: string, prefix: string): Promise<RenderedPage> {
  const file = `pages/${id}.md`;
  const markdown = await read(file);
  if (splitFrontMatter(markdown, file).metadata) throw new Error(`${file}: site pages have no front matter.`);
  const headings: Heading[] = [];
  const used = new Set<string>();
  let previousLevel = 1;
  const parser = new Marked({
    gfm: true,
    walkTokens(token) {
      assertSafeMarkdown(token, file);
      if (token.type === 'image') throw new Error(`${file}: site pages do not embed images.`);
      // Links to the published site stay relative, so previews work under any address.
      if (token.type === 'link' && token.href.startsWith(registry.siteUrl)) token.href = prefix + (token.href.slice(registry.siteUrl.length) || 'index.html');
    },
    renderer: {
      heading(token) {
        if (token.depth === 1) throw new Error(`${file}: each page requires exactly one level-one title.`);
        if (token.depth > previousLevel + 1) throw new Error(`${file}: headings must not skip levels.`);
        previousLevel = token.depth;
        const content = this.parser.parseInline(token.tokens);
        const text = plain(content);
        let headingId = slug(text);
        while (used.has(headingId) || headingId === 'page-title') headingId += '-2';
        used.add(headingId);
        headings.push({ id: headingId, text, level: token.depth, excerpt: '' });
        return `<h${token.depth} id="${headingId}"><a class="heading-link" href="#${headingId}" tabindex="-1">${content}</a></h${token.depth}>\n`;
      }
    }
  });
  const tokens = parser.lexer(markdown);
  const first = tokens.findIndex(token => token.type !== 'space');
  if (tokens[first]?.type !== 'heading' || tokens[first].depth !== 1) throw new Error(`${file} must start with a level-one title.`);
  const title = plain(parser.parseInline(tokens[first].text) as string);
  const paragraph = tokens.find((token): token is Tokens.Paragraph => token.type === 'paragraph');
  if (!title.trim() || !paragraph) throw new Error(`${file} needs a title and an opening paragraph.`);
  const html = parser.parse(markdown.replace(tokens[first].raw, '')) as string;
  // The opening paragraph doubles as the search and sharing description.
  return { id, title, description: plain(parser.parseInline(paragraph.text) as string).replace(/\s+/g, ' ').trim(), html, headings, markdown };
}
const sitePages = await Promise.all(sitePageIds.map(id => renderPage(id, '../')));
const pageLinks: PageLink[] = sitePages.map(({ id, title, description }) => ({ id, title, description }));
const missingPage = await renderPage('404', missingPrefix);

const publicIcons = await loadIcons(root);
const outputs = new Map<string, string>();
const titleBackgroundPath = registry.titleBackground ? resolve(root, 'topics', registry.titleBackground) : undefined;
if (titleBackgroundPath && !titleBackgroundPath.startsWith(`${resolve(root, 'topics')}/`)) throw new Error('The title background must be a local image inside topics/.');
if (titleBackgroundPath) await access(titleBackgroundPath);
const positionPath = titleBackgroundPath && registry.titleBackgroundPosition ? resolve(root, 'topics', registry.titleBackgroundPosition) : undefined;
if (positionPath && !positionPath.startsWith(`${resolve(root, 'topics')}/`)) throw new Error('The wave positioning must be a local JSON file inside topics/.');
if (positionPath) publishedSources.add(relative(root, positionPath));
const wavePosition = positionPath ? parseWavePosition(JSON.parse(await readFile(positionPath, 'utf8'))) : undefined;
if (wavePosition && resolve(root, wavePosition.source) !== titleBackgroundPath) throw new Error('The wave positioning source must match titleBackground.');
// The wave never displays wider than about 600 CSS pixels; 1200 covers high-density screens.
const titleBackground = titleBackgroundPath ? posix.relative('assets', (await assets.image(titleBackgroundPath, { maxWidth: 1200 })).src) : '';
const wordmarkBackground = Boolean(titleBackground);
const stylesheet = assets.add('site.css', `${siteFonts}\n${css}\n${wordmarkStyles(titleBackground, wavePosition)}`);
const searchIndex = assets.add('search.json', JSON.stringify(collectionSearch(topics)));
const readerScript = assets.add('reader.js', js);
const scripts = (page: string) => [...(page === 'collection' && ambientJS ? [assets.add('ambient.js', ambientJS)] : []), readerScript];
const files = (page = 'collection') => ({ stylesheet, scripts: scripts(page), searchIndex });

// The theme script runs inline before first paint; every other script is a shared file.
// The policy is a meta tag because GitHub Pages cannot send headers, which also means
// frame-ancestors, reporting and sandboxing are unavailable.
const inlineThemeJS = themeJS.replaceAll('</script', '<\\/script');
const themeHash = `sha256-${createHash('sha256').update(inlineThemeJS).digest('base64')}`;
const csp = [
  "default-src 'none'",
  `script-src 'self' '${themeHash}'`,
  // Inline style attributes, and the code renderer's shadow-root styles.
  "style-src 'self' 'unsafe-inline'",
  // The share preview falls back to the published card when a local build has none.
  `img-src 'self' ${new URL(registry.siteUrl).origin}`,
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'"
].join('; ');

const sharingSources = { collection: registry, fonts: embeddedFonts, css: `${css}\n${wordmarkStyles(titleBackgroundPath ? await embedImage(titleBackgroundPath) : '', wavePosition)}`, sharingCSS: await read('design-system/sharing.css'), wordmarkBackground };
const homeCard = sharingCard(sharingSources);
const topicCards = new Map(topics.map(topic => [topic.id, sharingCard(sharingSources, topic)]));
const cards = [homeCard, ...topicCards.values()];

// Markdown editions for agents and tools, and the same text as HTML for the full-text feed.
const topicMarkdowns = new Map(topics.map(topic => [topic.id, topicMarkdown(registry, topic, imageURLs)]));
const feedParser = new Marked({ gfm: true, renderer: { html: () => '' } });
const feedContent = (markdown: string) => feedParser.parse(markdown.replace(/^# .*\n+(?:> .*\n+)?/, '')) as string;

const published: PublishedPage[] = [
  { path: 'index.html', title: registry.title, description: registry.description, kind: 'collection', sharingImage: homeCard },
  { path: 'general-index/index.html', title: 'A–Z index', description: `Every chapter and subsection in ${registry.title}, A to Z.`, kind: 'index', sharingImage: homeCard },
  ...topics.map((topic): PublishedPage => ({ path: `topics/${topic.id}/index.html`, title: topic.title, description: topic.description, kind: 'article', category: topic.category, created: topic.created, updated: topic.updated, sharingImage: topicCards.get(topic.id)!, content: feedContent(topicMarkdowns.get(topic.id)!) })),
  ...sitePages.map((page): PublishedPage => ({ path: `${page.id}/index.html`, title: page.title, description: page.description, kind: 'page', sharingImage: homeCard }))
];
const markdownLink = '<link rel="alternate" type="text/markdown" href="index.md" title="Markdown">';
const metadataFor = (path: string) => {
  const page = published.find(page => page.path === path);
  if (!page) throw new Error(`Missing publication metadata: ${path}`);
  return pageMetadata(registry, page) + iconMetadata(publicIcons, path) + feedLink(registry) + (page.kind === 'index' ? '' : markdownLink);
};
const common = { themeJS, csp, edition, collection: registry, topics, wordmarkBackground, sitePages: pageLinks };
outputs.set('index.html', shell({ ...common, headMetadata: metadataFor('index.html'), description: registry.description, body: collectionBody(topics, registry, wordmarkBackground), files: files() }));
outputs.set('general-index/index.html', shell({ ...common, headMetadata: metadataFor('general-index/index.html'), title: 'A–Z index', description: `Every chapter and subsection in ${registry.title}, A to Z.`, body: indexBody(topics), files: files('index'), prefix: '../', page: 'index' }));
for (const topic of topics) {
  const fingerprints = `<!-- Markdown sources: ${topic.rendered.map(doc => `${doc.file} sha256:${doc.sha256}`).join('; ')} -->\n`;
  outputs.set(`topics/${topic.id}/index.html`, shell({ ...common, headMetadata: metadataFor(`topics/${topic.id}/index.html`), title: topic.title, description: topic.description, body: fingerprints + readerBody(topic, topics, topic.rendered, explorerFor(topic, topic.rendered), registry), files: files(topic.id), prefix: '../../', page: topic.id, created: topic.created, updated: topic.updated }));
}
for (const page of sitePages) {
  outputs.set(`${page.id}/index.html`, shell({ ...common, headMetadata: metadataFor(`${page.id}/index.html`), title: page.title, description: page.description, body: pageBody(page, pageLinks, topics, registry, '../'), files: files(page.id), prefix: '../', page: page.id }));
}
// Not a published page: no canonical URL, sitemap entry or sharing card, and never indexed.
outputs.set('404.html', shell({ ...common, headMetadata: '<meta name="robots" content="noindex">' + iconMetadata(publicIcons, '404.html', missingPrefix) + feedLink(registry), title: missingPage.title, description: missingPage.description, body: pageBody(missingPage, pageLinks, topics, registry, missingPrefix, true), files: files('404'), prefix: missingPrefix, page: '404' }));

// Each page reaches shared files through its own path to the site root. GitHub Pages serves
// 404.html at any missing path, so only that page starts from the root itself.
const rootFor = (path: string) => path === '404.html' ? missingPrefix : '../'.repeat(path.split('/').length - 1);
for (const [path, html] of outputs) outputs.set(path, html.replaceAll(ROOT, rootFor(path)));

outputs.set('sitemap.xml', sitemap(registry, published));
outputs.set('feed.xml', rssFeed(registry, published));
outputs.set('robots.txt', await read('robots.txt'));
outputs.set('llms.txt', llmsIndex(registry, topics, sitePages, edition));
outputs.set('index.md', llmsIndex(registry, topics, sitePages, edition));
outputs.set('llms-full.txt', llmsFull(registry, topics, topicMarkdowns, edition));
for (const topic of topics) outputs.set(`topics/${topic.id}/index.md`, topicMarkdowns.get(topic.id)!);
for (const page of sitePages) outputs.set(`${page.id}/index.md`, pageMarkdown(registry, page));
outputs.set('.well-known/security.txt', securityTxt(registry, edition));
outputs.set('version.json', `${JSON.stringify({ name: registry.title, version: edition.version, built: edition.built, ...(edition.commit ? { commit: edition.commit } : {}), ...(registry.repositoryUrl ? { source: registry.repositoryUrl } : {}) }, null, 2)}\n`);

// Validate every page before writing anything: local links, anchors, ids, shared files and scripts.
const exists = (target: string) => outputs.has(target) || assets.files.has(target) || publicIcons.has(target) || publishedSources.has(target);
const targetOf = (path: string, href: string) => {
  const file = decodeURIComponent(href.split('#')[0]);
  const target = file.startsWith('/') ? file.slice(missingPrefix.length) : posix.join(posix.dirname(path), file);
  return !target || target === '.' || target.endsWith('/') ? posix.join(target, 'index.html') : posix.normalize(target);
};
for (const [path, html] of outputs) {
  if (!path.endsWith('.html')) continue;
  const lightDOM = html.replace(/<template shadowrootmode="open">[\s\S]*?<\/template>/g, '');
  const elementIds = [...lightDOM.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(elementIds).size !== elementIds.length) throw new Error(`Duplicate element ids in ${path}`);
  if ((html.match(/<h1\b/g) || []).length !== 1) throw new Error(`Expected one page title in ${path}`);
  // Only the hashed theme script runs inline; no markup carries event handlers or script URLs.
  const inlineScripts = [...html.matchAll(/<script(?![^>]*\b(?:src|type="application\/(?:ld\+)?json")=?)[^>]*>([\s\S]*?)<\/script>/g)];
  if (inlineScripts.length !== 1 || inlineScripts[0][1] !== inlineThemeJS) throw new Error(`Unexpected inline script in ${path}`);
  if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(lightDOM) || /(?:href|src)\s*=\s*["']\s*javascript:/i.test(html)) throw new Error(`Inline event handler or script URL in ${path}`);
  // Everything a page loads is a local file from this build: no remote styles, scripts, fonts or images.
  const dependencies = [
    ...[...html.matchAll(/<(?:script|img|iframe|video|audio|source|embed)\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]),
    ...[...html.matchAll(/\bsrcset="([^"]+)"/g)].flatMap(match => match[1].split(',').map(candidate => candidate.trim().split(/\s+/)[0])),
    ...[...html.matchAll(/<link\b[^>]*\brel="(?:stylesheet|icon|apple-touch-icon|preload|modulepreload)"[^>]*\bhref="([^"]+)"/g)].map(match => match[1])
  ];
  for (const url of dependencies) {
    if (/^(?:[a-z]+:|\/\/)/i.test(url)) throw new Error(`Remote or embedded render dependency in ${path}: ${url.slice(0, 80)}`);
    if (!await exists(targetOf(path, url))) throw new Error(`Missing render dependency in ${path}: ${url}`);
  }
  for (const [, href] of lightDOM.matchAll(/\bhref="([^"]+)"/g)) {
    if (/^(?:[a-z]+:|\/\/)/i.test(href)) continue;
    const target = href.startsWith('#') ? path : targetOf(path, href);
    if (!await exists(target)) throw new Error(`Broken local link in ${path}: ${href}`);
    const fragment = href.split('#')[1];
    if (fragment && outputs.has(target) && !outputs.get(target)!.includes(`id="${decodeURIComponent(fragment)}"`)) throw new Error(`Broken anchor in ${path}: ${href}`);
  }
}
// Stylesheet references resolve beside the stylesheet.
for (const [, url] of assets.files.get(stylesheet)!.toString('utf8').matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
  if (/^(?:[a-z]+:|\/\/)/i.test(url) || !assets.files.has(posix.join('assets', url))) throw new Error(`Missing stylesheet dependency: ${url.slice(0, 80)}`);
}
if (published.length + 1 !== [...outputs.keys()].filter(path => path.endsWith('.html')).length || !outputs.has('404.html') || published.some(page => !outputs.has(page.path))) throw new Error('Published page inventory must match generated HTML.');
if (check) {
  if (existingEdition) {
    for (const [path, expected] of [...outputs, ...assets.files, ...publicIcons]) {
      const actual = await readFile(resolve(outputRoot, path)).catch(() => undefined);
      if (!actual?.equals(Buffer.from(expected))) throw new Error(`_site/${path} is out of date. Run npm run build:site.`);
    }
  }
  console.log(`Checked ${outputs.size} pages and files and ${assets.files.size} shared assets for edition ${edition.version}.`);
  process.exit(0);
}

// Validation completes before any output is replaced. The site bundle contains generated
// pages, shared assets and reader-facing topic sources, not build dependencies. Only
// publication builds (--site) rasterize the sharing JPEGs.
const sharingImages = site ? await renderSharingCards(cards, assets.files) : new Map<string, Buffer>();
// Each build stages its own copy, so `npm run dev` and a manual build can overlap safely.
const stage = resolve(root, `_site.build-${process.pid}`);
await rm(stage, { recursive: true, force: true });
await mkdir(resolve(stage, 'topics'), { recursive: true });
await cp(resolve(root, 'topics/topics.json'), resolve(stage, 'topics/topics.json'));
await cp(resolve(root, 'design-system/licenses'), resolve(stage, 'design-system/licenses'), { recursive: true });
if (positionPath) {
  const target = resolve(stage, relative(root, positionPath));
  await mkdir(dirname(target), { recursive: true });
  await cp(positionPath, target);
}
for (const topic of topics) {
  const source = resolve(root, 'topics', topic.id);
  await cp(source, resolve(stage, 'topics', topic.id), {
    recursive: true,
    // Artwork is published as shared WebP files; the source PNGs stay in the repository.
    filter: path => {
      const parts = relative(source, path).split('/');
      return !parts.some(part => part.startsWith('.') || part === 'node_modules') && !path.endsWith('.html') && relative(source, path) !== 'assets/illustrations';
    }
  });
}
await writeFile(resolve(stage, '.nojekyll'), '');
const write = async (path: string, data: string | Buffer) => {
  await mkdir(dirname(resolve(stage, path)), { recursive: true });
  await writeFile(resolve(stage, path), data);
};
for (const [path, data] of [...sharingImages, ...publicIcons, ...assets.files]) await write(path, data);
for (const [path, content] of outputs) await write(path, content);
// Another build may finish between removing and renaming; the last one to finish wins.
for (let attempt = 1; ; attempt++) {
  await rm(outputRoot, { recursive: true, force: true });
  try { await rename(stage, outputRoot); break; }
  catch (error) { if (attempt === 3 || !['ENOTEMPTY', 'EEXIST'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error; }
}
if (generatedReadme !== undefined && generatedReadme !== readme) {
  await writeFile(readmePath, generatedReadme);
  console.log('Updated the README.md topic table.');
}
const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
for (const [path, content] of outputs) if (path.endsWith('.html')) console.log(`Built _site/${path} (${kb(Buffer.byteLength(content))})`);
const assetBytes = [...assets.files.values()].reduce((total, data) => total + data.length, 0);
console.log(`Built ${assets.files.size} shared assets (${kb(assetBytes)}), ${outputs.size} pages and files, ${sharingImages.size} sharing images. Edition ${edition.version}.`);
