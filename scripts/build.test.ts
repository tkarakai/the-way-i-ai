import type { TestContext } from 'node:test';
import type { SpawnSyncReturns } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, symlink, readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { topicSource, splitFrontMatter } from './markdown-source.ts';
import { stringify } from 'yaml';
import jpeg from 'jpeg-js';
import type { Topic } from '../design-system/types.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function fixture(t: TestContext) {
  const path = await mkdtemp(resolve(tmpdir(), 'the-way-i-ai-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  for (const item of ['scripts', 'design-system', 'topics', 'package.json', 'README.md', 'AGENTS.md', 'CLAUDE.md', 'robots.txt']) {
    await cp(resolve(root, item), resolve(path, item), { recursive: true, filter: file => !file.endsWith('.html') });
  }
  // Source-editing fixtures start without optional delivered artwork bindings.
  // Actual deliveries and partial/missing files have separate acceptance coverage.
  const registry = JSON.parse(await readFile(resolve(path, 'topics/topics.json'), 'utf8')) as { topics: string[] };
  for (const id of registry.topics) await rm(resolve(path, 'topics', id, 'assets/illustrations'), { recursive: true, force: true });
  await symlink(resolve(root, 'node_modules'), resolve(path, 'node_modules'), 'dir');
  return {
    path,
    read: (file: string) => readFile(resolve(path, file), 'utf8'),
    write: (file: string, text: string) => writeFile(resolve(path, file), text),
    build: (...args: string[]) => spawnSync(process.execPath, [resolve(path, 'scripts/build.ts'), ...args], { cwd: path, encoding: 'utf8' })
  };
}
function passed(result: SpawnSyncReturns<string>) { assert.equal(result.status, 0, result.stderr || result.stdout); }
async function updateMetadata(f: Awaited<ReturnType<typeof fixture>>, id: string, update: (metadata: Record<string, unknown>) => void) {
  const file = `topics/${id}/README.md`;
  const { metadata, body } = splitFrontMatter(await f.read(file), file);
  update(metadata!);
  await f.write(file, `---\n${stringify(metadata)}---\n${body}`);
}

