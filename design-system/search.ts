import type { RenderedTopic, SearchEntry } from './types.ts';

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Removes tags until none remain, so a removal can never join leftover fragments into a new tag. */
export function stripTags(html: string, replacement = ''): string {
  let previous: string;
  do {
    previous = html;
    html = html.replace(/<[^>]*>/g, replacement);
  } while (html !== previous);
  return html;
}

/** Decodes entities in a single pass, so `&amp;lt;` stays the literal text `&lt;`. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
    if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? match;
    return String.fromCodePoint(entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
  });
}

/** Search is generated from the rendered source, including the original code data. */
export function searchText(html: string): string {
  const code: string[] = [];
  let prose = html.replace(/<script\b[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi, (_match, json: string) => {
    const value: unknown = JSON.parse(json);
    if (typeof value === 'string') code.push(value);
    return '';
  });
  let previous: string;
  do {
    previous = prose;
    prose = prose.replace(/<(template|style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<div class="code-toolbar">[\s\S]*?<\/div>/g, '');
  } while (prose !== previous);
  return [decodeEntities(stripTags(prose, ' ')), ...code].join(' ').replace(/\s+/g, ' ').trim();
}

export function collectionSearch(topics: RenderedTopic[]): SearchEntry[] {
  return topics.flatMap(topic => {
    const href = `topics/${topic.id}/index.html`;
    const entries: SearchEntry[] = [{ title: topic.title, topic: topic.category, href, text: topic.description }];
    for (const doc of topic.rendered) {
      const starts = doc.headings.map(heading => doc.html.indexOf(`<h${heading.level} id="${heading.id}"`));
      const introduction = searchText(doc.html.slice(0, starts[0] ?? doc.html.length));
      if (introduction) entries.push({ title: doc.title, topic: topic.title, href: `${href}#${doc.id}-title`, text: introduction });
      doc.headings.forEach((heading, index) => {
        entries.push({ title: heading.text, topic: topic.title, href: `${href}#${heading.id}`, text: searchText(doc.html.slice(starts[index], starts[index + 1] ?? doc.html.length)) });
      });
    }
    return entries;
  });
}
