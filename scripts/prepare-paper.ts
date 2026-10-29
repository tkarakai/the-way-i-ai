import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { lightPaper, matchPaper } from './paper.ts';

// Asset maintenance only: `node scripts/prepare-paper.ts <topic-id>... [--center-hero]`.
// Matches each delivered wildlife image's edge-connected paper to Folio's light --paper,
// so artwork sits seamlessly on the page and in Field Atlas mounts. With --center-hero,
// the portrait is also shifted horizontally so the animal is centred. Ink and colored
// watercolor are never changed. Re-running on an already matched image is harmless.
// `scripts/illustrate.ts` applies the same treatment to newly generated artwork.
const args = process.argv.slice(2);
const center = args.includes('--center-hero');
const topics = args.filter(arg => !arg.startsWith('--'));
if (!topics.length) throw new Error('Name at least one topic id.');
const target = await lightPaper();
const hex = target.map(value => value.toString(16).padStart(2, '0')).join('');
for (const topic of topics) {
  for (const file of ['hero.png', 'panorama-01.png', 'panorama-02.png', 'panorama-03.png', 'panorama-04.png']) {
    const url = new URL(`../topics/${topic}/assets/illustrations/${file}`, import.meta.url);
    const original = await readFile(url).catch(() => undefined);
    if (!original) continue;
    const { data, info } = await sharp(original).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rgba = new Uint8Array(data.buffer, data.byteOffset, data.length);
    const result = matchPaper(rgba, info.width, info.height, target, { recenter: center && file === 'hero.png' });
    await writeFile(url, await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).removeAlpha().png().toBuffer());
    console.log(`${topic}/${file}: ${info.width}×${info.height}; paper rgb(${result.source.join(', ')}) → #${hex} on ${result.coverage}%${result.shift ? `; shifted ${result.shift}px` : ''}`);
  }
}
