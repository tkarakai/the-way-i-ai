import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { loadIllustrations, parseManifest } from './illustrations.ts';
import { Assets } from './assets.ts';
import sharp from 'sharp';
import type { RenderedDocument } from '../design-system/types.ts';

const documents = (): RenderedDocument[] => [{ file: 'WORKFLOW.md', id: 'doc', title: 'Workflow', markdown: '', html: '<h2 id="chapter"><a>1. Create</a></h2><p>Full prose</p>', headings: [{ id: 'chapter', text: '1. Create', level: 2, excerpt: '<p>Full prose</p>' }], excerpts: new Map(), sha256: '' }];
const image = { file: 'chapter-01.png', placement: 'chapter', document: 'WORKFLOW.md', heading: '1. Create', alt: 'A workbench & tools', width: 1600, height: 400 };
const manifest = (images: unknown[] = [image]) => ({ version: 2, topic: 'test-topic', images });

test('strict manifest validation requires deterministic, unique chapter bindings', () => {
  assert.doesNotThrow(() => parseManifest(manifest(), 'test-topic', documents()));
  for (const changed of [
    { ...image, heading: 'Create' }, { ...image, document: 'README.md' },
    { ...image, file: '../chapter-01.png' }, { ...image, alt: '' },
    { ...image, height: 900 }, { ...image, width: 0 },
    { ...image, placement: 'sidebar' }, { ...image, extra: true }
  ]) assert.throws(() => parseManifest(manifest([changed]), 'test-topic', documents()));
  assert.throws(() => parseManifest(manifest([image, image]), 'test-topic', documents()), /Duplicate/);
  assert.throws(() => parseManifest({ ...manifest(), topic: 'other' }, 'test-topic', documents()));
  assert.throws(() => parseManifest({ ...manifest(), version: 3 }, 'test-topic', documents()));
  const ambiguous = documents();
  ambiguous[0].headings.push({ ...ambiguous[0].headings[0], id: 'second' });
  assert.throws(() => parseManifest(manifest(), 'test-topic', ambiguous), /exactly once/);
  const subsection = documents();
  subsection[0].headings[0].level = 3;
  assert.throws(() => parseManifest(manifest(), 'test-topic', subsection), /exactly once/);
});

test('absent manifests and individual missing images omit markup; partial deliveries publish shared assets with escaped alt text', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'illustrations-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = resolve(root, 'topics/test-topic/assets/illustrations');
  assert.deepEqual(await loadIllustrations(root, 'test-topic', documents(), new Assets()), { homepage: '', hero: '' });
  await mkdir(dir, { recursive: true });
  const images = [image,
    { file: 'hero.png', placement: 'hero', alt: 'Tools', width: 1600, height: 900 }];
  await writeFile(resolve(dir, 'manifest.json'), JSON.stringify(manifest(images)));
  const missing = documents();
  assert.deepEqual(await loadIllustrations(root, 'test-topic', missing, new Assets()), { homepage: '', hero: '' });
  assert.equal(missing[0].html, documents()[0].html);
  // Pixel decoding and responsive layout are covered in browser acceptance.
  for (const file of ['chapter-01.png', 'hero.png']) await writeFile(resolve(dir, file), await sharp({create:{width:1600,height:file.startsWith('chapter')?400:900,channels:4,background:'#eee'}}).png().toBuffer());
  const docs = documents();
  const result = await loadIllustrations(root, 'test-topic', docs, new Assets());
  assert.match(result.homepage, /src="@@root@@\/assets\/hero-1600-[a-f0-9]+\.webp/);
  assert.equal(result.hero.match(/src="([^"]+)/)![1], result.homepage.match(/src="([^"]+)/)![1]);
  // Legacy deliveries reuse the homepage asset; separate article artwork is ignored.
  await writeFile(resolve(dir, 'hero-homepage.png'), await sharp({create:{width:1200,height:900,channels:4,background:'#eee'}}).png().toBuffer());
  await writeFile(resolve(dir, 'hero-article.png'), await sharp({create:{width:1600,height:900,channels:4,background:'#eee'}}).png().toBuffer());
  await writeFile(resolve(dir, 'manifest.json'), JSON.stringify({ version: 1, topic: 'test-topic', images: [
    { file: 'hero-homepage.png', placement: 'homepage', alt: 'Legacy tools', width: 1200, height: 900 },
    { file: 'hero-article.png', placement: 'hero', alt: 'Retired tools', width: 1600, height: 900 }
  ] }));
  const legacy = await loadIllustrations(root, 'test-topic', documents(), new Assets());
  assert.equal(legacy.hero.match(/src="([^"]+)/)![1], legacy.homepage.match(/src="([^"]+)/)![1]);
  assert.ok(!legacy.hero.includes('Retired tools'));
  assert.match(docs[0].html, /<\/h2><img class="editorial-image editorial-chapter"/);
  assert.match(docs[0].html, /alt="A workbench &amp; tools"/);
  assert.match(docs[0].html, /loading="lazy"/);
  assert.ok(docs[0].html.endsWith('<p>Full prose</p>'));
  assert.equal(docs[0].headings[0].excerpt, '<p>Full prose</p>');
  await writeFile(resolve(dir, 'manifest.json'), '{broken');
  await assert.rejects(loadIllustrations(root, 'test-topic', documents(), new Assets()), SyntaxError);
});