// Synthetic artwork covers the generic explorer without retaining retired illustrations.
async function addExplorer(f: Awaited<ReturnType<typeof fixture>>, id: string) {
  await mkdir(resolve(f.path, `topics/${id}/assets`), { recursive: true });
  await f.write(`topics/${id}/assets/test-diagram.svg`, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle id="test-node" cx="5" cy="5" r="3"/></svg>');
  await updateMetadata(f, id, metadata => {
    metadata.explorer = {
      title: 'Test explorer', instruction: 'Select a panel', caption: 'Test artwork', controls: 'labels', diagram: 'assets/test-diagram.svg',
      panels: [{ id: 'test', label: 'Test panel', context: { document: 'README.md', heading: 'Introduction' }, source: id === 'agent-roles' ? { document: 'README.md', excerpt: 'professional-lens' } : { document: 'WORKFLOW.md', heading: '1. Create a worktree' }, highlight: ['test-node'] }]
    };
  });
}

test('an ordinary new topic builds without renderer changes; its image is embedded and navigation is relative', async t => {
  const f = await fixture(t);
  const registry = JSON.parse(await f.read('topics/topics.json'));
  registry.topics.push('new-idea');
  await f.write('topics/topics.json', JSON.stringify(registry));
  await mkdir(resolve(f.path, 'topics/new-idea/assets'), { recursive: true });
  const diagram = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>A source-owned image</title><circle cx="5" cy="5" r="3"/></svg>';
  await f.write('topics/new-idea/assets/example.svg', diagram);
  await f.write('topics/new-idea/README.md', '---\ncategory: Practice\ndescription: A new source bundle.\nthesis: New ideas stand alone.\n---\n\n# A new idea\n\n## The premise\n\nThis complete paragraph belongs to the source.\n\n![The example](assets/example.svg)\n');
  passed(f.build());
  const index = await f.read('index.html');
  const html = await f.read('topics/new-idea/index.html');
  assert.ok(index.includes('href="topics/new-idea/index.html"'));
  assert.deepEqual([...index.matchAll(/<a class="topic-card" href="([^"]+)"/g)].map(match => match[1]), registry.topics.toReversed().map((id: string) => `topics/${id}/index.html`));
  assert.deepEqual([...html.matchAll(/<a class="nav-topic" href="([^"]+)"/g)].map(match => match[1]), registry.topics.map((id: string) => `../${id}/index.html`), 'Homepage order does not mutate the reading order');
  assert.match(index, new RegExp(`class="topic-number">${String(registry.topics.length).padStart(2, '0')}<`));
  assert.ok(html.includes('This complete paragraph belongs to the source.'));
  assert.ok(html.includes('href="../../index.html"'));
  const embedded = html.match(/src="data:image\/svg\+xml;base64,([^"]+)"/);
  assert.ok(embedded, 'The generated standalone edition must embed the image');
  assert.equal(Buffer.from(embedded[1], 'base64').toString(), diagram);
  assert.ok(!html.includes('data-explorer aria-'), 'An explorer is optional');
  assert.ok(!html.includes('article:published_time'), 'Missing authored dates omit creation metadata');
  assert.ok(!html.includes('class="topic-dates"'), 'Missing authored dates omit the visible date block');
  assert.ok(!html.includes('min read'), 'Reading-time estimates are not rendered');
  const search = JSON.parse(index.match(/<script type="application\/json" id="collection-search-data">([\s\S]*?)<\/script>/)![1]) as { title: string; text: string; href: string }[];
  assert.ok(search.some(entry => entry.title === 'The premise' && entry.text.includes('This complete paragraph belongs to the source.') && entry.href === 'topics/new-idea/index.html#new-idea-doc-1-the-premise'));
  const nestedSearch = JSON.parse(html.match(/<script type="application\/json" id="collection-search-data">([\s\S]*?)<\/script>/)![1]) as { href: string }[];
  assert.ok(nestedSearch.every(entry => entry.href.startsWith('../../topics/')));
  passed(f.build('--check'));
});

test('all topics derive titles and nested outlines from Markdown, preserving authored numbering', async t => {
  const f = await fixture(t);
  const file = 'topics/just-enough-context/README.md';
  const preamble = '---\ncategory: Practice\ndescription: One article description.\nthesis: A useful takeaway.\n---\n\n';
  await f.write(file, `${preamble}# A source-owned title\n\nOpening prose for collection search.\n\n## 07. Authored chapter\n\nChapter text.\n\n### Introduction\n\nNested prose.\n\n### Another authored heading\n\nMore prose.\n\n## Unnumbered chapter\n\nFinal prose.\n\n\`\`\`text\n# This is code, not a second title\n\`\`\`\n`);
  passed(f.build());
  const html = await f.read('topics/just-enough-context/index.html');
  assert.match(html, /<title>A source-owned title · The Way I AI<\/title>/);
  assert.match(html, /<h1 id="just-enough-context-doc-1-title">A source-owned title<\/h1>/);
  assert.equal((html.match(/>A source-owned title<\/h[1-6]>/g) ?? []).length, 1);
  assert.ok(!html.includes('class="source-heading"'));
  assert.ok(!html.includes('class="toc-group"'));
  assert.ok(!html.includes('The concept'));
  assert.match(html, /<li class="toc-chapter" data-subsection="false"><a class="toc-link" href="#just-enough-context-doc-1-07-authored-chapter">07\. Authored chapter<\/a><ol class="toc-list"><li data-subsection="true">/);
  assert.match(html, /<h3 id="just-enough-context-doc-1-introduction">/);
  assert.match(html, /<h2 id="just-enough-context-doc-1-unnumbered-chapter">/);
  const index = await f.read('index.html');
  assert.match(index, /id="topic-just-enough-context-title">A source-owned title<\/h3>/);
  const multipart = await f.read('topics/worktrees/index.html');
  assert.ok(!multipart.includes('class="source-heading"'));
  assert.equal((multipart.match(/class="toc-document-title"/g) ?? []).length, 2);
  assert.equal((multipart.match(/class="document-title"/g) ?? []).length, 1, 'Only companion documents need an additional title boundary');
  const entries = JSON.parse(html.match(/<script type="application\/json" id="collection-search-data">([\s\S]*?)<\/script>/)![1]) as { title: string; text: string; href: string }[];
  assert.ok(entries.some(entry => entry.title === 'A source-owned title' && entry.text.includes('Opening prose') && entry.href.endsWith('#just-enough-context-doc-1-title')));
  passed(f.build('--check'));

  const original = await f.read(file);
  const failures = [
    { markdown: `${original}\n# Another title\n`, error: /exactly one level-one title/ },
    { markdown: `${preamble}## No document title\n`, error: /must start with a level-one title/ },
    { markdown: original.replace('category: Practice', 'title: A competing title\ncategory: Practice'), error: /title comes from/ },
    { markdown: original.replace('category: Practice', 'documents: [README.md, README.md]\ncategory: Practice'), error: /documents must be unique/ },
    { markdown: original.replace('category: Practice', 'documents: [README.md, ../outside.md]\ncategory: Practice'), error: /documents must be unique local/ },
    { markdown: `${preamble}# Title\n\n### Orphaned subsection\n`, error: /must not skip levels/ },
  ];
  for (const failure of failures) {
    await f.write(file, failure.markdown);
    const result = f.build();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, failure.error);
    assert.equal(await f.read('topics/just-enough-context/index.html'), html, 'Invalid input preserves generated output');
  }
});

test('a single README supplies article metadata without topic.json and keeps blockquotes as content', async t => {
  const f = await fixture(t);
  const file = 'topics/just-enough-context/README.md';
  const source = '---\ncategory: Test category\ndescription: >-\n  A front matter description\n  spanning two lines.\nthesis: A reusable takeaway.\n---\n\n# A single-file article\n\n> An ordinary opening quotation.\n\n## 9. Keep this heading\n\nArticle prose.\n\n### Nested heading\n\nNested prose.\n';
  await f.write(file, source);
  await assert.rejects(access(resolve(f.path, 'topics/just-enough-context/topic.json')));
  passed(f.build());
  const html = await f.read('topics/just-enough-context/index.html');
  assert.match(html, /<title>A single-file article · The Way I AI<\/title>/);
  assert.match(html, /<p class="lead">A front matter description spanning two lines\.<\/p>/);
  assert.match(html, /<meta name="description" content="A front matter description spanning two lines\.">/);
  const prose = html.match(/<div class="prose" data-source="README.md">([\s\S]*?)<\/section>/)![1];
  assert.match(prose, /<blockquote>\s*<p>An ordinary opening quotation\.<\/p>\s*<\/blockquote>/);
  assert.ok(!prose.includes('description:') && !prose.includes('A front matter description'));
  assert.match(await f.read('index.html'), /<p>A front matter description spanning two lines\.<\/p>/);
  passed(f.build('--site'));
  assert.equal(await f.read(`_site/${file}`), source, 'Publication keeps the full authored source');
  await assert.rejects(access(resolve(f.path, '_site/topics/just-enough-context/topic.json')));
  passed(f.build('--check'));

  await f.write('topics/just-enough-context/topic.json', JSON.stringify(topicSource(source, file).topic));
  const conflict = f.build();
  assert.notEqual(conflict.status, 0);
  assert.match(conflict.stderr, /topic.json is no longer supported/);
  assert.equal(await f.read('topics/just-enough-context/index.html'), html);
  await rm(resolve(f.path, 'topics/just-enough-context/topic.json'));
  await f.write(file, source.replace('thesis: A reusable takeaway.\n', ''));
  const invalid = f.build();
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /thesis.*nonempty string/);
  assert.equal(await f.read('topics/just-enough-context/index.html'), html, 'Invalid metadata preserves output');
});

