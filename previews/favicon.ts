// An unwired favicon study, derived from the current wordmark. Run with Node 24.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('previews/favicon');
const assets = resolve('design-system/assets/favicon');
await mkdir(output, { recursive: true });
await mkdir(assets, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, javaScriptEnabled: false });
  await page.goto(pathToFileURL(resolve('index.html')).href);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const original = document.querySelector<HTMLElement>('.hero-wordmark .wordmark')!;
    const mark = original.cloneNode(true) as HTMLElement;
    mark.querySelector('.title-art')?.remove();
    mark.querySelector('.title-line')!.innerHTML = '<span>y</span> <span class="favicon-top-i">I</span>';
    // Use the shared lettering without depending on animation-only logo spans.
    mark.querySelector('.title-line:last-child')!.innerHTML = '<span class="title-initial">A</span><span class="favicon-bottom-i">I</span>';
    document.body.replaceChildren(mark);
    document.documentElement.dataset.design = 'atlas';
    document.documentElement.dataset.theme = 'light';
    const style = document.createElement('style');
    style.textContent = `
      html, body { background: transparent !important; margin: 0; }
      *, *::before, *::after { animation: none !important; transition: none !important; }
      .wordmark { position: absolute; left: 200px; top: 200px; font-size: 400px; max-width: none; translate: none; color: #3878f2; }
      .wordmark .title-line:last-child { color: #00a99d; }
    `;
    document.head.append(style);
    // Match the I glyph origins, not the line boxes: trailing letter spacing
    // makes their edges misleading when the bottom row is right-aligned.
    const upper = mark.querySelector<HTMLElement>('.favicon-top-i')!;
    const lower = mark.querySelector<HTMLElement>('.favicon-bottom-i')!;
    const offset = lower.getBoundingClientRect().left - upper.getBoundingClientRect().left;
    (mark.querySelector('.title-line') as HTMLElement).style.transform = `translateX(${offset}px)`;
    console.log(`Upper row alignment correction: ${offset}px at 400px font size`);
  });
  const image = await page.screenshot({ omitBackground: true });
  const source = `data:image/png;base64,${image.toString('base64')}`;
  const sizes = [16, 32, 48, 180, 192, 512];
  const files = await page.evaluate(async ({ source, sizes }) => {
    const image = new Image(); image.src = source; await image.decode();
    const probe = document.createElement('canvas');
    probe.width = image.width; probe.height = image.height;
    const context = probe.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, probe.width, probe.height).data;
    let left = probe.width, top = probe.height, right = -1, bottom = -1;
    for (let y = 0; y < probe.height; y++) {
      for (let x = 0; x < probe.width; x++) {
        if (pixels[(y * probe.width + x) * 4 + 3]! > 0) {
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
    }
    if (right < left) throw new Error('Wordmark screenshot contains no visible pixels.');
    const width = right - left + 1, height = bottom - top + 1;
    return sizes.map(size => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const context = canvas.getContext('2d')!;
      const padding = Math.max(0.5, size / 64);
      const scale = (size - padding * 2) / Math.max(width, height);
      context.drawImage(image, left, top, width, height, (size - width * scale) / 2, (size - height * scale) / 2, width * scale, height * scale);
      return { size, data: canvas.toDataURL('image/png').split(',')[1]! };
    });
  }, { source, sizes });
  for (const file of files) {
    const data = Buffer.from(file.data, 'base64');
    await writeFile(resolve(output, `favicon-${file.size}.png`), data);
    await writeFile(resolve(assets, file.size === 180 ? 'apple-touch-icon.png' : `favicon-${file.size}.png`), data);
  }
  // ICO supports PNG payloads. Bundle the three browser sizes in one fallback.
  const entries = files.filter(file => [16, 32, 48].includes(file.size));
  const header = Buffer.alloc(6 + entries.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  const payloads = entries.map((file, index) => {
    const data = Buffer.from(file.data, 'base64');
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = file.size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
    return data;
  });
  await writeFile(resolve(assets, 'favicon.ico'), Buffer.concat([header, ...payloads]));
  console.log(`Favicon previews: ${output}\nApproved assets: ${assets}`);
} finally {
  await browser.close();
}
