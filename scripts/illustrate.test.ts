import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { composePrompt, finishImage, images, manifestFor, validSpecies } from './illustrate.ts';
import { parseManifest, parseSpecies } from './illustrations.ts';
import { frameDrawing, lightPaper } from './paper.ts';

const master = await readFile(new URL('../design-system/illustration-style/single-topic-illustration-prompt.md', import.meta.url), 'utf8');

test('species must read as "Common name (Binomial)" for the Field Atlas label', () => {
  for (const ok of ['Eurasian otter (Lutra lutra)', 'European red squirrel (Sciurus vulgaris)', 'Little owl (Athene noctua)', 'Grey wolf (Canis lupus lupus)']) assert.ok(validSpecies(ok), ok);
  for (const bad of ['otter', 'Lutra lutra', 'Eurasian otter (lutra lutra)', 'Eurasian otter (Lutra)', '']) assert.ok(!validSpecies(bad), bad);
  assert.deepEqual(parseSpecies('Eurasian otter (Lutra lutra)'), { common: 'Eurasian otter', latin: 'Lutra lutra' });
});

test('the generated manifest is a valid version 3 wildlife manifest', () => {
  assert.doesNotThrow(() => parseManifest(manifestFor('Eurasian otter (Lutra lutra)'), 'topic', []));
});

test('each run brief keeps the master prompt but only its own image and no delivery package', () => {
  for (const spec of images) {
    const prompt = composePrompt(master, 'Eurasian otter (Lutra lutra)', spec, spec.placement === 'panorama');
    assert.ok(!prompt.includes('[ANIMAL SPECIES]'));
    assert.match(prompt, new RegExp(`### IMAGE ${spec.image} — ${spec.title}`));
    for (const other of images.filter(other => other !== spec)) assert.ok(!prompt.includes(`### IMAGE ${other.image} —`), `${spec.file} excludes image ${other.image}`);
    assert.ok(!prompt.includes('## 8. READY-TO-USE DELIVERY PACKAGE'));
    for (const kept of ['## 1. ARTISTIC STYLE', '## 2. ANATOMICAL ACCURACY', '## 6. STRICTLY AVOID', '## 7. FINAL QUALITY CONTROL']) assert.ok(prompt.includes(kept), kept);
    assert.match(prompt, new RegExp(`\\./raw/${spec.file.replace('.png', '')}\\.png`));
    assert.equal(prompt.includes('`hero.png`, the approved portrait'), spec.placement === 'panorama');
  }
});

test('framing trims around the drawing when it fits, and pads with paper when it does not', () => {
  // A wide drawing in a 2.5:1 image fits a full-width 4:1 window centred on it.
  assert.deepEqual(frameDrawing(2000, 800, { left: 400, top: 300, width: 1200, height: 200 }, 4), { left: 0, top: 150, width: 2000, height: 500 });
  // A tall drawing needs the full height plus margins, so the window extends past the sides.
  const tall = frameDrawing(2000, 800, { left: 600, top: 50, width: 800, height: 700 }, 4);
  assert.ok(tall.width / tall.height > 3.99 && tall.width / tall.height < 4.01);
  assert.ok(tall.left < 0 && tall.left + tall.width > 2000 && tall.top <= 18 && tall.top + tall.height >= 782);
  // An already 16:9 portrait with margins is used whole.
  assert.deepEqual(frameDrawing(1600, 900, { left: 400, top: 100, width: 800, height: 700 }, 16 / 9), { left: 0, top: 0, width: 1600, height: 900 });
});

test('a generated drawing becomes an exact-size image on the site paper', async () => {
  const target = await lightPaper();
  // An off-white 2.5:1 "drawing" with a dark animal-shaped block left of centre.
  const width = 1000, height = 400, rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = (y * width + x) * 4, ink = x > 200 && x < 600 && y > 120 && y < 280;
    rgba.set(ink ? [90, 70, 50, 255] : [244, 240, 230, 255], p);
  }
  const raw = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const panorama = images[1];
  const { png } = await finishImage(raw, panorama, target);
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [1600, 400]);
  for (const [x, y] of [[0, 0], [1599, 0], [0, 399], [1599, 399], [800, 10]]) {
    const p = (y * info.width + x) * info.channels;
    assert.deepEqual([...data.subarray(p, p + 3)], target, `paper at ${x},${y}`);
  }
  const portrait = await finishImage(raw, images[0], target);
  const meta = await sharp(portrait.png).metadata();
  assert.deepEqual([meta.width, meta.height], [1600, 900]);
  assert.match(portrait.note, /trimmed to 1600×900/, 'the portrait window is centred on the animal, not padded');
});