test('front-matter dates work without Git and omit redundant same-day updates', async t => {
  const f = await fixture(t);
  for (const [date, count] of [['2024-01-02', 1], ['2025-03-04', 2]] as const) {
    await updateMetadata(f, 'just-enough-context', metadata => { metadata.created = '2024-01-02'; metadata.updated = date; });
    passed(f.build());
    const html = await f.read('topics/just-enough-context/index.html');
    const dates = html.match(/<dl class="topic-dates">([\s\S]*?)<\/dl>/)![1];
    assert.equal((dates.match(/<time /g) ?? []).length, count);
    assert.match(html, /article:published_time" content="2024-01-02"/);
    assert.ok(html.includes(`article:modified_time" content="${date}"`));
    assert.match(dates, /Created<\/dt><dd><time datetime="2024-01-02">Jan 2, 2024<\/time>/);
    if (count === 2) assert.match(dates, /Last Updated<\/dt><dd><time datetime="2025-03-04">Mar 4, 2025<\/time>/);
  }
});

test('squash merges and source archives preserve byte-identical generated HTML', async t => {
  const f = await fixture(t);
  const git = (args: string[], date?: string) => spawnSync('git', args, { cwd: f.path, encoding: 'utf8', env: date ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : process.env });
  passed(f.build());
  passed(git(['init', '-b', 'main']));
  passed(git(['config', 'user.name', 'Test Author']));
  passed(git(['config', 'user.email', 'test@example.com']));
  passed(git(['add', 'topics']));
  passed(git(['commit', '-m', 'Initial sources'], '2001-01-01T12:00:00Z'));
  passed(git(['checkout', '-b', 'feature']));
  const file = 'topics/agent-roles/README.md';
  await f.write(file, `${await f.read(file)}\nA source change before the squash merge.\n`);
  passed(f.build());
  const registry = JSON.parse(await f.read('topics/topics.json')) as { topics: string[] };
  const paths = ['index.html', ...registry.topics.map(id => `topics/${id}/index.html`)];
  const expected = await Promise.all(paths.map(path => f.read(path)));
  passed(git(['add', 'topics']));
  passed(git(['commit', '-m', 'Feature sources and output'], '2002-02-02T12:00:00Z'));
  passed(git(['checkout', 'main']));
  passed(git(['merge', '--squash', 'feature']));
  passed(git(['commit', '-m', 'Squashed feature'], '2035-03-03T12:00:00Z'));
  passed(f.build('--check'));
  passed(f.build());
  assert.deepEqual(await Promise.all(paths.map(path => f.read(path))), expected);
  await rm(resolve(f.path, '.git'), { recursive: true });
  passed(f.build('--check'));
  passed(f.build());
  assert.deepEqual(await Promise.all(paths.map(path => f.read(path))), expected);
});

test('the shared wordmark embeds its background once per page and missing assets preserve output', async t => {
  const f = await fixture(t);
  passed(f.build());
  const index = await f.read('index.html');
  for (const removed of ['One idea, two ways in.', 'one connected practice', 'Practical workflows. Useful mental models.', 'AI in practice', 'A collection of ideas. A practice in progress.', 'Thoughtfully made. Freely shared.', 'Independent thinking. Practical tools.']) {
    assert.ok(!index.includes(removed), `The collection omits removed copy: ${removed}`);
  }
  assert.ok(index.includes('id="topics-heading">The collection'));
  assert.match(index, /<span class="rotator-item is-current">snacks<\/span><span class="rotator-item">tokens<\/span>/);
  assert.match(index, /<span class="sr-only">snacks, tokens, subsidized subs,/);
  assert.ok(index.includes('<span class="intro-accent">practice</span>'));
  assert.ok(!index.includes('Explore the collection'));
  assert.ok(index.includes('data-ambient="F"'));
  assert.ok(index.includes('class="ambient-canvas" aria-hidden="true" style="--ambient-intensity:0.2"'));
  const source = await readFile(resolve(f.path, 'topics/assets/logo-bg.png'));
  for (const file of ['index.html', 'topics/worktrees/index.html', 'topics/agent-roles/index.html']) {
    const html = await f.read(file);
    const images = [...html.matchAll(/--wordmark-wave-image: url\("data:image\/png;base64,([^"]+)"\)/g)];
    assert.equal(images.length, 1, 'The standalone page embeds one shared copy of the wave');
    assert.deepEqual(Buffer.from(images[0][1], 'base64'), source);
    const header = html.match(/<header class="masthead">[\s\S]*?<\/header>/)![0];
    if (file === 'index.html') {
      assert.ok(!header.includes('class="brand"'), 'The homepage hero makes a masthead wordmark redundant');
    } else {
      assert.match(header, /class="brand" href="\.\.\/\.\.\/index.html" aria-label="The Way I AI — home"/);
      assert.match(header, /<span class="wordmark" aria-hidden="true"><span class="title-art"/);
      assert.ok(!header.match(/<a class="brand"[\s\S]*?<\/a>/)![0].includes('<svg'), 'The shared wordmark replaces the old asterisk');
    }
    assert.match(header, /class="repo-link" href="https:\/\/github.com\/tkarakai\/the-way-i-ai" target="_blank" rel="noopener noreferrer"/);
    assert.match(header, /aria-label="View the repository on GitHub \(opens in a new tab\)"/);
    assert.equal([...html.matchAll(/<span class="title-art"/g)].length, 1);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1, 'The header logo must not create an extra page heading');
  }
  passed(f.build('--check'));

  const registry = JSON.parse(await f.read('topics/topics.json'));
  delete registry.titleBackground;
  await f.write('topics/topics.json', JSON.stringify(registry));
  passed(f.build());
  const withoutBackground = await f.read('index.html');
  assert.ok(!withoutBackground.includes('<span class="title-art"'));

  registry.titleBackground = 'assets/missing.png';
  await f.write('topics/topics.json', JSON.stringify(registry));
  const missing = f.build();
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /missing\.png/);
  assert.equal(await f.read('index.html'), withoutBackground);

  registry.titleBackground = '../outside.png';
  await f.write('topics/topics.json', JSON.stringify(registry));
  const outside = f.build('--site');
  assert.notEqual(outside.status, 0);
  assert.match(outside.stderr, /local image inside topics/);
});

