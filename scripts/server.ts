import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The local static server behind `npm run dev`. It reads `_site/` from disk on every
 * request with caching disabled, so a rebuild is visible on refresh. `extend` lets the
 * dev server answer its own paths and add its reload script to pages.
 *
 * Run directly (`node scripts/server.ts`), it serves the existing `_site/` as built, with
 * no watching or reload script: the browser tests use it to load exactly what is published.
 */

const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.css': 'text/css', '.js': 'text/javascript', '.csv': 'text/csv', '.woff2': 'font/woff2' };

export interface ServerExtension {
  /** Answers a request itself; return true when handled. */
  handle?: (pathname: string, request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => boolean;
  /** Rewrites HTML before it is sent. */
  html?: (html: string) => string;
  /** The page sent when the bundle has no 404.html, for example before a first successful build. */
  missing?: () => string;
}

export function serveSite(directory: string, onListening: (url: string) => void, extend: ServerExtension = {}): Server {
  const requestedPort = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) throw new Error('PORT must be an integer between 0 and 65535.');
  const send = (response: import('node:http').ServerResponse, method: string | undefined, status: number, type: string, data: Buffer) => {
    const body = type === types['.html'] && extend.html ? Buffer.from(extend.html(data.toString('utf8'))) : data;
    response.writeHead(status, { 'Content-Type': type, 'Content-Length': body.length, 'Cache-Control': 'no-store' });
    response.end(method === 'HEAD' ? undefined : body);
  };
  const server = createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method ?? '')) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname); }
    catch { response.writeHead(400); response.end('Bad request'); return; }
    if (extend.handle?.(pathname, request, response)) return;
    try {
      let file = resolve(directory, `.${pathname}`);
      if (file !== directory && !file.startsWith(directory + sep)) { response.writeHead(403); response.end('Forbidden'); return; }
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
      const body = await readFile(file);
      send(response, request.method, 200, (file === resolve(directory, 'feed.xml') ? 'application/rss+xml; charset=utf-8' : types[extname(file)]) || 'application/octet-stream', body);
    } catch {
      // Like GitHub Pages, a missing path gets the generated 404 page with a 404 status.
      const page = await readFile(resolve(directory, '404.html')).catch(() => undefined);
      if (page) send(response, request.method, 404, types['.html'], page);
      else if (extend.missing) send(response, request.method, 404, types['.html'], Buffer.from(extend.missing()));
      else { response.writeHead(404); response.end(request.method === 'HEAD' ? undefined : 'Not found'); }
    }
  });
  server.on('error', error => {
    if ('code' in error && error.code === 'EADDRINUSE' && process.env.PORT === undefined) server.listen(0, '127.0.0.1');
    else { console.error(error.message); process.exitCode = 1; }
  });
  server.on('listening', () => onListening(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`));
  server.listen(requestedPort, '127.0.0.1');
  return server;
}

if (import.meta.main) {
  const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../_site');
  await stat(resolve(directory, 'index.html')).catch(() => { throw new Error('Build the site first: npm run build or npm run build:site'); });
  serveSite(directory, url => console.log(`Serving: ${url}\nThe current _site/ as built, without watching; for editing, use npm run dev. Press Ctrl+C to stop.`));
}
