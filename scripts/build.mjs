import { readFile, writeFile, access, mkdir, rm, cp } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Marked } from 'marked';
import { preloadFile } from '@pierre/diffs/ssr';
import { shell, collectionBody, readerBody, escape } from '../design-system/layout.mjs';
import { explorerFor } from '../design-system/explorers.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const site = process.argv.includes('--site');
if (check && site) throw new Error('Use --check and --site separately.');
const read = path => readFile(resolve(root, path), 'utf8');
const [registry, css, js] = await Promise.all([
  read('topics/topics.json').then(JSON.parse), read('design-system/theme.css'), read('design-system/reader.js')
]);
const fontLicenses = await Promise.all(['newsreader-OFL.txt', 'dm-sans-OFL.txt', 'pierre-diffs-Apache-2.0.txt'].map(file => read(`design-system/licenses/${file}`)));
const fonts = `/* Embedded font and code-renderer licenses:\n${fontLicenses.join('\n\n').replaceAll('*/', '* /')}\n*/\n` + (await Promise.all([
  ['Newsreader', 'newsreader'], ['DM Sans', 'dm-sans']
].map(async ([name, file]) => {
  const data = await readFile(resolve(root, `node_modules/@fontsource-variable/${file}/files/${file}-latin-wght-normal.woff2`));
  return `@font-face{font-family:'${name}';font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${data.toString('base64')}) format('woff2');}`;
}))).join('\n');

const slug = text => text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
const plain = text => text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const safeJSON = value => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const codeCache = new Map();
async function renderCode(text, lang) {
  const key = `${lang}\n${text}`;
  if (!codeCache.has(key)) codeCache.set(key, preloadFile({
    file: { name: `example.${lang === 'yaml' ? 'yaml' : lang === 'bash' || lang === 'sh' ? 'sh' : 'txt'}`, contents: text, lang: lang || 'text' },
    options: { theme: { light: 'github-light', dark: 'github-dark' }, themeType: 'system', overflow: 'wrap', disableLineNumbers: true, disableFileHeader: true,
      unsafeCSS: ':host { color-scheme: inherit; --diffs-bg: var(--code); --diffs-fg: var(--ink); } [data-code] { padding-block: 12px; }' }
  }).then(result => result.prerenderedHTML));
  return codeCache.get(key);
}

async function renderDocument(topic, document, index) {
  const markdown = await read(`topics/${topic.id}/${document.file}`);
  const docId = `${topic.id}-doc-${index + 1}`;
  let codeIndex = 0;
  const headings = [];
  const used = new Set();
  const parser = new Marked({
    async: true, gfm: true,
    async walkTokens(token) {
      if (token.type === 'code') token.rendered = await renderCode(token.text, token.lang?.split(/\s/)[0] || 'text');
      if (token.type === 'image' && !token.href.startsWith('data:')) {
        if (/^(?:[a-z]+:|\/\/)/i.test(token.href)) throw new Error(`Download remote images into ${topic.id}/ before building: ${token.href}`);
        const imagePath = resolve(root, 'topics', topic.id, dirname(document.file), decodeURIComponent(token.href));
        const extension = imagePath.split('.').at(-1).toLowerCase();
        const mime = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[extension];
        if (!mime) throw new Error(`Unsupported image format: ${imagePath}`);
        token.href = `data:${mime};base64,${(await readFile(imagePath)).toString('base64')}`;
      }
    },
    renderer: {
      heading(token) {
        const content = this.parser.parseInline(token.tokens);
        const text = plain(content);
        let id = `${docId}-${slug(text)}`;
        while (used.has(id)) id += '-2';
        used.add(id);
        const level = text === 'Introduction' ? 2 : Math.min(6, Math.max(2, token.depth + (document.headingOffset ?? 0)));
        headings.push({ id, text, level });
        return `<h${level} id="${id}"><a class="heading-link" href="#${id}">${content}</a></h${level}>\n`;
      },
      code(token) {
        const id = `${docId}-code-${++codeIndex}`;
        return `<div class="code-example"><div class="code-toolbar"><span>${escape(token.lang || 'Terminal example')}</span><button class="small-button js-only" data-copy="${id}" aria-label="Copy code example">Copy</button></div><diffs-container><template shadowrootmode="open">${token.rendered}</template></diffs-container><script type="application/json" id="${id}">${safeJSON(token.text)}</script></div>\n`;
      },
      table(token) { return `<div class="table-wrap" tabindex="0" role="region" aria-label="Scrollable reference table">${this.constructor.prototype.table.call(this, token)}</div>`; },
      list(token) {
        const html = this.constructor.prototype.list.call(this, token);
        return !token.ordered && token.items.length >= 7 ? html.replace('<ul>', '<ul class="long-list">') : html;
      }
    }
  });
  const tokens = parser.lexer(markdown);
  const first = tokens.findIndex(token => token.type !== 'space');
  if (tokens[first]?.type !== 'heading' || tokens[first].depth !== 1) throw new Error(`${topic.id}/${document.file} must start with a level-one title.`);
  const title = plain(await parser.parseInline(tokens[first].text));
  const bodyMarkdown = markdown.replace(tokens[first].raw, '');
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

async function loadSVG(topic, file, prefix = '') {
  const source = await read(`topics/${topic.id}/${file}`);
  if (!source.trim().startsWith('<svg') || !/viewBox=/.test(source)) throw new Error(`${topic.id}/${file}: expected a standalone SVG with a viewBox`);
  if (/<script\b|<foreignObject\b|\son\w+=|@import\b/i.test(source) || /(?:href|src)=["'](?!#|data:)/i.test(source) || /url\((?!#|['"]?#|data:)/i.test(source)) throw new Error(`${topic.id}/${file}: SVG must be self-contained and script-free`);
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) throw new Error(`${topic.id}/${file}: duplicate SVG ids`);
  if (!prefix) return source;
  return source.replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/(aria-labelledby|aria-describedby)="([^"]+)"/g, (_, name, value) => `${name}="${value.split(/\s+/).map(id => prefix + id).join(' ')}"`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`);
}