test('ambient configuration keeps F homepage-only, allows omission, and rejects invalid settings before writing', async t => {
  const f = await fixture(t);
  const registry = JSON.parse(await f.read('topics/topics.json'));
  passed(f.build());
  assert.ok((await f.read('index.html')).includes('window.drawMurmuration ='));
  assert.ok(!(await f.read('topics/worktrees/index.html')).includes('window.drawMurmuration'));
  delete registry.ambientBackground;
  await f.write('topics/topics.json', JSON.stringify(registry));
  passed(f.build());
  const original = await f.read('index.html');
  assert.ok(!original.includes('data-ambient="A"'));
  assert.ok(!original.includes('<canvas class="ambient-canvas"'));
  assert.ok(!original.includes('window.drawMurmuration'));
  for (const patch of [{ ambientBackground: 'A' }, { ambientBackground: 'B' }, { ambientIntensity: 20 }, { ambientIntensity: -.1 }, { ambientIntensity: '0.2' }]) {
    await f.write('topics/topics.json', JSON.stringify({ ...registry, ...patch }));
    const invalid = f.build();
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /ambientBackground|ambientIntensity/);
    assert.equal(await f.read('index.html'), original);
  }
});

test('wave positioning is optional, validated before output changes, and tied to its image source', async t => {
  const f = await fixture(t);
  passed(f.build());
  const original = await f.read('index.html');
  const registry = JSON.parse(await f.read('topics/topics.json'));
  const file = `topics/${registry.titleBackgroundPosition}`;
  const position = JSON.parse(await f.read(file));
  const invalid = structuredClone(position);
  invalid.corners.topLeft = invalid.corners.bottomRight;
  await f.write(file, JSON.stringify(invalid));
  const crossed = f.build();
  assert.notEqual(crossed.status, 0);
  assert.match(crossed.stderr, /convex clockwise quadrilateral/);
  assert.equal(await f.read('index.html'), original);
  await f.write(file, JSON.stringify({ ...position, source: 'topics/assets/another.png' }));
  const wrongSource = f.build();
  assert.notEqual(wrongSource.status, 0);
  assert.match(wrongSource.stderr, /source must match/);
  assert.equal(await f.read('index.html'), original);
  registry.titleBackgroundPosition = '../outside.json';
  await f.write('topics/topics.json', JSON.stringify(registry));
  const outside = f.build('--site');
  assert.notEqual(outside.status, 0);
  assert.match(outside.stderr, /local JSON file inside topics/);
  assert.equal(await f.read('index.html'), original);
  delete registry.titleBackgroundPosition;
  await f.write('topics/topics.json', JSON.stringify(registry));
  passed(f.build());
  assert.match(await f.read('index.html'), /<span class="title-art"/);
  passed(f.build('--check'));
});

