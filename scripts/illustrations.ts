import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RenderedDocument, Species } from '../design-system/types.ts';
import { escape } from '../design-system/layout.ts';
import { thumbnail } from './thumbnail.ts';

export interface Illustration {
  file: string;
  placement: 'homepage' | 'hero' | 'chapter' | 'panorama';
  alt: string;
  width: number;
  height: number;
  document?: string;
  heading?: string;
}
export interface TopicIllustrationManifest { version: 1 | 2; topic: string; images: Illustration[] }
export interface WildlifeManifest { version: 3; species: string; images: Illustration[] }
export type IllustrationManifest = TopicIllustrationManifest | WildlifeManifest;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Unknown illustration manifest field');
}
export function parseManifest(value: unknown, topic: string, documents: RenderedDocument[]): IllustrationManifest {
  if (!object(value)) throw new Error('Illustration manifest must be an object');
  if (value.version === 3) return parseWildlifeManifest(value);
  keys(value, ['version', 'topic', 'images']);
  if ((value.version !== 1 && value.version !== 2) || value.topic !== topic || !Array.isArray(value.images)) throw new Error('Invalid illustration manifest version, topic or images');
  const files = new Set<string>();
  const placements = new Set<string>();
  for (const image of value.images) {
    if (!object(image)) throw new Error('Invalid illustration entry');
    keys(image, ['file', 'placement', 'alt', 'width', 'height', 'document', 'heading']);
    const { file, placement, alt, width, height } = image;
    if (typeof alt !== 'string' || !alt.trim()) throw new Error('Illustrations require descriptive alt text');
    if (typeof width !== 'number' || typeof height !== 'number' || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) throw new Error('Illustration dimensions must be positive integers');
    const stem = value.version === 2
      ? placement === 'hero' ? 'hero' : placement === 'chapter' ? 'chapter-0[1-4]' : undefined
      : placement === 'homepage' ? 'hero-homepage' : placement === 'hero' ? 'hero-article' : placement === 'chapter' ? 'chapter-0[1-4]' : undefined;
    if (!stem || typeof file !== 'string' || !new RegExp(`^${stem}\\.(webp|png|jpg|jpeg)$`).test(file)) throw new Error('Invalid illustration placement or filename');
    const ratio = value.version === 2 ? placement === 'chapter' ? 4 : 16 / 9
      : placement === 'homepage' ? 4 / 3 : placement === 'hero' ? 16 / 9 : 2;
    if (Math.abs(width / height - ratio) > 0.001) throw new Error('Incorrect illustration aspect ratio');
    let target = String(placement);
    if (placement === 'chapter') {
      const docs = documents.filter(doc => doc.file === image.document);
      const headings = docs.flatMap(doc => doc.headings.filter(h => h.level === 2 && h.text === image.heading));
      if (docs.length !== 1 || headings.length !== 1) throw new Error('Illustration chapter document/heading must match exactly once');
      target = headings[0].id;
    } else if (image.document !== undefined || image.heading !== undefined) throw new Error('Only chapter illustrations may reference a document/heading');
    if (files.has(file) || placements.has(target)) throw new Error('Duplicate illustration file or placement');
    files.add(file);
    placements.add(target);
  }
  return value as unknown as IllustrationManifest;
}

function parseWildlifeManifest(value: Record<string, unknown>): WildlifeManifest {
  keys(value, ['version', 'species', 'images']);
  if (typeof value.species !== 'string' || !value.species.trim() || !Array.isArray(value.images) || value.images.length !== 5) throw new Error('Wildlife manifest requires a species and exactly five image entries');
  for (const [index, image] of value.images.entries()) {
    if (!object(image)) throw new Error('Invalid wildlife image entry');
    keys(image, ['file', 'placement', 'alt', 'width', 'height']);
    const stem = index === 0 ? 'hero' : `panorama-0${index}`;
    const placement = index === 0 ? 'hero' : 'panorama';
    if (typeof image.file !== 'string' || !new RegExp(`^${stem}\\.(webp|png|jpg|jpeg)$`).test(image.file) || image.placement !== placement || image.alt !== '') throw new Error('Wildlife images require ordered filenames, hero/panorama placements and empty decorative alt text');
    const { width, height } = image;
    if (typeof width !== 'number' || typeof height !== 'number' || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || Math.abs(width / height - (index === 0 ? 16 / 9 : 4)) > .001) throw new Error('Invalid wildlife image dimensions or aspect ratio');
  }
  return value as unknown as WildlifeManifest;
}

