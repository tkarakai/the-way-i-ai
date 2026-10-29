import { execFileSync } from 'node:child_process';
import type { Collection, Edition, RenderedTopic, RenderedPage } from '../design-system/types.ts';
import { canonicalURL } from './discovery.ts';
import { Marked } from 'marked';
import type { Token } from 'marked';
import { splitFrontMatter } from './markdown-source.ts';

/**
 * Plain-Markdown editions of every page for agents and other tools, following the
 * llms.txt proposal (https://llmstxt.org/): a short index at /llms.txt, the whole
 * collection at /llms-full.txt, and an index.md beside each page's index.html.
 */

const markdownURL = (collection: Collection, folder: string) => canonicalURL(collection.siteUrl, `${folder}index.md`);

/** Removes authoring-only markup and makes every link and image address absolute. */
export function publishableMarkdown(markdown: string, base: string, images: Map<string, string> = new Map()): string {
  const parser = new Marked();
  // Work on token source ranges, so a Markdown-looking example inside code is
  // never rewritten. Reference-style links are expanded at the point of use.
  const rewrite = (source: string, tokens: Token[]): string => {
    let cursor = 0, result = '';
    for (const token of tokens) {
      const at = source.indexOf(token.raw, cursor);
      if (at < 0) continue;
      result += source.slice(cursor, at);
      let replacement = token.raw;
      if (token.type === 'link' || token.type === 'image') {
        const absolute = new URL(token.href, base).href;
        const href = token.type === 'image' ? images.get(absolute) ?? absolute : absolute;
        const title = token.title ? ` "${token.title.replaceAll('"', '\\"')}"` : '';
        replacement = `${token.type === 'image' ? '!' : ''}[${token.text}](<${href}>${title})`;
      } else if (token.type === 'html' && /^\s*<!-- \/?excerpt:[a-z0-9-]+ -->\s*$/.test(token.raw)) {
        replacement = '';
      } else if (token.type !== 'code' && token.type !== 'codespan') {
        if ('tokens' in token && token.tokens) replacement = rewrite(token.raw, token.tokens);
        else if (token.type === 'list') replacement = rewrite(token.raw, token.items);
        else if (token.type === 'table') replacement = rewrite(token.raw, [...token.header, ...token.rows.flat()].flatMap(cell => cell.tokens));
      }
      result += replacement;
      cursor = at + token.raw.length;
    }
    return result + source.slice(cursor);
  };
  return rewrite(markdown, parser.lexer(markdown)).trim();
}

function topicHeader(collection: Collection, topic: RenderedTopic, url: string) {
  const facts = [
    `Topic ${Number(topic.number)} of ${collection.title} · ${topic.category}`,
    topic.created ? `Created ${topic.created}${topic.updated && topic.updated !== topic.created ? `, updated ${topic.updated}` : ''}` : '',
    `Author: ${collection.author.name} (${collection.author.url})`,
    `Web edition: ${url}`
  ].filter(Boolean);
  return `# ${topic.title}\n\n> ${topic.description}\n\n${facts.map(fact => `- ${fact}`).join('\n')}\n\n**Thesis:** ${topic.thesis}`;
}

