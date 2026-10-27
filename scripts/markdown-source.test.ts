import test from 'node:test';
import assert from 'node:assert/strict';
import { topicSource, splitFrontMatter } from './markdown-source.ts';

const metadata = 'category: Agentic software development\ndescription: >-\n  One description,\n  folded across lines.\nthesis: "Knowledge: available when needed."\n';
const body = '\n# Authored title\n\n> This remains an ordinary blockquote.\n\n## 01. Authored chapter\n\nBody text.\n';
const source = `---\n${metadata}---\n${body}`;

test('YAML front matter supplies metadata and leaves authored Markdown untouched', () => {
  const article = topicSource(source, 'README.md');
  assert.deepEqual(article.topic, {
    category: 'Agentic software development', description: 'One description, folded across lines.',
    thesis: 'Knowledge: available when needed.', documents: [{ file: 'README.md' }],
  });
  assert.deepEqual(topicSource(source.replace('category:', 'created: 2024-02-29\nupdated: 2026-10-26\ncategory:'), 'README.md').topic, { ...article.topic, created: '2024-02-29', updated: '2026-10-26' });
  assert.equal(article.body, body);
  assert.equal(splitFrontMatter(body, 'README.md').metadata, undefined);
  assert.equal(splitFrontMatter(body, 'README.md').body, body);
  assert.equal(topicSource(`\uFEFF${source.replaceAll('\n', '\r\n')}`, 'README.md').topic.description, article.topic.description);
  assert.deepEqual(topicSource(source.replace('category:', 'documents: [README.md, WORKFLOW.md]\ncategory:'), 'README.md').topic.documents, [{ file: 'README.md' }, { file: 'WORKFLOW.md' }]);
});

test('front matter rejects ambiguous, mistyped, or malformed metadata', () => {
  for (const [invalid, message] of [
    [body, /must start with YAML front matter/],
    [`---\n${metadata}`, /closing ---/],
    [`---\n${metadata}category: Again\n---\n${body}`, /invalid YAML/],
    [`---\n${metadata}unknown: typo\n---\n${body}`, /unsupported front matter field/],
    [`---\n${metadata}title: Competing title\n---\n${body}`, /title comes from/],
    [`---\n${metadata}presentation: article\n---\n${body}`, /unsupported front matter field/],
    [`---\n${metadata.replace('category: Agentic software development', 'category: 42')}---\n${body}`, /category.*nonempty string/],
    [`---\n${metadata.replace('description: >-\n  One description,\n  folded across lines.\n', '')}---\n${body}`, /description.*nonempty string/],
    [`---\n${metadata.replace('thesis: "Knowledge: available when needed."', 'thesis: ""')}---\n${body}`, /thesis.*nonempty string/],
    [`---\n- not a mapping\n---\n${body}`, /must be a mapping/],
    [`---\n${metadata}cover: 42\n---\n${body}`, /cover.*nonempty string/],
    [`---\n${metadata}created: 2026-02-29\n---\n${body}`, /valid YYYY-MM-DD/],
    [`---\n${metadata}created: 2026-10-26T12:00:00Z\n---\n${body}`, /valid YYYY-MM-DD/],
    [`---\n${metadata}created: 2026-10-26\nupdated: 2026-10-25\n---\n${body}`, /must not precede/],
    [`---\n${metadata}updated: 2026-10-26\n---\n${body}`, /updated requires created/],
    [`---\n${metadata}explorer: []\n---\n${body}`, /explorer.*must be a mapping/],
    ...['[]', '[WORKFLOW.md]', '[README.md, README.md]', '[README.md, ../outside.md]', '[README.md, /outside.md]', '[README.md, {file: WORKFLOW.md}]'].map(value => [`---\n${metadata}documents: ${value}\n---\n${body}`, /documents must be unique local/] as const),
  ] as const) assert.throws(() => topicSource(invalid, 'README.md'), message as RegExp);
});