/** Manifests name species as "Common name (Binomial)" or just the binomial. */
export function parseSpecies(value: string): Species {
  const match = /^(.+?)\s*\(([^()]+)\)$/.exec(value.trim());
  return match ? { common: match[1].trim(), latin: match[2].trim() } : { latin: value.trim() };
}

async function optionalRead(path: string) {
  try { return await readFile(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}

/** Wildlife is decorative: spread fixed slots across chapter boundaries, without semantic bindings. */
async function loadWildlife(directory: string, manifest: WildlifeManifest, documents: RenderedDocument[]) {
  const boundaries = documents.flatMap(doc => doc.headings.filter(heading => heading.level === 2).slice(1).map(heading => ({ doc, heading })));
  const count = Math.min(4, boundaries.length);
  const slots = Array.from({ length: count }, (_, index) => boundaries[Math.floor(index * boundaries.length / count)]);
  let homepage = '', hero = '', portrait: string | undefined;
  for (const [index, image] of manifest.images.entries()) {
    // Slots depend on declared reading order, never which image files have arrived.
    const slot = index > 0 ? slots[index - 1] : undefined;
    if (index > 0 && !slot) continue;
    const data = await optionalRead(resolve(directory, image.file));
    if (!data) continue;
    const extension = image.file.split('.').at(-1)!;
    const mime = extension === 'jpg' || extension === 'jpeg' ? 'jpeg' : extension;
    const attributes = `src="data:image/${mime};base64,${data.toString('base64')}" alt="" width="${image.width}" height="${image.height}" decoding="async"`;
    if (index === 0) {
      homepage = `<img class="editorial-image editorial-homepage" ${attributes}>`;
      hero = `<img class="editorial-image editorial-hero editorial-portrait" ${attributes}>`;
      portrait = thumbnail(data, extension) ?? `data:image/${mime};base64,${data.toString('base64')}`;
    } else {
      const html = `<img class="editorial-image editorial-chapter editorial-wildlife" ${attributes} loading="lazy">`;
      const start = slot!.doc.html.indexOf(`<h2 id="${slot!.heading.id}"`);
      slot!.doc.html = slot!.doc.html.slice(0, start) + html + slot!.doc.html.slice(start);
    }
  }
  return { homepage, hero, species: parseSpecies(manifest.species), ...(portrait ? { thumbnail: portrait } : {}) };
}

/** Missing artwork is normal during delivery; invalid metadata is not. */
export async function loadIllustrations(root: string, topic: string, documents: RenderedDocument[]) {
  const directory = resolve(root, 'topics', topic, 'assets/illustrations');
  const source = await optionalRead(resolve(directory, 'manifest.json'));
  let homepage = '', hero = '', portrait: string | undefined;
  if (!source) return { homepage, hero };
  const manifest = parseManifest(JSON.parse(source.toString('utf8')), topic, documents);
  if (manifest.version === 3) return loadWildlife(directory, manifest, documents);
  // Version 1 deliveries remain usable, but their separate article hero is retired.
  const sharedHero = manifest.images.find(image => image.placement === 'homepage')
    ?? manifest.images.find(image => image.placement === 'hero');
  for (const image of manifest.images) {
    if (image.placement !== 'chapter' && image !== sharedHero) continue;
    const data = await optionalRead(resolve(directory, image.file));
    if (!data) continue;
    const extension = image.file.split('.').at(-1)!;
    const mime = extension === 'jpg' || extension === 'jpeg' ? 'jpeg' : extension;
    const html = `<img class="editorial-image editorial-${image.placement}" src="data:image/${mime};base64,${data.toString('base64')}" alt="${escape(image.alt)}" width="${image.width}" height="${image.height}"${image.placement === 'chapter' ? ' loading="lazy"' : ''} decoding="async">`;
    if (image === sharedHero) {
      portrait = thumbnail(data, extension) ?? `data:image/${mime};base64,${data.toString('base64')}`;
      homepage = html.replace(`editorial-${image.placement}`, 'editorial-homepage');
      hero = html.replace(`editorial-${image.placement}`, 'editorial-hero');
    } else {
      const doc = documents.find(doc => doc.file === image.document)!;
      const heading = doc.headings.find(h => h.level === 2 && h.text === image.heading)!;
      const start = doc.html.indexOf(`id="${heading.id}"`);
      const end = doc.html.indexOf('</h2>', start) + '</h2>'.length;
      doc.html = doc.html.slice(0, end) + html + doc.html.slice(end);
    }
  }
  return { homepage, hero, ...(portrait ? { thumbnail: portrait } : {}) };
}
