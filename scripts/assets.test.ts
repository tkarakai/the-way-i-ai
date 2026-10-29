import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { Assets } from './assets.ts';

test('published filenames cannot inject attributes or srcset separators', () => {
  const assets = new Assets();
  const path = assets.add('an image", onerror="alert(1).webp', 'bytes');
  assert.match(path, /^assets\/[a-zA-Z0-9_-]+-[a-f0-9]{12}\.webp$/);
});

test('artwork has bounded responsive variants, stable shared names, and small navigation copies', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'published-assets-'));
  t.after(() => rm(directory, {recursive:true, force:true}));
  const file = join(directory, 'portrait.png');
  await writeFile(file, await sharp({create:{width:2000,height:1125,channels:3,background:'#ddd'}}).png().toBuffer());
  const assets = new Assets();
  const image = await assets.image(file);
  assert.equal(image.width, 1600);
  assert.equal(image.height, 900);
  assert.match(image.srcset!, /320w, .*640w, .*960w, .*1280w, .*1600w$/);
  const count = assets.files.size;
  assert.deepEqual(await assets.image(file), image);
  assert.equal(assets.files.size, count);
  const thumbnail = await assets.image(file, { maxWidth: 360, flatten: true });
  assert.equal(thumbnail.width, 360);
  const decoded = await sharp(assets.files.get(thumbnail.src)!).metadata();
  assert.equal(decoded.format, 'webp'); assert.equal(decoded.width, 360);
  assert.equal(image.src, (await new Assets().image(file)).src);
});

test('SVG files used as ordinary images receive the same safety checks as inline diagrams', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'svg-assets-'));
  t.after(() => rm(directory, {recursive:true, force:true}));
  const file = join(directory, 'unsafe.svg');
  await writeFile(file, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  await assert.rejects(new Assets().image(file), /self-contained and script-free/);
});
