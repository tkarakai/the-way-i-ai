import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, symlink, readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function fixture(t) {
  const path = await mkdtemp(resolve(tmpdir(), 'the-way-i-ai-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  for (const item of ['scripts', 'design-system', 'topics', 'package.json', 'README.md', 'AGENTS.md', 'CLAUDE.md']) {
    await cp(resolve(root, item), resolve(path, item), { recursive: true, filter: file => !file.endsWith('.html') });
  }
  await symlink(resolve(root, 'node_modules'), resolve(path, 'node_modules'), 'dir');
  return {
    path,
    read: file => readFile(resolve(path, file), 'utf8'),
    write: (file, text) => writeFile(resolve(path, file), text),
    build: (...args) => spawnSync(process.execPath, [resolve(path, 'scripts/build.mjs'), ...args], { cwd: path, encoding: 'utf8' })
  };
}
function passed(result) { assert.equal(result.status, 0, result.stderr || result.stdout); }

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
  assert.equal(html.split('This source paragraph is reused in the explorer and full reader.').length - 1, 2);
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
  await access(resolve(f.path, '_site/.nojekyll'));
  await assert.rejects(access(resolve(f.path, '_site/stale.html')));
  await assert.rejects(access(resolve(f.path, '_site/node_modules')));
  await assert.rejects(access(resolve(f.path, '_site/scripts')));
});


test('the local preview serves the generated site, links and images without serving paths outside the bundle', async t => {
  const f = await fixture(t);
  passed(f.build('--site'));
  const child = spawn(process.execPath, [resolve(f.path, 'scripts/preview.mjs')], { cwd: f.path, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const base = await new Promise((resolveURL, reject) => {
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
    assert.match(response.headers.get('content-type'), /text\/html/);
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
    await new Promise(resolveExit => { if (child.exitCode !== null || child.signalCode) resolveExit(); else child.once('exit', resolveExit); });
  }
});
