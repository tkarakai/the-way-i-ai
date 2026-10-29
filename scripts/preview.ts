import { stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveSite } from './server.ts';

// `npm run preview`: serves the publication bundle as built. For automatic rebuilds and
// page reloads while editing, use `npm run dev`.
const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../_site');
await stat(resolve(directory, 'index.html')).catch(() => { throw new Error('Build the publication bundle first: npm run build:site'); });
serveSite(directory, url => console.log(`Preview: ${url}\nServing the current branch's _site/. Rebuild with npm run build (or npm run build:site for sharing images) and refresh after edits, or use npm run dev to do both automatically. Press Ctrl+C to stop.`));
