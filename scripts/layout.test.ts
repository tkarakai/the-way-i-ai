import test from 'node:test';
import assert from 'node:assert/strict';
import { indexBody } from '../design-system/layout.ts';
import type { RenderedTopic, RenderedDocument } from '../design-system/types.ts';

const headings = ['A Minimal Template', '2. The Second Layer', 'Phase 5 — Reconcile', 'Another idea', 'Baseline'];
const document = { file: 'README.md', id: 'doc', title: 'Doc', markdown: '', html: '', excerpts: new Map(), sha256: '',
  headings: headings.map((text, index) => ({ id: `h${index}`, text, level: 2, excerpt: '' })) } satisfies RenderedDocument;
const topic: RenderedTopic = { id: 'example', number: '01', title: 'Example', category: 'Practice', description: 'An article', thesis: 'An idea', documents: [{ file: 'README.md' }], rendered: [document], coverSVG: '', diagramSVG: '' };

test('the A–Z index sorts past leading numbers, phases and articles, keeping the authored text', () => {
  const html = indexBody([topic]);
  const order = [...html.matchAll(/<span class="index-text">(.*?)<\/span><span class="index-leader"/g)].map(match => match[1].replace(/<[^>]+>/g, ''));
  assert.deepEqual(order, ['Another idea', 'Baseline', 'A Minimal Template', 'Phase 5 — Reconcile', '2. The Second Layer']);
  assert.match(html, /<span class="index-skip">A <\/span>Minimal Template/);
  assert.match(html, /<span class="index-skip">2\. The <\/span>Second Layer/);
  // “Another” is a word, not the article “An”.
  assert.match(html, /<span class="index-text">Another idea<\/span>/);
});
