import type { TestContext } from 'node:test';
import type { SpawnSyncReturns } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, symlink, readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function fixture(t: TestContext) {
  const path = await mkdtemp(resolve(tmpdir(), 'the-way-i-ai-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  for (const item of ['scripts', 'design-system', 'topics', 'package.json', 'README.md', 'AGENTS.md', 'CLAUDE.md']) {
    await cp(resolve(root, item), resolve(path, item), { recursive: true, filter: file => !file.endsWith('.html') });
  }
  await symlink(resolve(root, 'node_modules'), resolve(path, 'node_modules'), 'dir');
  return {
    path,
    read: (file: string) => readFile(resolve(path, file), 'utf8'),
    write: (file: string, text: string) => writeFile(resolve(path, file), text),
    build: (...args: string[]) => spawnSync(process.execPath, [resolve(path, 'scripts/build.ts'), ...args], { cwd: path, encoding: 'utf8' })
  };
}
function passed(result: SpawnSyncReturns<string>) { assert.equal(result.status, 0, result.stderr || result.stdout); }

test('an ordinary new topic builds without renderer changes; its image is embedded and navigation is relative', async t => {
  const f = await fixture(t);
  const registry = JSON.parse(await f.read('topics/topics.json'));
  registry.topics.push('new-idea');
  await f.write('topics/topics.json', JSON.stringify(registry));
  await mkdir(resolve(f.path, 'topics/new-idea/assets'), { recursive: true });
  await f.write('topics/new-idea/topic.json', JSON.stringify({ title: 'A new idea', category: 'Practice', description: 'A new source bundle.', thesis: 'New ideas stand alone.', documents: [{ file: 'README.md', label: 'The idea' }] }));
  const diagram = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>A source-owned image</title><circle cx="5" cy="5" r="3"/></svg>';
  await f.write('topics/new-idea/assets/example.svg', diagram);
  await f.write('topics/new-idea/README.md', '# A new idea\n\n## The premise\n\nThis complete paragraph belongs to the source.\n\n![The example](assets/example.svg)\n');
  passed(f.build());
  const index = await f.read('index.html');
  const html = await f.read('topics/new-idea/index.html');
  assert.ok(index.includes('href="topics/new-idea/index.html"'));
  assert.ok(html.includes('This complete paragraph belongs to the source.'));
  assert.ok(html.includes('href="../../index.html"'));
  const embedded = html.match(/src="data:image\/svg\+xml;base64,([^"]+)"/);
  assert.ok(embedded, 'The generated standalone edition must embed the image');
  assert.equal(Buffer.from(embedded[1], 'base64').toString(), diagram);
  assert.ok(!html.includes('data-explorer aria-'), 'An explorer is optional');
  assert.ok(!html.includes('article:published_time'), 'Missing Git history omits creation metadata');
  assert.ok(!html.includes('class="topic-dates"'), 'Missing Git history omits the visible date block');
  assert.ok(!html.includes('min read'), 'Reading-time estimates are not rendered');
  const search = JSON.parse(index.match(/<script type="application\/json" id="collection-search-data">([\s\S]*?)<\/script>/)![1]) as { title: string; text: string; href: string }[];
  assert.ok(search.some(entry => entry.title === 'The premise' && entry.text.includes('This complete paragraph belongs to the source.') && entry.href === 'topics/new-idea/index.html#new-idea-doc-1-the-premise'));
  const nestedSearch = JSON.parse(html.match(/<script type="application\/json" id="collection-search-data">([\s\S]*?)<\/script>/)![1]) as { href: string }[];
  assert.ok(nestedSearch.every(entry => entry.href.startsWith('../../topics/')));
  passed(f.build('--check'));
});

test('topic dates come from Git history and are emitted as metadata and visible dates', async t => {
  const f = await fixture(t);
  const git = (args: string[], date?: string) => spawnSync('git', args, { cwd: f.path, encoding: 'utf8', env: date ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : process.env });
  assert.equal(git(['init']).status, 0);
  assert.equal(git(['config', 'user.name', 'Test Author']).status, 0);
  assert.equal(git(['config', 'user.email', 'test@example.com']).status, 0);
  assert.equal(git(['add', 'topics/agent-roles']).status, 0);
  assert.equal(git(['commit', '-m', 'Create agent roles'], '2024-01-02T12:00:00Z').status, 0);
  const file = 'topics/agent-roles/README.md';
  await f.write(file, `${await f.read(file)}\n`);
  assert.equal(git(['add', file]).status, 0);
  assert.equal(git(['commit', '-m', 'Update agent roles'], '2025-03-04T12:00:00Z').status, 0);
  passed(f.build());
  const html = await f.read('topics/agent-roles/index.html');
  assert.match(html, /<meta property="article:published_time" content="2024-01-02T12:00:00Z">/);
  assert.match(html, /<meta property="article:modified_time" content="2025-03-04T12:00:00Z">/);
  assert.match(html, /Created<\/dt><dd><time datetime="2024-01-02T12:00:00Z">Jan 2, 2024<\/time>/);
  assert.match(html, /Last Updated<\/dt><dd><time datetime="2025-03-04T12:00:00Z">Mar 4, 2025<\/time>/);
});

