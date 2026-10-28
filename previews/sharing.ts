// Preview the actual published JPEGs, not a second copy of the card template.
// Run `npm run build:site` first, then `node previews/sharing.ts`.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Collection } from '../design-system/types.ts';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'previews/sharing');
const collection = JSON.parse(await readFile(resolve(root, 'topics/topics.json'), 'utf8')) as Collection;
const topic = process.argv.find(arg => arg.startsWith('--topic='))?.slice(8) ?? collection.topics.at(-1)!;
if (!collection.topics.includes(topic)) throw new Error(`Unknown topic: ${topic}`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, javaScriptEnabled: false });
  for (const [name, path] of [['home', 'index.html'], ['article', `topics/${topic}/index.html`]]) {
    const source = await readFile(resolve(root, '_site', path), 'utf8');
    const url = source.match(/<meta property="og:image" content="([^"]+)">/)?.[1];
    if (!url) throw new Error('Build the publication bundle before previewing sharing cards.');
    const imagePath = new URL(url).pathname.slice(new URL(collection.siteUrl).pathname.length);
    if (!/^assets\/sharing\/[a-z0-9-]+\.jpg$/.test(imagePath)) throw new Error(`Unexpected sharing path: ${imagePath}`);
    const image = await readFile(resolve(root, '_site', imagePath));
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sharing preview</title><style>html,body{margin:0;width:1200px;height:630px}img{display:block;width:1200px;height:630px}</style></head><body><img src="data:image/jpeg;base64,${image.toString('base64')}" alt="Sharing card preview"></body></html>`;
    await writeFile(resolve(output, `${name}.jpg`), image);
    await writeFile(resolve(output, `${name}.html`), html);
    await page.setContent(html);
    await page.evaluate(async () => { await document.images[0].decode(); });
    await page.screenshot({ path: resolve(output, `${name}.png`) });
  }
  console.log(`Sharing samples: ${output}/home.png and article.png (topic: ${topic})`);
} finally {
  await browser.close();
}