test('a named Markdown excerpt is shared by the full reader and visual explorer; stale output is rejected', async t => {
  const f = await fixture(t);
  await addExplorer(f, 'agent-roles');
  passed(f.build());
  const file = 'topics/agent-roles/README.md';
  const original = await f.read(file);
  const changed = original.replace('The industry knowledge, terminology, conventions, methods, assumptions, and professional reasoning associated with a discipline.', 'This source paragraph is reused in the explorer and full reader.');
  assert.notEqual(changed, original);
  await f.write(file, changed);
  const stale = f.build('--check');
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /out of date/);
  passed(f.build());
  const html = await f.read('topics/agent-roles/index.html');
  const visibleHTML = html.replace(/<script type="application\/json" id="collection-search-data">[\s\S]*?<\/script>/, '');
  assert.equal(visibleHTML.split('This source paragraph is reused in the explorer and full reader.').length - 1, 2);
  const search = JSON.parse(html.match(/<script type="application\/json" id="collection-search-data">([\s\S]*?)<\/script>/)![1]) as { text: string }[];
  assert.ok(search.some(entry => entry.text.includes('This source paragraph is reused in the explorer and full reader.')));
  passed(f.build('--check'));
});

test('broken explorer references fail before any generated file is overwritten', async t => {
  const f = await fixture(t);
  await addExplorer(f, 'worktrees');
  passed(f.build());
  const before = await f.read('index.html');
  await updateMetadata(f, 'worktrees', metadata => {
    const explorer = metadata.explorer as NonNullable<Topic['explorer']>;
    explorer.panels[0].source = { document: 'WORKFLOW.md', heading: 'A heading that does not exist' };
  });
  const result = f.build();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /heading must match exactly once/);
  assert.equal(await f.read('index.html'), before);
});

