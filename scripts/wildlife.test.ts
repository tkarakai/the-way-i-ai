import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { loadIllustrations, parseManifest } from './illustrations.ts';
import type { RenderedDocument } from '../design-system/types.ts';

const manifest = () => ({ version: 3, species: 'Red fox', images: Array.from({ length: 5 }, (_, index) => ({ file: index ? `panorama-0${index}.png` : 'hero.png', placement: index ? 'panorama' : 'hero', alt: '', width: 1600, height: index ? 400 : 900 })) });
function document(file: string, count: number): RenderedDocument {
  const headings = Array.from({ length: count }, (_, index) => ({ id: `${file}-${index}`, text: `Chapter ${index}`, level: 2, excerpt: '<p>Unchanged prose</p>' }));
  return { file, id: file, title: file, markdown: '', html: headings.map(h => `<h2 id="${h.id}">${h.text}</h2><p>Unchanged prose</p>`).join(''), headings, excerpts: new Map(), sha256: '' };
}

test('species-only packages require ordered decorative files and valid dimensions, without topic bindings', () => {
  assert.doesNotThrow(() => parseManifest(manifest(), 'any-topic', []));
  for (const field of [{ species: '' }, { species: 42 }, { topic: 'not-allowed' }, { images: [] }]) assert.throws(() => parseManifest({ ...manifest(), ...field }, 'any-topic', []));
  for (const change of [{ file: '../hero.png' }, { file: 'heroXpng' }, { alt: 'An animal' }, { width: 0 }, { height: 400 }, { document: 'README.md' }, { heading: 'Introduction' }, { placement: 'chapter' }]) {
    const changed = manifest(); Object.assign(changed.images[0], change);
    assert.throws(() => parseManifest(changed, 'any-topic', []));
  }
  const reordered = manifest();
  [reordered.images[1], reordered.images[2]] = [reordered.images[2], reordered.images[1]];
  assert.throws(() => parseManifest(reordered, 'any-topic', []));
});

test('wildlife is distributed deterministically before chapter boundaries; missing files never shift slots', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'wildlife-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = resolve(root, 'topics/example/assets/illustrations');
  await mkdir(directory, { recursive: true });
  const metadata = manifest();
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(metadata));
  for (const image of metadata.images) await writeFile(resolve(directory, image.file), image.file);
  const docs = [document('README.md', 6), document('WORKFLOW.md', 5)];
  const source = docs.map(doc => doc.html);
  const result = await loadIllustrations(root, 'example', docs);
  assert.match(result.hero, /editorial-portrait/);
  assert.match(result.hero, /alt=""/);
  assert.equal(result.homepage.match(/src="([^"]+)/)![1], result.hero.match(/src="([^"]+)/)![1]);
  const targets = docs.flatMap(doc => [...doc.html.matchAll(/editorial-wildlife[^>]*><h2 id="([^"]+)"/g)].map(match => match[1]));
  assert.deepEqual(targets, ['README.md-1', 'README.md-3', 'README.md-5', 'WORKFLOW.md-2']);
  const again = [document('README.md', 6), document('WORKFLOW.md', 5)];
  await loadIllustrations(root, 'example', again);
  assert.deepEqual(again.map(doc => doc.html), docs.map(doc => doc.html));
  docs.forEach((doc, index) => assert.equal(doc.html.replace(/<img[^>]*>/g, ''), source[index]));
  await rm(resolve(directory, 'panorama-01.png'));
  const partial = [document('README.md', 6), document('WORKFLOW.md', 5)];
  await loadIllustrations(root, 'example', partial);
  assert.deepEqual(partial.flatMap(doc => [...doc.html.matchAll(/editorial-wildlife[^>]*><h2 id="([^"]+)"/g)].map(match => match[1])), targets.slice(1));
  const short = [document('README.md', 2)];
  await loadIllustrations(root, 'example', short);
  assert.ok(!short[0].html.includes('editorial-wildlife'), 'The sole slot stays missing rather than borrowing a later panorama');
  await writeFile(resolve(directory, 'panorama-01.png'), 'first panorama');
  await loadIllustrations(root, 'example', short);
  assert.equal((short[0].html.match(/editorial-wildlife/g) ?? []).length, 1);
  const noBoundaries = [document('README.md', 1)];
  await loadIllustrations(root, 'example', noBoundaries);
  assert.equal(noBoundaries[0].html, document('README.md', 1).html);
});
