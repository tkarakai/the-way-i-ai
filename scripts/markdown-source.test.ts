import test from 'node:test';
import assert from 'node:assert/strict';
import { articleSource, splitFrontMatter } from './markdown-source.ts';

const metadata = 'category: Agentic software development\ndescription: >-\n  One description,\n  folded across lines.\nthesis: "Knowledge: available when needed."\n';
const body = '\n# Authored title\n\n> This remains an ordinary blockquote.\n\n## 01. Authored chapter\n\nBody text.\n';
const source = `---\n${metadata}---\n${body}`;

test('YAML front matter supplies metadata and leaves authored Markdown untouched', () => {
  const article = articleSource(source, 'README.md');
  assert.deepEqual(article.topic, {
    presentation: 'article', category: 'Agentic software development',
    description: 'One description, folded across lines.', thesis: 'Knowledge: available when needed.',
    documents: [{ file: 'README.md' }],
  });
  assert.equal(article.body, body);
  assert.equal(splitFrontMatter(body, 'README.md').metadata, undefined);
  assert.equal(splitFrontMatter(body, 'README.md').body, body);
  assert.equal(articleSource(`\uFEFF${source.replaceAll('\n', '\r\n')}`, 'README.md').topic.description, article.topic.description);
});

test('front matter rejects ambiguous, mistyped, or malformed metadata', () => {
  for (const [invalid, message] of [
    [body, /must start with YAML front matter/],
    [`---\n${metadata}`, /closing ---/],
    [`---\n${metadata}category: Again\n---\n${body}`, /invalid YAML/],
    [`---\n${metadata}unknown: typo\n---\n${body}`, /unsupported front matter field/],
    [`---\n${metadata}title: Competing title\n---\n${body}`, /title comes from #/],
    [`---\n${metadata.replace('category: Agentic software development', 'category: 42')}---\n${body}`, /category.*nonempty string/],
    [`---\n${metadata.replace('description: >-\n  One description,\n  folded across lines.\n', '')}---\n${body}`, /description.*nonempty string/],
    [`---\n${metadata.replace('thesis: "Knowledge: available when needed."', 'thesis: ""')}---\n${body}`, /thesis.*nonempty string/],
    [`---\n- not a mapping\n---\n${body}`, /must be a mapping/],
    [`---\n${metadata}cover: 42\n---\n${body}`, /cover.*nonempty string/],
    [`---\n${metadata}explorer: []\n---\n${body}`, /explorer.*must be a mapping/],
  ] as const) assert.throws(() => articleSource(invalid, 'README.md'), message);
});
