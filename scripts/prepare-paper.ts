import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Asset maintenance only: `node scripts/prepare-paper.ts <topic-id>... [--center-hero]`.
// Matches each delivered wildlife image's edge-connected paper to Folio's light --paper,
// so artwork sits seamlessly on the page and in Field Atlas mounts. With --center-hero,
// the portrait is also shifted horizontally so the animal is centred. Ink and colored
// watercolor are never changed. Re-running on an already matched image is harmless.
const args = process.argv.slice(2);
const center = args.includes('--center-hero');
const topics = args.filter(arg => !arg.startsWith('--'));
if (!topics.length) throw new Error('Name at least one topic id.');
const css = await readFile(new URL('../design-system/theme.css', import.meta.url), 'utf8');
const paper = css.match(/--paper:\s*#([a-f0-9]{6})\b/i)?.[1];
if (!paper) throw new Error('Expected a six-digit light-theme --paper color');
const target = [0, 2, 4].map(offset => Number.parseInt(paper.slice(offset, offset + 2), 16));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const topic of topics) {
    for (const file of ['hero.png', 'panorama-01.png', 'panorama-02.png', 'panorama-03.png', 'panorama-04.png']) {
      const url = new URL(`../topics/${topic}/assets/illustrations/${file}`, import.meta.url);
      const original = await readFile(url).catch(() => undefined);
      if (!original) continue;
      const result = await page.evaluate(async ({ data, target, recenter }) => {
        const image = new Image(); image.src = data; await image.decode();
        const canvas = document.createElement('canvas');
        const width = canvas.width = image.naturalWidth, height = canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, width, height), rgba = pixels.data;
        // Estimate the source paper from pale, low-chroma perimeter samples.
        const samples: number[][] = [[], [], []];
        for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
          if (x > width * .025 && x < width * .975 && y > height * .025 && y < height * .975) continue;
          const p = (y * width + x) * 4;
          const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
          if (Math.min(r, g, b) < 215 || Math.max(r, g, b) - Math.min(r, g, b) > 25) continue;
          samples[0].push(r); samples[1].push(g); samples[2].push(b);
        }
        if (samples[0].length < 100) throw new Error('Not enough clear paper to estimate the source background');
        const source = samples.map(values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]);
        const distance = (pixel: number) => Math.max(...source.map((value, channel) => Math.abs(rgba[pixel * 4 + channel] - value)));
        const visited = new Uint8Array(width * height), queue = new Int32Array(width * height);
        let head = 0, tail = 0;
        const visit = (pixel: number) => {
          if (visited[pixel]) return;
          visited[pixel] = 1;
          const p = pixel * 4;
          const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
          if (rgba[p + 3] !== 255 || Math.min(r, g, b) < 210 || Math.max(r, g, b) - Math.min(r, g, b) > 30 || distance(pixel) >= 28) return;
          queue[tail++] = pixel;
        };
        for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
        for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
        // Find the entire mask before changing any pixels, so traversal is order-independent.
        while (head < tail) {
          const pixel = queue[head++], x = pixel % width, y = Math.floor(pixel / width);
          if (x > 0) visit(pixel - 1); if (x < width - 1) visit(pixel + 1);
          if (y > 0) visit(pixel - width); if (y < height - 1) visit(pixel + width);
        }
        if (tail < width * height * .1) throw new Error('Unexpectedly little connected paper; refusing to overwrite the asset');
        const isPaper = new Uint8Array(width * height);
        for (let i = 0; i < tail; i++) {
          const pixel = queue[i], p = pixel * 4;
          isPaper[pixel] = 1;
          // Exact target on clear paper; feather into pale antialiasing/wash edges.
          const blend = Math.min(1, (28 - distance(pixel)) / 18);
          for (let channel = 0; channel < 3; channel++) rgba[p + channel] = Math.round(rgba[p + channel] * (1 - blend) + target[channel] * blend);
        }
        let shift = 0;
        if (recenter) {
          // Centre the animal's horizontal extent; columns that slide in are clear paper.
          let left = width, right = 0;
          for (let pixel = 0; pixel < width * height; pixel++) if (!isPaper[pixel]) { const x = pixel % width; left = Math.min(left, x); right = Math.max(right, x); }
          shift = Math.round(width / 2 - (left + right) / 2);
          if (left + shift < 0 || right + shift >= width) throw new Error('The animal is too wide to re-centre safely');
          const moved = new Uint8ClampedArray(rgba.length);
          for (let i = 0; i < width * height; i++) moved.set(target.concat(255), i * 4);
          for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const to = x + shift;
            if (to >= 0 && to < width) moved.set(rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 4), (y * width + to) * 4);
          }
          rgba.set(moved);
        }
        ctx.putImageData(pixels, 0, 0);
        for (const pixel of [0, width - 1, (height - 1) * width, width * height - 1]) {
          if (isPaper[pixel] && target.some((value, channel) => rgba[pixel * 4 + channel] !== value)) throw new Error('A paper corner did not match the target color');
        }
        return { png: canvas.toDataURL('image/png').split(',')[1], width, height, coverage: Math.round(tail / (width * height) * 100), source, shift };
      }, { data: `data:image/png;base64,${original.toString('base64')}`, target, recenter: center && file === 'hero.png' });
      await writeFile(url, Buffer.from(result.png, 'base64'));
      console.log(`${topic}/${file}: ${result.width}×${result.height}; paper rgb(${result.source.join(', ')}) → #${paper} on ${result.coverage}%${result.shift ? `; shifted ${result.shift}px` : ''}`);
    }
  }
} finally { await browser.close(); }
