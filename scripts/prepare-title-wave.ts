import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Asset maintenance only, not part of normal builds. Keep the original export.
// The original is teal ink on a neutral white/grey matte. Channel differences
// cancel that neutral matte; recover the ink's coverage without its backing.
const source = new URL('../topics/assets/logo-bg-source.png', import.meta.url);
const target = new URL('../topics/assets/logo-bg.png', import.meta.url);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const png = await page.evaluate(async data => {
    const image = new Image(); image.src = data; await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const [red, green, blue] = [20, 124, 134]; // The authored wave's teal ink.
    for (let i = 0; i < pixels.data.length; i += 4) {
      const coverage = Math.max(0, Math.min(1,
        (pixels.data[i + 1] + pixels.data[i + 2] - 2 * pixels.data[i]) / (green + blue - 2 * red)));
      pixels.data[i + 3] = Math.round(pixels.data[i + 3] * coverage);
      pixels.data[i] = red; pixels.data[i + 1] = green; pixels.data[i + 2] = blue;
    }
    ctx.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  }, `data:image/png;base64,${(await readFile(source)).toString('base64')}`);
  await writeFile(target, Buffer.from(png, 'base64'));
  console.log('Prepared transparent title wave; original export and positioning retained.');
} finally {
  await browser.close();
}
