import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iconFiles, iconMetadata, loadIcons } from './icons.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('approved favicon files are loaded intact and linked at every page depth', async () => {
  const icons = await loadIcons(root);
  assert.equal(icons.size, iconFiles.length);
  for (const [path, prefix] of [['index.html', ''], ['general-index/index.html', '../'], ['topics/example/index.html', '../../']]) {
    const html = iconMetadata(icons, path);
    assert.ok(html.includes(`href="${prefix}favicon.ico"`));
    assert.ok(html.includes(`href="${prefix}apple-touch-icon.png"`));
    for (const size of [16, 32]) assert.ok(html.includes(`sizes="${size}x${size}" href="${prefix}favicon-${size}.png"`));
    assert.doesNotMatch(html, /data:/);
  }
  assert.throws(() => iconMetadata(new Map(), 'index.html'), /Missing approved/);
});
