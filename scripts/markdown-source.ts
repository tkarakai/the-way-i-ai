import { parseDocument } from 'yaml';
import type { Topic } from '../design-system/types.ts';

/** Front matter is build-time metadata, never part of the article or its outline. */
export function splitFrontMatter(source: string, file: string): { metadata?: Record<string, unknown>; body: string } {
  const opening = /^\uFEFF?---[ \t]*\r?\n/.exec(source);
  if (!opening) return { body: source };
  const rest = source.slice(opening[0].length);
  const closing = /^---[ \t]*(?:\r?\n|$)/m.exec(rest);
  if (!closing) throw new Error(`${file}: YAML front matter needs a closing --- delimiter.`);
  const document = parseDocument(rest.slice(0, closing.index));
  if (document.errors.length || document.warnings.length) throw new Error(`${file}: invalid YAML front matter: ${[...document.errors, ...document.warnings].map(error => error.message).join('; ')}`);
  const metadata: unknown = document.toJS({ maxAliasCount: 0 });
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error(`${file}: YAML front matter must be a mapping.`);
  return { metadata: metadata as Record<string, unknown>, body: rest.slice(closing.index + closing[0].length) };
}

/** A single README owns both the publication metadata and its complete content. */
export function articleSource(source: string, file: string): { topic: Topic; body: string } {
  const { metadata, body } = splitFrontMatter(source, file);
  if (!metadata) throw new Error(`${file}: without topic.json, README.md must start with YAML front matter.`);
  const allowed = new Set(['category', 'description', 'thesis', 'cover', 'explorer']);
  for (const key of Object.keys(metadata)) {
    if (!allowed.has(key)) throw new Error(`${file}: unsupported front matter field "${key}". The title comes from # and a single README implies article presentation.`);
  }
  const text = (key: string) => {
    const value = metadata[key];
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${file}: front matter "${key}" must be a nonempty string.`);
    return value.trim();
  };
  const topic: Topic = {
    presentation: 'article', category: text('category'), description: text('description'), thesis: text('thesis'),
    documents: [{ file: 'README.md' }],
  };
  if (metadata.cover !== undefined) topic.cover = text('cover');
  if (metadata.explorer !== undefined) {
    if (!metadata.explorer || typeof metadata.explorer !== 'object' || Array.isArray(metadata.explorer)) throw new Error(`${file}: front matter "explorer" must be a mapping.`);
    topic.explorer = metadata.explorer as Topic['explorer'];
  }
  return { topic, body };
}
