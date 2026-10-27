import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Asset maintenance only. Always regenerate from the untouched approved references.
// Replace edge-connected pale paper, not the foxes' ink or colored watercolor.
const css = await readFile(new URL('../design-system/theme.css', import.meta.url), 'utf8');
const paper = css.match(/--paper:\s*#([a-f0-9]{6})\b/i)?.[1];
if (!paper) throw new Error('Expected a six-digit light-theme --paper color');
const target = [0, 2, 4].map(offset => Number.parseInt(paper.slice(offset, offset + 2), 16));
const files = [
  ['01_fox_portrait_1600x900.png', 'hero.png'],
  ['02_fox_running_natural_pose_1600x400.png', 'panorama-01.png'],
  ['03_fox_foraging_1600x400.png', 'panorama-02.png'],
  ['04_fox_cubs_playing_1600x400.png', 'panorama-03.png'],
  ['05_foxes_at_stream_1600x400.png', 'panorama-04.png']
];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [source, destination] of files) {
    const original = await readFile(new URL(`../design-system/illustration-style/references/${source}`, import.meta.url));
    const result = await page.evaluate(async ({ data, target }) => {
      const image = new Image(); image.src = data; await image.decode();
      const canvas = document.createElement('canvas');
      const width = canvas.width = image.naturalWidth, height = canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, width, height), rgba = pixels.data;
      // Estimate each source's paper from pale, low-chroma perimeter samples.
      const samples: number[][] = [[], [], []];
      for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
        if (x > width * .025 && x < width * .975 && y > height * .025 && y < height * .975) continue;
        const p = (y * width + x) * 4;
        const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
        if (Math.min(r, g, b) < 215 || Math.max(r, g, b) - Math.min(r, g, b) > 25) continue;
        samples[0].push(r); samples[1].push(g); samples[2].push(b);
      }
      if (samples[0].length < 100) throw new Error('Not enough clear paper to estimate the source background');
      const paper = samples.map(values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]);
      const distance = (pixel: number) => Math.max(...paper.map((value, channel) => Math.abs(rgba[pixel * 4 + channel] - value)));
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
      for (let i = 0; i < tail; i++) {
        const pixel = queue[i], p = pixel * 4;
        // Exact target on clear paper; feather into pale antialiasing/wash edges.
        const blend = Math.min(1, (28 - distance(pixel)) / 18);
        for (let channel = 0; channel < 3; channel++) rgba[p + channel] = Math.round(rgba[p + channel] * (1 - blend) + target[channel] * blend);
      }
      ctx.putImageData(pixels, 0, 0);
      for (const pixel of [0, width - 1, (height - 1) * width, width * height - 1]) {
        if (target.some((value, channel) => rgba[pixel * 4 + channel] !== value)) throw new Error('A paper corner did not match the target color');
      }
      return { png: canvas.toDataURL('image/png').split(',')[1], width, height, coverage: Math.round(tail / (width * height) * 100) };
    }, { data: `data:image/png;base64,${original.toString('base64')}`, target });
    await writeFile(new URL(`../topics/just-enough-context/assets/illustrations/${destination}`, import.meta.url), Buffer.from(result.png, 'base64'));
    console.log(`${destination}: ${result.width}×${result.height}; matched ${result.coverage}% connected paper to #${paper}`);
  }
} finally { await browser.close(); }