const ids = new Set();
const topics = [];
for (const [index, id] of registry.topics.entries()) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Invalid topic id: ${id}`);
  const topic = JSON.parse(await read(`topics/${id}/topic.json`));
  topics.push({ ...topic, id, number: String(index + 1).padStart(2, '0') });
}
for (const topic of topics) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.id) || ids.has(topic.id)) throw new Error(`Invalid or duplicate topic id: ${topic.id}`);
  ids.add(topic.id);
  topic.coverSVG = topic.cover ? await loadSVG(topic, topic.cover, `cover-${topic.id}-`) : '';
  topic.diagramSVG = topic.explorer ? await loadSVG(topic, topic.explorer.diagram) : '';
  topic.rendered = [];
  for (const [index, document] of topic.documents.entries()) topic.rendered.push(await renderDocument(topic, document, index));
  topic.minutes = Math.ceil(topic.rendered.reduce((sum, doc) => sum + doc.markdown.split(/\s+/).length, 0) / 220);
}

const outputs = new Map();
outputs.set('index.html', shell({ title: 'The collection', description: registry.description, body: collectionBody(topics, registry), css, js, fonts, collection: registry }));
for (const topic of topics) {
  const fingerprints = `<!-- Markdown sources: ${topic.rendered.map(doc => `${doc.file} sha256:${doc.sha256}`).join('; ')} -->\n`;
  outputs.set(`topics/${topic.id}/index.html`, shell({ title: topic.title, description: topic.description, body: fingerprints + readerBody(topic, topics, topic.rendered, explorerFor(topic, topic.rendered)), css, js, fonts, collection: registry, prefix: '../../', page: topic.id }));
}

// Validate output before writing: navigation, ids, and offline render dependencies.
for (const [path, html] of outputs) {
  const lightDOM = html.replace(/<template shadowrootmode="open">[\s\S]*?<\/template>/g, '');
  const elementIds = [...lightDOM.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(elementIds).size !== elementIds.length) throw new Error(`Duplicate element ids in ${path}`);
  if ((html.match(/<h1\b/g) || []).length !== 1) throw new Error(`Expected one page title in ${path}`);
  const renderDependencies = [...html.matchAll(/<(?:script|img|iframe|link|video|audio|source)\b[^>]*\b(?:src|href)=["']([^"']+)/gi)];
  if (renderDependencies.some(([, url]) => !url.startsWith('data:')) || /@import\b/i.test(css) || /url\((?!data:|['"]?data:)/i.test(css)) throw new Error(`Non-embedded render dependency in ${path}`);
  for (const [, href] of lightDOM.matchAll(/\bhref="([^"]+)"/g)) {
    if (/^(?:[a-z]+:|\/\/)/i.test(href)) continue;
    const [file, fragment] = href.split('#');
    const target = file ? resolve(root, dirname(path), decodeURIComponent(file)) : resolve(root, path);
    const targetPath = relative(root, target);
    if (!outputs.has(targetPath)) await access(target).catch(() => { throw new Error(`Broken local link in ${path}: ${href}`); });
    if (fragment && outputs.has(targetPath)) {
      const targetHTML = outputs.get(targetPath);
      if (!targetHTML.includes(`id="${decodeURIComponent(fragment)}"`)) throw new Error(`Broken anchor in ${path}: ${href}`);
    }
  }
  if (check) {
    const existing = await read(path).catch(() => '');
    if (existing !== html) throw new Error(`${path} is out of date. Run npm run build.`);
  }
}

// Validation completes before any output is replaced. The site bundle contains
// only generated pages and reader-facing topic sources, not build dependencies.
const outputRoot = site ? resolve(root, '_site') : root;
if (site) {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  for (const file of ['README.md', 'AGENTS.md', 'CLAUDE.md', 'design-system/README.md', 'design-system/licenses', 'topics/topics.json']) {
    await cp(resolve(root, file), resolve(outputRoot, file), { recursive: true });
  }
  for (const topic of topics) {
    const source = resolve(root, 'topics', topic.id);
    await cp(source, resolve(outputRoot, 'topics', topic.id), {
      recursive: true,
      filter: path => {
        const parts = relative(source, path).split('/');
        return !parts.some(part => part.startsWith('.') || part === 'node_modules') && relative(source, path) !== 'index.html';
      }
    });
  }
  await writeFile(resolve(outputRoot, '.nojekyll'), '');
}
for (const [path, html] of outputs) {
  if (!check) {
    await mkdir(dirname(resolve(outputRoot, path)), { recursive: true });
    await writeFile(resolve(outputRoot, path), html);
  }
  console.log(`${check ? 'Verified' : 'Built'} ${site ? '_site/' : ''}${path} (${Math.round(Buffer.byteLength(html) / 1024)} KB)`);
}