test('a missing SVG highlight target fails instead of silently losing the explanation', async t => {
  const f = await fixture(t);
  await addExplorer(f, 'agent-roles');
  await updateMetadata(f, 'agent-roles', metadata => {
    const explorer = metadata.explorer as NonNullable<Topic['explorer']>;
    explorer.panels[0].highlight = ['missing-node'];
  });
  const result = f.build();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing SVG node/);
});

test('discovery metadata matches the published inventory and stale sitemap checks fail', async t => {
  const f = await fixture(t);
  passed(f.build());
  const registry = JSON.parse(await f.read('topics/topics.json')) as { topics: string[]; siteUrl: string };
  const paths = ['index.html', 'general-index/index.html', ...registry.topics.map(id => `topics/${id}/index.html`)];
  const xml = await f.read('sitemap.xml');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.equal(urls.length, paths.length);
  for (const [index, path] of paths.entries()) {
    const html = await f.read(path);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/g) ?? [];
    assert.equal(canonical.length, 1);
    assert.ok(canonical[0].includes(`href="${urls[index]}"`));
    const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    assert.equal(data.url, urls[index]);
    assert.equal(data['@type'], index === 0 ? 'WebSite' : index === 1 ? 'CollectionPage' : 'Article');
    assert.match(html, /rel="alternate" type="application\/rss\+xml"/);
    assert.ok(html.includes(`href="${new URL('feed.xml', registry.siteUrl).href}"`));
  }
  assert.doesNotMatch(xml, /README|pages\/|previews\/|404/);
  const robots = await f.read('robots.txt');
  assert.ok(robots.includes(`Sitemap: ${new URL('sitemap.xml', registry.siteUrl).href}`));
  const groups: { agents: string[]; disallow: string[] }[] = [];
  for (const block of robots.split(/\n\s*\n/)) {
    const agents = [...block.matchAll(/^User-agent:\s*(\S+)/gm)].map(match => match[1].toLowerCase());
    const disallow = [...block.matchAll(/^Disallow:[ \t]*(.*)$/gm)].map(match => match[1].trim());
    if (agents.length) groups.push({ agents, disallow });
  }
  const blocked = (agent: string) => (groups.find(group => group.agents.includes(agent.toLowerCase())) ?? groups.find(group => group.agents.includes('*')))!.disallow.includes('/');
  for (const agent of ['Googlebot', 'Bingbot', 'Applebot', 'OAI-SearchBot', 'Claude-SearchBot']) assert.equal(blocked(agent), false, agent);
  for (const agent of ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'meta-externalagent', 'Bytespider']) assert.equal(blocked(agent), true, agent);
  passed(f.build('--check'));
  await f.write('sitemap.xml', '<stale/>');
  const stale = f.build('--check');
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /sitemap.xml is out of date/);
  assert.equal(await f.read('sitemap.xml'), '<stale/>');
  passed(f.build());
  const feed = await f.read('feed.xml');
  assert.equal((feed.match(/<item>/g) ?? []).length, registry.topics.length);
  await f.write('feed.xml', '<stale/>');
  const staleFeed = f.build('--check');
  assert.notEqual(staleFeed.status, 0);
  assert.match(staleFeed.stderr, /feed.xml is out of date/);
  assert.equal(await f.read('feed.xml'), '<stale/>');
});

