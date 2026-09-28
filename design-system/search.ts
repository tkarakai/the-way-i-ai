import type { RenderedTopic, SearchEntry } from './types.ts';

/** Search is generated from the rendered source, including the original code data. */
export function searchText(html: string): string {
  const code: string[] = [];
  const prose = html.replace(/<script\b[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi, (_match, json: string) => {
    const value: unknown = JSON.parse(json);
    if (typeof value === 'string') code.push(value);
    return '';
  }).replace(/<(template|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(x[\da-f]+|\d+);/gi, (_match, value: string) => String.fromCodePoint(value[0].toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value)))
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (_match, entity: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }[entity]!));
  return [prose, ...code].join(' ').replace(/\s+/g, ' ').trim();
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
