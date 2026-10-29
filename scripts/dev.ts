import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { readdir, readFile, access } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveSite } from './server.ts';

/**
 * `npm run dev`: serves the site and rebuilds it whenever a source changes, then reloads
 * open pages. A failed build keeps the last good site on screen with the error in a banner.
 * Sharing images are skipped for speed; `npm run dev -- --site` renders them on every build.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(root, '_site');
const watched = ['topics', 'pages', 'design-system', 'scripts'];
const site = process.argv.includes('--site');

type State = { status: 'building' | 'ready' | 'failed'; message?: string };
let state: State = { status: 'building' };
const clients = new Set<ServerResponse>();
const send = (client: ServerResponse, event: string, data: unknown) => client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
const broadcast = (event: string, data: unknown) => { for (const client of clients) send(client, event, data); };

/** The thrown message from a failed build, without Node's stack trace. */
export function buildError(output: string): string {
  const match = /^(?:\w*Error|error): ([\s\S]*?)(?=\n\s+at |\n\nNode\.js |(?![\s\S]))/m.exec(output);
  return (match?.[1] ?? output.trim().split('\n').slice(-5).join('\n')).trim();
}

// Runs in the browser. Plain JavaScript served from this origin, as the site's CSP allows.
const client = `(() => {
  const events = new EventSource('/__dev/events');
  let banner, pill;
  const box = (css) => { const el = document.createElement('div'); el.setAttribute('style', css + 'position:fixed;z-index:2147483647;font:13px/1.45 ui-monospace,Menlo,monospace;'); document.body.append(el); return el; };
  const clear = () => { banner?.remove(); pill?.remove(); banner = pill = undefined; };
  events.addEventListener('building', () => { pill?.remove(); pill = box('top:10px;right:10px;padding:4px 10px;border-radius:99px;background:#1d1b19;color:#f8f5ee;opacity:.85;'); pill.textContent = 'Rebuilding…'; });
  events.addEventListener('reload', () => location.reload());
  events.addEventListener('failed', (event) => {
    clear();
    banner = box('left:0;right:0;bottom:0;max-height:45vh;overflow:auto;padding:14px 18px;background:#7a1f1f;color:#fff;white-space:pre-wrap;');
    banner.textContent = 'The build failed, so this is the last version that built. Fix the source and save; the page reloads by itself.\\n\\n' + JSON.parse(event.data).message;
  });
  events.addEventListener('ready', clear);
})();
`;

const placeholder = () => `<!doctype html><meta charset="utf-8"><title>Building…</title><body style="font:16px/1.5 system-ui;margin:40px;color:#2b2722;background:#f8f5ee">
<p>${state.status === 'failed' ? 'The first build failed. Fix the source and save; this page reloads by itself.' : 'Building the site… this page reloads by itself when it is ready.'}</p>
<script src="/__dev/live-reload.js"></script></body>`;

let running = false, again = false;
const changed = new Set<string>();
async function build() {
  if (running) { again = true; return; }
  running = true; again = false;
  const files = [...changed]; changed.clear();
  state = { status: 'building' };
  broadcast('building', { files });
  console.log(files.length ? `\nChanged: ${files.slice(0, 5).join(', ')}${files.length > 5 ? ` and ${files.length - 5} more` : ''}. Rebuilding…` : 'Building…');
  const started = Date.now();
  const output = await new Promise<{ code: number | null; text: string }>(done => {
    let text = '';
    const child = spawn(process.execPath, [resolve(root, 'scripts/build.ts'), ...(site ? ['--site'] : [])], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { text += chunk; });
    child.stderr.on('data', chunk => { text += chunk; });
    child.on('close', code => done({ code, text }));
  });
  if (output.code === 0) {
    state = { status: 'ready' };
    console.log(`Rebuilt in ${((Date.now() - started) / 1000).toFixed(1)}s. Open pages reload.`);
    broadcast('reload', {});
  } else {
    state = { status: 'failed', message: buildError(output.text) };
    console.error(`Build failed; still serving the last good build.\n${state.message}`);
    broadcast('failed', { message: state.message });
  }
  await reportUnregistered();
  running = false;
  if (again || changed.size) void build();
}

/** Topic folders the build ignores because they are not in topics/topics.json yet. */
let reported = '';
async function reportUnregistered() {
  const registry = await readFile(resolve(root, 'topics/topics.json'), 'utf8').then(text => (JSON.parse(text) as { topics: string[] }).topics, () => [] as string[]);
  const folders = await readdir(resolve(root, 'topics'), { withFileTypes: true });
  const pending: string[] = [];
  for (const folder of folders) {
    if (!folder.isDirectory() || folder.name === 'assets' || registry.includes(folder.name)) continue;
    if (await access(resolve(root, 'topics', folder.name, 'README.md')).then(() => true, () => false)) pending.push(folder.name);
  }
  const message = pending.length ? `Not in the site yet (register with node scripts/add-topic.ts <id>): ${pending.join(', ')}` : '';
  if (message && message !== reported) console.log(message);
  reported = message;
}

function start() {
  let timer: NodeJS.Timeout | undefined;
  for (const folder of watched) {
    watch(resolve(root, folder), { recursive: true }, (_event, file) => {
      if (!file) return;
      const path = `${folder}/${file}`;
      // Editors' swap and backup files, OS metadata, and tests never change the site.
      if (path.split('/').some(part => part.startsWith('.')) || path.endsWith('~') || /\.test\.ts$/.test(path) || path.endsWith('.html')) return;
      changed.add(relative(root, resolve(root, path)));
      clearTimeout(timer);
      timer = setTimeout(() => void build(), 250);
    });
  }

  serveSite(directory, url => console.log(`Dev preview: ${url}\nWatching ${watched.join('/, ')}/ — saving a file rebuilds the site${site ? ', with sharing images,' : ''} and reloads open pages. Press Ctrl+C to stop.`), {
    handle(pathname, request, response) {
      if (pathname === '/__dev/live-reload.js') {
        response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
        response.end(request.method === 'HEAD' ? undefined : client);
        return true;
      }
      if (pathname === '/__dev/events') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        clients.add(response);
        if (state.status === 'failed') send(response, 'failed', { message: state.message });
        if (state.status === 'building') send(response, 'building', {});
        const ping = setInterval(() => response.write(': ping\n\n'), 30_000);
        request.on('close', () => { clearInterval(ping); clients.delete(response); });
        return true;
      }
      return false;
    },
    html: html => html.replace(/<\/body>(?![\s\S]*<\/body>)/, '<script src="/__dev/live-reload.js"></script></body>'),
    missing: placeholder
  });
  void build();
}

if (import.meta.main) start();