test('the publication bundle is clean and contains the same standalone pages and their source links', async t => {
  const f = await fixture(t);
  passed(f.build());
  await mkdir(resolve(f.path, '_site'), { recursive: true });
  await f.write('_site/stale.html', 'Old publication');
  passed(f.build('--site'));
  for (const file of ['index.html', 'general-index/index.html', 'topics/worktrees/index.html', 'topics/agent-roles/index.html', 'sitemap.xml', 'feed.xml', 'robots.txt']) {
    assert.equal(await f.read(`_site/${file}`), await f.read(file));
  }
  assert.equal(await f.read('_site/topics/worktrees/README.md'), await f.read('topics/worktrees/README.md'));
  assert.equal(await f.read('_site/topics/agent-roles/README.md'), await f.read('topics/agent-roles/README.md'));
  assert.deepEqual(await readFile(resolve(f.path, '_site/topics/assets/logo-bg.png')), await readFile(resolve(f.path, 'topics/assets/logo-bg.png')));
  assert.equal(await f.read('_site/topics/assets/title-wave-position.json'), await f.read('topics/assets/title-wave-position.json'));
  for (const file of ['favicon.ico', 'favicon-16.png', 'favicon-32.png', 'favicon-48.png', 'apple-touch-icon.png', 'favicon-192.png', 'favicon-512.png']) {
    const approved = await readFile(resolve(f.path, 'design-system/assets/favicon', file));
    assert.deepEqual(await readFile(resolve(f.path, file)), approved);
    assert.deepEqual(await readFile(resolve(f.path, '_site', file)), approved);
  }
  const sharingPaths = new Set<string>();
  const topicRegistry = JSON.parse(await f.read('topics/topics.json')) as { topics: string[]; siteUrl: string };
  for (const page of ['index.html', 'general-index/index.html', ...topicRegistry.topics.map(id => `topics/${id}/index.html`)]) {
    const html = await f.read(`_site/${page}`);
    const imageURL = html.match(/<meta property="og:image" content="([^"]+)">/)![1];
    assert.match(html, /name="twitter:card" content="summary_large_image"/);
    const path = new URL(imageURL).pathname.slice(new URL(topicRegistry.siteUrl).pathname.length);
    sharingPaths.add(path);
    const data = await readFile(resolve(f.path, '_site', path));
    const image = jpeg.decode(data, { useTArray: true });
    assert.deepEqual([image.width, image.height], [1200, 630]);
    assert.ok(data.length < 300_000, 'Sharing JPEGs stay compact');
  }
  assert.equal(sharingPaths.size, topicRegistry.topics.length + 1, 'The A–Z index reuses the collection card');
  const topicHead = (await f.read('_site/topics/worktrees/index.html')).split('</head>')[0];
  assert.match(topicHead, /href="\.\.\/\.\.\/favicon.ico"/);
  assert.match(topicHead, /href="\.\.\/\.\.\/apple-touch-icon.png"/);
  assert.match(topicHead, /rel="icon" type="image\/png" sizes="32x32" href="data:image\/png;base64,/);
  await access(resolve(f.path, '_site/.nojekyll'));
  await assert.rejects(access(resolve(f.path, '_site/stale.html')));
  await assert.rejects(access(resolve(f.path, '_site/node_modules')));
  await assert.rejects(access(resolve(f.path, '_site/scripts')));
});