test('the shared wordmark embeds its background once per page and missing assets preserve output', async t => {
  const f = await fixture(t);
  passed(f.build());
  const index = await f.read('index.html');
  for (const removed of ['One idea, two ways in.', 'one connected practice', 'Practical workflows. Useful mental models.', 'AI in practice', 'A collection of ideas. A practice in progress.', 'Thoughtfully made. Freely shared.', 'Independent thinking. Practical tools.']) {
    assert.ok(!index.includes(removed), `The collection omits removed copy: ${removed}`);
  }
  assert.ok(index.includes('id="topics-heading">The collection'));
  assert.ok(index.includes('A software engineer&#39;s thoughts about that...'));
  assert.ok(index.includes('<span class="intro-accent">practice</span>'));
  assert.ok(!index.includes('Explore the collection'));
  assert.ok(index.includes('data-ambient="F"'));
  assert.ok(index.includes('class="ambient-canvas" aria-hidden="true" style="--ambient-intensity:0.2"'));
  assert.ok(index.includes("[data-ambient='A']::before"), 'Option A remains available in the generated design system');
  const source = await readFile(resolve(f.path, 'topics/assets/logo-bg.png'));
  for (const file of ['index.html', 'topics/worktrees/index.html', 'topics/agent-roles/index.html']) {
    const html = await f.read(file);
    const images = [...html.matchAll(/--wordmark-wave-image: url\("data:image\/png;base64,([^"]+)"\)/g)];
    assert.equal(images.length, 1, 'The standalone page embeds one shared copy of the wave');
    assert.deepEqual(Buffer.from(images[0][1], 'base64'), source);
    const header = html.match(/<header class="masthead">[\s\S]*?<\/header>/)![0];
    assert.match(header, /class="brand" href="(?:\.\.\/\.\.\/)?index.html" aria-label="The Way I AI — home"/);
    assert.match(header, /<span class="wordmark" aria-hidden="true"><span class="title-art"/);
    assert.ok(!header.match(/<a class="brand"[\s\S]*?<\/a>/)![0].includes('<svg'), 'The shared wordmark replaces the old asterisk');
    assert.match(header, /class="repo-link" href="https:\/\/github.com\/tkarakai\/the-way-i-ai" target="_blank" rel="noopener noreferrer"/);
    assert.match(header, /aria-label="View the repository on GitHub \(opens in a new tab\)"/);
    assert.equal([...html.matchAll(/<span class="title-art"/g)].length, file === 'index.html' ? 2 : 1);
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

test('ambient configuration retains A, keeps F homepage-only, and rejects invalid settings before writing', async t => {
  const f = await fixture(t);
  const registry = JSON.parse(await f.read('topics/topics.json'));
  passed(f.build());
  assert.ok((await f.read('index.html')).includes('window.drawMurmuration ='));
  assert.ok(!(await f.read('topics/worktrees/index.html')).includes('window.drawMurmuration'));
  registry.ambientBackground = 'A';
  await f.write('topics/topics.json', JSON.stringify(registry));
  passed(f.build());
  const original = await f.read('index.html');
  assert.ok(original.includes('data-ambient="A"'));
  assert.ok(!original.includes('<canvas class="ambient-canvas"'));
  assert.ok(!original.includes('window.drawMurmuration'));
  for (const patch of [{ ambientBackground: 'B' }, { ambientIntensity: 20 }, { ambientIntensity: -.1 }, { ambientIntensity: '0.2' }]) {
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
  passed(f.build());
  const before = await f.read('index.html');
  const topic = JSON.parse(await f.read('topics/worktrees/topic.json'));
  topic.explorer.panels[0].source.heading = 'A heading that does not exist';
  await f.write('topics/worktrees/topic.json', JSON.stringify(topic));
  const result = f.build();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /heading must match exactly once/);
  assert.equal(await f.read('index.html'), before);
});

test('a missing SVG highlight target fails instead of silently losing the explanation', async t => {
  const f = await fixture(t);
  const topic = JSON.parse(await f.read('topics/agent-roles/topic.json'));
  topic.explorer.panels[0].highlight = ['missing-node'];
  await f.write('topics/agent-roles/topic.json', JSON.stringify(topic));
  const result = f.build();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing SVG node/);
});

test('the publication bundle is clean and contains the same standalone pages and their source links', async t => {
  const f = await fixture(t);
  passed(f.build());
  await mkdir(resolve(f.path, '_site'), { recursive: true });
  await f.write('_site/stale.html', 'Old publication');
  passed(f.build('--site'));
  for (const file of ['index.html', 'topics/worktrees/index.html', 'topics/agent-roles/index.html']) {
    assert.equal(await f.read(`_site/${file}`), await f.read(file));
  }
  assert.equal(await f.read('_site/topics/worktrees/README.md'), await f.read('topics/worktrees/README.md'));
  assert.equal(await f.read('_site/topics/agent-roles/assets/diagram.svg'), await f.read('topics/agent-roles/assets/diagram.svg'));
  assert.deepEqual(await readFile(resolve(f.path, '_site/topics/assets/logo-bg.png')), await readFile(resolve(f.path, 'topics/assets/logo-bg.png')));
  assert.equal(await f.read('_site/topics/assets/title-wave-position.json'), await f.read('topics/assets/title-wave-position.json'));
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
    for (const file of ['topics/worktrees/index.html', 'topics/agent-roles/README.md', 'topics/agent-roles/assets/diagram.svg']) {
      const linked = await fetch(new URL(file, base));
      assert.equal(linked.status, 200);
      assert.equal(await linked.text(), await f.read(`_site/${file}`));
    }
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