/** One topic as a single Markdown document: its metadata, then each listed document in reading order. */
export function topicMarkdown(collection: Collection, topic: RenderedTopic, images: Map<string, string>): string {
  const url = canonicalURL(collection.siteUrl, `topics/${topic.id}/index.html`);
  const documents = topic.rendered.map((doc, index) => {
    const source = index === 0 ? splitFrontMatter(doc.markdown, doc.file).body : doc.markdown;
    // The main title is already in the header; companion documents keep theirs as boundaries.
    const body = index === 0 ? source.replace(/^\s*# [^\r\n]*\r?\n/, '') : source;
    return publishableMarkdown(body, new URL(doc.file, url).href, images);
  });
  return `${topicHeader(collection, topic, url)}\n\n---\n\n${documents.join('\n\n---\n\n')}\n`;
}

export function pageMarkdown(collection: Collection, page: RenderedPage & { markdown: string }): string {
  return `${publishableMarkdown(page.markdown, canonicalURL(collection.siteUrl, `${page.id}/index.html`))}\n`;
}

export function llmsIndex(collection: Collection, topics: RenderedTopic[], pages: RenderedPage[], edition: Edition): string {
  const topicLinks = topics.toReversed().map(topic => `- [${topic.title}](${markdownURL(collection, `topics/${topic.id}/`)}): ${topic.description}`);
  const pageLinks = pages.map(page => `- [${page.title}](${markdownURL(collection, `${page.id}/`)}): ${page.description}`);
  return `# ${collection.title}

> ${collection.description}

Essays by ${collection.author.name} (${collection.author.url}) on working with AI, published at ${collection.siteUrl}. Every page has a plain-Markdown edition: add \`index.md\` to a page's folder URL. Topics are listed newest first. Edition ${edition.version}.

## Topics

${topicLinks.join('\n')}

## About this site

${pageLinks.join('\n')}

## Optional

- [Everything in one file](${canonicalURL(collection.siteUrl, 'llms-full.txt')}): every topic's complete Markdown, newest first
- [RSS feed](${canonicalURL(collection.siteUrl, 'feed.xml')}): full-text feed of the topics
${collection.repositoryUrl ? `- [Source repository](${collection.repositoryUrl}): the Markdown sources and the site generator\n` : ''}`;
}

export function llmsFull(collection: Collection, topics: RenderedTopic[], markdown: Map<string, string>, edition: Edition): string {
  return `# ${collection.title}: every topic\n\n> ${collection.description}\n\nEdition ${edition.version}. Topics are separated by a line of equals signs, newest first.\n\n${topics.toReversed().map(topic => markdown.get(topic.id)!).join('\n\n==========\n\n')}`;
}

/**
 * The edition names the build: its UTC build time to the minute, plus the source commit,
 * as YYYY.MM.DD.HHMM+commit. Set SOURCE_DATE_EPOCH (seconds) to rebuild a past edition.
 */
export function buildEdition(root: string): Edition {
  const epoch = process.env.SOURCE_DATE_EPOCH;
  const built = epoch ? new Date(Number(epoch) * 1000) : new Date();
  if (Number.isNaN(built.getTime())) throw new Error('SOURCE_DATE_EPOCH must be a number of seconds.');
  const git = (...args: string[]) => {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { return ''; }
  };
  const commit = process.env.GITHUB_SHA || git('rev-parse', 'HEAD') || undefined;
  // Local builds with uncommitted changes say so; CI always builds a clean checkout.
  const dirty = !process.env.GITHUB_SHA && commit && git('status', '--porcelain', '--untracked-files=no') ? '.local' : '';
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${built.getUTCFullYear()}.${pad(built.getUTCMonth() + 1)}.${pad(built.getUTCDate())}.${pad(built.getUTCHours())}${pad(built.getUTCMinutes())}`;
  return { version: `${stamp}+${commit ? commit.slice(0, 7) + dirty : 'local'}`, built: built.toISOString().replace(/\.\d{3}Z$/, 'Z'), ...(commit ? { commit } : {}) };
}

/** RFC 9116 contact details for reporting security problems, valid for 180 days from the build. */
export function securityTxt(collection: Collection, edition: Edition): string {
  const expires = new Date(Date.parse(edition.built) + 180 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const repository = collection.repositoryUrl?.replace(/\/$/, '');
  const securityPage = repository ? `${repository}/security` : undefined;
  return [
    `Contact: ${securityPage ?? collection.author.url}`,
    `Expires: ${expires}`,
    ...(securityPage ? [`Policy: ${securityPage}`] : []),
    'Preferred-Languages: en',
    `Canonical: ${canonicalURL(collection.siteUrl, '.well-known/security.txt')}`,
    ''
  ].join('\n');
}
