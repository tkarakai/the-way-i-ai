import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const iconFiles = ['favicon.ico', 'favicon-16.png', 'favicon-32.png', 'favicon-48.png', 'apple-touch-icon.png', 'favicon-192.png', 'favicon-512.png'] as const;

/** Read approved artwork, never regenerate it as a side effect of building. */
export async function loadIcons(root: string): Promise<Map<string, Buffer>> {
  return new Map(await Promise.all(iconFiles.map(async file => [file, await readFile(resolve(root, 'design-system/assets/favicon', file))] as const)));
}

export function iconMetadata(files: Map<string, Buffer>, path: string): string {
  const prefix = '../'.repeat(path.split('/').length - 1);
  const png = (size: number) => {
    const data = files.get(`favicon-${size}.png`);
    if (!data) throw new Error(`Missing approved ${size}px favicon`);
    return `<link rel="icon" type="image/png" sizes="${size}x${size}" href="data:image/png;base64,${data.toString('base64')}">`;
  };
  // Embedded PNGs keep the browser icon available in individual downloaded
  // HTML files. Apple home-screen icons need a real file URL, not a data URL.
  return `<link rel="icon" type="image/x-icon" href="${prefix}favicon.ico">`
    + png(32) + png(16)
    + `<link rel="apple-touch-icon" sizes="180x180" href="${prefix}apple-touch-icon.png">`;
}
