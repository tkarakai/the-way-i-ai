import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { access, copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { drawingBox, estimatePaper, frameDrawing, lightPaper, matchPaper } from './paper.ts';
import type { RGB } from './paper.ts';

/**
 * Generates a topic's five wildlife illustrations with the Codex CLI's built-in image
 * tool, signed in with a ChatGPT plan, so the images count against that subscription
 * rather than API billing. Codex only draws; this script frames, sizes and paper-matches
 * every image, writes the version 3 manifest, and builds a review sheet.
 *
 *   node scripts/illustrate.ts <topic-id> --species "Eurasian otter (Lutra lutra)"
 *   node scripts/illustrate.ts <topic-id> --only panorama-03      # redo one image
 *   node scripts/illustrate.ts <topic-id> --reframe               # re-process saved drawings
 *   node scripts/illustrate.ts --list-species                      # animals already in use
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const styleDirectory = resolve(root, 'design-system/illustration-style');

export interface ImageSpec { file: string; image: number; title: string; width: number; height: number; placement: 'hero' | 'panorama' }
export const images: ImageSpec[] = [
  { file: 'hero.png', image: 1, title: 'MAIN PORTRAIT', width: 1600, height: 900, placement: 'hero' },
  { file: 'panorama-01.png', image: 2, title: 'ADULT IN ACTION', width: 1600, height: 400, placement: 'panorama' },
  { file: 'panorama-02.png', image: 3, title: 'ADULT NATURAL BEHAVIOR', width: 1600, height: 400, placement: 'panorama' },
  { file: 'panorama-03.png', image: 4, title: 'PLAYFUL YOUNG ANIMALS', width: 1600, height: 400, placement: 'panorama' },
  { file: 'panorama-04.png', image: 5, title: 'YOUNG ANIMALS EXPLORING AND PLAYING', width: 1600, height: 400, placement: 'panorama' }
];
const name = (spec: ImageSpec) => spec.file.replace(/\.png$/, '');

/** The Field Atlas label shows "Common name (Binomial)" as a common and a Latin name. */
export function validSpecies(value: string): boolean {
  return /^[A-Z][\p{L}' -]+ \([A-Z][a-z]+ [a-z]+(?: [a-z]+)?\)$/u.test(value.trim());
}

export function manifestFor(species: string) {
  return {
    version: 3,
    species,
    images: images.map(spec => ({ file: spec.file, placement: spec.placement, alt: '', width: spec.width, height: spec.height }))
  };
}

/**
 * One image's brief: the master prompt, unchanged except that section 4 keeps only the
 * requested image and the delivery package (section 8) is left out, because this script
 * owns sizes, files and the manifest. The master prompt stays the single style source.
 */
export function composePrompt(master: string, species: string, spec: ImageSpec, withPortrait: boolean): string {
  const sections = master.split(/\n(?=## )/);
  const brief = sections.flatMap(section => {
    if (/^## 8\./.test(section)) return [];
    if (!/^## 4\./.test(section)) return [section];
    const parts = section.split(/\n(?=### )/);
    const chosen = parts.filter(part => part.startsWith(`### IMAGE ${spec.image} `));
    if (chosen.length !== 1) throw new Error(`The master prompt has no single "### IMAGE ${spec.image}" section.`);
    return [[parts[0].replace(/Generate FIVE separate illustrations[^\n]*/, `This run makes only IMAGE ${spec.image}; the other images of the collection are made in separate runs.`), chosen[0]].join('\n')];
  }).join('\n').replaceAll('[ANIMAL SPECIES]', species);
  if (brief.includes('[ANIMAL SPECIES]') || !brief.includes(species)) throw new Error('The species was not substituted into the master prompt.');
  const shape = spec.placement === 'hero'
    ? 'Use the image tool\'s 16:9 landscape format, or its closest landscape format.'
    : 'The image tool cannot make a 4:1 image. Use its widest landscape format and keep the whole scene (animals, ground, water, plants) in a horizontal band through the middle, with only clear paper above and below, so the pipeline can trim it to 4:1 without touching the drawing.';
  return `# This run: IMAGE ${spec.image} (${spec.title}) only

You are one step of an automated pipeline that makes a five-image wildlife collection for a website.

- Species: ${species}.
- Make exactly IMAGE ${spec.image} — ${spec.title}, following the brief below. Read the whole brief first.
- Attached: the approved style references (a red fox family). Match their technique, palette and paper; draw the species above, not a fox.${withPortrait ? '\n- Also attached: `hero.png`, the approved portrait of this collection. Draw the same animals: identical species markings, colouring and rendering.' : ''}
- Use your built-in image generation tool. ${shape}
- Save the image exactly as the tool returned it to \`./raw/${name(spec)}.png\` (keep the bytes, even if they are not PNG). Do not crop, resize, pad, recolour or retouch it: the pipeline frames, sizes and colour-matches it afterwards. Ignore the pixel dimensions in the brief; they describe the final, post-processed file.
- Do not create a ZIP, a manifest, or any other file, and do not change files outside \`./raw/\`.
- If the result clearly breaks the anatomy rules (extra, missing or fused limbs, wrong number of animals), generate again, at most twice more, and keep the best.
- End with one line: the saved path and its pixel size.

---

${brief}`;
}

async function exists(path: string) { return access(path).then(() => true, () => false); }

async function usedSpecies(): Promise<Map<string, string>> {
  const registry = JSON.parse(await readFile(resolve(root, 'topics/topics.json'), 'utf8')) as { topics: string[] };
  const used = new Map<string, string>();
  for (const id of registry.topics) {
    const manifest = await readFile(resolve(root, 'topics', id, 'assets/illustrations/manifest.json'), 'utf8').then(JSON.parse, () => undefined) as { species?: string } | undefined;
    if (manifest?.species) used.set(id, manifest.species);
  }
  return used;
}

/** Codex must exist and be signed in with ChatGPT; an API-key login would bill the API. */
function assertCodexSubscription(allowApiKey: boolean) {
  // Codex prints its login status on stderr.
  const result = spawnSync('codex', ['login', 'status'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error || result.status !== 0) {
    const reason = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT' ? 'The Codex CLI is not installed. Install it with `npm i -g @openai/codex`' : 'Codex is not signed in';
    throw new Error(`${reason}, then run \`codex login\` and choose "Sign in with ChatGPT".`);
  }
  const status = `${result.stdout}${result.stderr}`;
  if (!/chatgpt/i.test(status) && !allowApiKey) {
    throw new Error(`Codex is not signed in with ChatGPT (${status.trim()}). Images would be billed to the OpenAI API. Run \`codex logout\`, then \`codex login\` and choose "Sign in with ChatGPT", or pass --allow-api-billing.`);
  }
}

function runCodex(workspace: string, spec: ImageSpec, prompt: string, attachments: string[]): Promise<void> {
  const log = resolve(workspace, 'logs', `${name(spec)}.log`);
  const args = ['exec', '--color', 'never', '--ephemeral', '--skip-git-repo-check', '-s', 'workspace-write', '-C', workspace,
    '-o', resolve(workspace, 'logs', `${name(spec)}.last-message.txt`), prompt, '-i', ...attachments];
  return new Promise((done, fail) => {
    const output = createWriteStream(log);
    const child = spawn('codex', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(output, { end: false });
    child.stderr.pipe(output, { end: false });
    const started = Date.now();
    const ticker = setInterval(() => process.stdout.write(`  … ${Math.round((Date.now() - started) / 1000)}s\n`), 30_000);
    const timeout = setTimeout(() => child.kill('SIGTERM'), 15 * 60_000);
    child.on('error', fail);
    child.on('close', code => {
      clearInterval(ticker); clearTimeout(timeout); output.end();
      if (code === 0) done();
      else fail(new Error(`codex exec exited with ${code} for ${spec.file}; see ${relative(root, log)}`));
    });
  });
}

/** Frames the raw drawing at the published ratio, pads with its own paper, and matches the site paper. */
export async function finishImage(raw: Buffer, spec: ImageSpec, target: RGB): Promise<{ png: Buffer; note: string }> {
  const { data, info } = await sharp(raw).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.length);
  const paper = estimatePaper(pixels, info.width, info.height);
  if (!paper) throw new Error(`${spec.file}: no clear paper around the drawing; regenerate it.`);
  const box = frameDrawing(info.width, info.height, drawingBox(pixels, info.width, info.height, paper), spec.width / spec.height);
  const inside = {
    left: Math.max(0, box.left), top: Math.max(0, box.top),
    width: Math.min(info.width, box.left + box.width) - Math.max(0, box.left),
    height: Math.min(info.height, box.top + box.height) - Math.max(0, box.top)
  };
  const background = { r: paper[0], g: paper[1], b: paper[2] };
  const framed = await sharp(raw).removeAlpha()
    .extract(inside)
    .extend({ left: inside.left - box.left, top: inside.top - box.top, right: box.left + box.width - inside.left - inside.width, bottom: box.top + box.height - inside.top - inside.height, background })
    .png().toBuffer();
  const sized = await sharp(framed).resize(spec.width, spec.height, { fit: 'fill', kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
  const rgba = new Uint8Array(sized.buffer, sized.byteOffset, sized.length);
  let result;
  try { result = matchPaper(rgba, spec.width, spec.height, target, { recenter: spec.placement === 'hero' }); }
  catch (error) {
    if (!/re-centre/.test((error as Error).message)) throw error;
    result = matchPaper(rgba, spec.width, spec.height, target);
  }
  const png = await sharp(rgba, { raw: { width: spec.width, height: spec.height, channels: 4 } }).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
  const padded = box.left < 0 || box.top < 0 || box.left + box.width > info.width || box.top + box.height > info.height;
  return { png, note: `drawn ${info.width}×${info.height}, ${padded ? 'padded with paper' : 'trimmed'} to ${spec.width}×${spec.height}; paper ${result.coverage}%${result.shift ? `, centred by ${result.shift}px` : ''}` };
}

function reviewSheet(topic: string, species: string, workspace: string, stamp: number) {
  const final = (spec: ImageSpec) => relative(workspace, resolve(root, 'topics', topic, 'assets/illustrations', spec.file));
  const figure = (spec: ImageSpec) => `<figure><img src="${final(spec)}?v=${stamp}" alt="" width="${spec.width}" height="${spec.height}"><figcaption>${spec.file} · Image ${spec.image}: ${spec.title.toLowerCase()} · <a href="raw/${name(spec)}.png">drawing as generated</a></figcaption></figure>`;
  return `<!doctype html><meta charset="utf-8"><title>${species} · ${topic} illustrations</title>
<style>body{margin:0;font:15px/1.5 system-ui,sans-serif;color:#2b2722}section{padding:32px clamp(16px,4vw,48px)}.light{background:#f8f5ee}.dark{background:#1d1b19;color:#e8e2d6}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 24px;opacity:.75}figure{margin:0 0 28px;max-width:1100px}img{display:block;width:100%;height:auto}figcaption{font-size:13px;margin-top:6px;opacity:.7}a{color:inherit}
.dark figure:first-of-type{max-width:640px}</style>
<section class="light"><h1>${species} — ${topic}</h1><p>Check anatomy (legs, paws, ears, eyes, tails, number of animals), complete silhouettes with margins, matching style, and no visible paper boxes.</p>${images.map(figure).join('')}</section>
<section class="dark"><h1>On the dark theme</h1><p>The same opaque images; check that the paper edges read as a mounted print.</p>${images.map(figure).join('')}</section>\n`;
}

async function main() {
  const args = process.argv.slice(2);
  const option = (flag: string) => { const at = args.indexOf(flag); return at >= 0 ? args[at + 1] : undefined; };
  if (args.includes('--list-species')) {
    for (const [topic, species] of await usedSpecies()) console.log(`${topic}: ${species}`);
    return;
  }
  const topic = args.find((arg, index) => !arg.startsWith('--') && !['--species', '--only'].includes(args[index - 1]));
  if (!topic || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic)) throw new Error('Usage: node scripts/illustrate.ts <topic-id> [--species "Common name (Binomial)"] [--only hero,panorama-01] [--reframe] [--force]');
  if (!await exists(resolve(root, 'topics', topic, 'README.md'))) throw new Error(`topics/${topic}/README.md does not exist.`);
  const directory = resolve(root, 'topics', topic, 'assets/illustrations');
  const manifestPath = resolve(directory, 'manifest.json');
  const existing = await readFile(manifestPath, 'utf8').then(text => JSON.parse(text) as { version: number; species?: string }, () => undefined);
  const species = (option('--species') ?? existing?.species ?? '').trim();
  if (!validSpecies(species)) throw new Error(`Give the species as "Common name (Binomial)", for example --species "Eurasian otter (Lutra lutra)". Got: "${species}".`);
  if (existing?.species && existing.species !== species && !args.includes('--force')) throw new Error(`${topic} already shows ${existing.species}. Pass --force to replace it with ${species}.`);
  for (const [other, used] of await usedSpecies()) if (other !== topic && used === species) console.warn(`Note: ${other} already uses ${species}.`);

  const only = option('--only')?.split(',').map(value => value.trim().replace(/\.png$/, ''));
  for (const value of only ?? []) if (!images.some(spec => name(spec) === value)) throw new Error(`Unknown image "${value}". Use: ${images.map(name).join(', ')}.`);
  const selected = images.filter(spec => !only || only.includes(name(spec)));
  const reframe = args.includes('--reframe');
  if (!only && !reframe && existing && !args.includes('--force')) throw new Error(`${topic} already has illustrations. Use --only <image> to redo some, or --force to redo all five.`);

  const workspace = resolve(root, '.illustrate', topic);
  for (const folder of ['raw', 'logs', 'previous', 'prompts']) await mkdir(resolve(workspace, folder), { recursive: true });
  await mkdir(directory, { recursive: true });
  const target = await lightPaper();
  const stamp = Date.now();
  if (!reframe) assertCodexSubscription(args.includes('--allow-api-billing'));
  const master = await readFile(resolve(styleDirectory, 'single-topic-illustration-prompt.md'), 'utf8');
  const references = (await readdir(resolve(styleDirectory, 'references'))).filter(file => /\.(png|jpe?g|webp)$/i.test(file)).sort().map(file => resolve(styleDirectory, 'references', file));
  if (!references.length) throw new Error('No style references in design-system/illustration-style/references/.');

  // The portrait comes first; panoramas then see it, so all five show the same animals.
  for (const spec of selected) {
    const raw = resolve(workspace, 'raw', `${name(spec)}.png`);
    const destination = resolve(directory, spec.file);
    if (!reframe) {
      const portrait = resolve(directory, 'hero.png');
      const withPortrait = spec.placement === 'panorama' && await exists(portrait);
      const prompt = composePrompt(master, species, spec, withPortrait);
      await writeFile(resolve(workspace, 'prompts', `${name(spec)}.md`), prompt);
      await rm(raw, { force: true });
      console.log(`Drawing ${spec.file} (${spec.title.toLowerCase()}) with Codex…`);
      await runCodex(workspace, spec, prompt, withPortrait ? [...references, portrait] : references);
      if (!await exists(raw)) throw new Error(`Codex finished without saving raw/${name(spec)}.png; see .illustrate/${topic}/logs/${name(spec)}.log`);
    } else if (!await exists(raw)) { console.warn(`Skipping ${spec.file}: no saved drawing in .illustrate/${topic}/raw/.`); continue; }
    const { png, note } = await finishImage(await readFile(raw), spec, target);
    if (await exists(destination)) await copyFile(destination, resolve(workspace, 'previous', `${name(spec)}-${stamp}.png`));
    await writeFile(destination, png);
    console.log(`  ${spec.file}: ${note}`);
  }
  await writeFile(manifestPath, `${JSON.stringify(manifestFor(species), null, 2)}\n`);
  await writeFile(resolve(workspace, 'review.html'), reviewSheet(topic, species, workspace, stamp));
  console.log(`\nWrote topics/${topic}/assets/illustrations/ (${species}).`);
  console.log(`Review: open .illustrate/${topic}/review.html — earlier versions are in .illustrate/${topic}/previous/.`);
  console.log('Then run npm run build (or npm run build:site with a preview running) to see them in place.');
}

if (import.meta.main) await main().catch(error => { console.error(`illustrate: ${(error as Error).message}`); process.exit(1); });
