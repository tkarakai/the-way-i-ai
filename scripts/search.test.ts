import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionSearch, searchText } from '../design-system/search.ts';
import type { RenderedTopic } from '../design-system/types.ts';

const codeExample = (code: string) => `<div class="code-example"><div class="code-toolbar"><span>Terminal example</span><button class="small-button js-only" data-copy="example-code-1" aria-label="Copy code example">Copy</button></div><diffs-container><template shadowrootmode="open"><style>irrelevant-token</style><pre>rendered code</pre></template></diffs-container><script type="application/json" id="example-code-1">${JSON.stringify(code).replaceAll('<', '\\u003c')}</script></div>`;

test('search excludes code toolbar labels while preserving authored prose and original code', () => {
  assert.equal(searchText(`<p>Create a worktree.</p>${codeExample('git worktree add feature')}`), 'Create a worktree. git worktree add feature');
  assert.equal(searchText(`<p>Copy the example.</p>${codeExample('echo "Copy <div class=\\"code-toolbar\\">"')}`), 'Copy the example. echo "Copy <div class=\\"code-toolbar\\">"');
});

test('search uses visible prose and original code, not syntax-highlight CSS or controls', () => {
  const html = '<p>Use A &amp; B with &#x3B1;.</p><diffs-container><template shadowrootmode="open"><style>irrelevant-token</style><pre>rendered code</pre></template></diffs-container><script type="application/json">"if (a < b) run()"</script>';
  assert.equal(searchText(html), 'Use A & B with α. if (a < b) run()');
});

test('collection search includes opening prose and every section, with stable relative result links', () => {
  const topic: RenderedTopic = {
    id: 'example', title: 'An example', category: 'Practice', description: 'Description', thesis: 'Thesis', documents: [], number: '01', coverSVG: '', diagramSVG: '',
    rendered: [{ id: 'example-doc-1', file: 'README.md', label: 'The idea', title: 'Full title', markdown: '', sha256: '', excerpts: new Map(),
      html: `<p>Opening argument.</p>${codeExample('git status')}<h2 id="first">First section</h2><p>First text.</p>${codeExample('git worktree add feature')}<h3 id="second">Subsection</h3><p>Second text.</p>`,
      headings: [{ id: 'first', text: 'First section', level: 2, excerpt: '' }, { id: 'second', text: 'Subsection', level: 3, excerpt: '' }],
    }],
  };
  const entries = collectionSearch([topic]);
  assert.equal(entries.length, 4);
  assert.equal(entries[1].text, 'Opening argument. git status');
  assert.equal(entries[1].href, 'topics/example/index.html#example-doc-1-title');
  assert.equal(entries[2].text, 'First section First text. git worktree add feature');
  assert.equal(entries[3].text, 'Subsection Second text.');
  assert.equal(entries[3].href, 'topics/example/index.html#second');
});