test('the local preview serves the generated site, links and images without serving paths outside the bundle', async t => {
  const f = await fixture(t);
  passed(f.build('--site'));
  const child = spawn(process.execPath, [resolve(f.path, 'scripts/preview.ts')], { cwd: f.path, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const base = await new Promise<string>((resolveURL, reject) => {
      const timer = setTimeout(() => reject(new Error('Preview did not start')), 10000);
      let output = '';
      child.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/Preview: (http:\/\/127\.0\.0\.1:\d+\/)/);
        if (match) { clearTimeout(timer); resolveURL(match[1]); }
      });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Preview exited with ${code}`)); });
    });
    const response = await fetch(base);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    assert.equal(await response.text(), await f.read('_site/index.html'));
    for (const file of ['topics/worktrees/index.html', 'topics/agent-roles/README.md', 'topics/topics.json', 'sitemap.xml', 'feed.xml', 'robots.txt', 'favicon.ico', 'apple-touch-icon.png']) {
      const linked = await fetch(new URL(file, base));
      assert.equal(linked.status, 200);
      if (file === 'sitemap.xml') assert.match(linked.headers.get('content-type') ?? '', /application\/xml/);
      if (file === 'feed.xml') assert.match(linked.headers.get('content-type') ?? '', /application\/rss\+xml/);
      if (file === 'robots.txt') assert.match(linked.headers.get('content-type') ?? '', /text\/plain/);
      if (file.endsWith('.ico') || file.endsWith('.png')) {
        assert.deepEqual(Buffer.from(await linked.arrayBuffer()), await readFile(resolve(f.path, '_site', file)));
      } else assert.equal(await linked.text(), await f.read(`_site/${file}`));
    }
    const homepage = await f.read('_site/index.html');
    const sharingURL = homepage.match(/<meta property="og:image" content="([^"]+)">/)![1];
    const shared = await fetch(new URL(new URL(sharingURL).pathname, base));
    assert.equal(shared.status, 200);
    assert.match(shared.headers.get('content-type') ?? '', /image\/jpeg/);
    assert.deepEqual([jpeg.decode(Buffer.from(await shared.arrayBuffer()), { useTArray: true }).width], [1200]);
    const head = await fetch(base, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal((await fetch(new URL('missing.html', base))).status, 404);
    assert.equal((await fetch(new URL('%2e%2e%2fpackage.json', base))).status, 403);
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
  } finally {
    child.kill('SIGTERM');
    await new Promise<void>(resolveExit => { if (child.exitCode !== null || child.signalCode) resolveExit(); else child.once('exit', () => resolveExit()); });
  }
});
