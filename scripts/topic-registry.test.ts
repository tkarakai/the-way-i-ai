import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerTopic, topicTable, withTopicTable } from './topic-registry.ts';

const json = `{
  "title": "The Way I AI",
  "author": { "name": "tkarakai", "url": "https://github.com/tkarakai" },
  "topics": [
    "worktrees",
    "agent-roles"
  ],
  "repositoryUrl": "https://github.com/tkarakai/the-way-i-ai"
}
`;

test('registering a topic appends its ID and preserves hand-written formatting', () => {
  const result = registerTopic(json, 'new-idea');
  assert.equal(result, json.replace('"agent-roles"\n', '"agent-roles",\n    "new-idea"\n'));
  assert.equal(registerTopic(result, 'new-idea'), result, 'registering twice changes nothing');
  assert.deepEqual(JSON.parse(registerTopic('{ "topics": [] }', 'first')).topics, ['first']);
  assert.throws(() => registerTopic('{ "title": "x" }', 'first'), /no "topics" array/);
});

test('the real registry accepts a new topic without other changes', async () => {
  const real = await readFile(new URL('../topics/topics.json', import.meta.url), 'utf8');
  const parsed = JSON.parse(real);
  assert.deepEqual(JSON.parse(registerTopic(real, 'zz-new')), { ...parsed, topics: [...parsed.topics, 'zz-new'] });
});

test('the README topic table lists canonical order, source documents and the live edition', () => {
  const table = topicTable('https://thewayiai.com/', [
    { id: 'worktrees', number: '01', title: 'Git | Worktrees', description: 'One task.\n  One branch.', documents: [{ file: 'README.md', title: 'Git Worktrees' }, { file: 'WORKFLOW.md', title: 'The [real] workflow' }] }
  ]);
  assert.match(table, /^<!-- topics:start .*-->\n\| Topic \| Idea \| Markdown \| Interactive edition \|\n\| --- \| --- \| --- \| --- \|\n/);
  assert.match(table, /\| \*\*01 · Git \\\| Worktrees\*\* \| One task\. One branch\. \| \[README\]\(topics\/worktrees\/README\.md\) · \[The \\\[real\\\] workflow\]\(topics\/worktrees\/WORKFLOW\.md\) \| \[Read online\]\(https:\/\/thewayiai\.com\/topics\/worktrees\/\) \|/);
  assert.match(table, /<!-- topics:end -->$/);
});

test('the generated table replaces exactly one marked block', () => {
  const readme = 'Intro\n\n<!-- topics:start -->\nold\n<!-- topics:end -->\n\nAfter\n';
  assert.equal(withTopicTable(readme, 'NEW'), 'Intro\n\nNEW\n\nAfter\n');
  assert.throws(() => withTopicTable('No markers', 'NEW'), /exactly one/);
  assert.throws(() => withTopicTable(readme + readme, 'NEW'), /exactly one/);
});
