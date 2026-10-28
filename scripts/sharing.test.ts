import test from 'node:test';
import assert from 'node:assert/strict';
import { sharingCard } from './sharing.ts';
import type { SharingSources } from './sharing.ts';
import type { RenderedTopic } from '../design-system/types.ts';

const sources: SharingSources = {
  collection: { title: 'A collection', displayTitle: 'the way I\nAI', description: 'Source description', eyebrow: 'A collection of ideas', subtitle: '', introduction: [], topics: ['example'], siteUrl: 'https://example.com/', author: { name: 'writer', url: 'https://github.com/writer' } },
  fonts: '/* embedded fonts */', css: '/* shared wordmark */', sharingCSS: '/* approved card layout */', wordmarkBackground: false
};
const topic: RenderedTopic = { id: 'example', number: '01', title: 'Authored <title>', category: 'Practice', description: 'An article', thesis: 'An idea', documents: [{ file: 'README.md' }], rendered: [], coverSVG: '', diagramSVG: '' };

test('sharing cards use source copy, shared wordmark, and stable source-addressed paths', () => {
  const home = sharingCard(sources);
  assert.match(home.path, /^assets\/sharing\/collection-[a-f0-9]{20}\.jpg$/);
  assert.equal(home.path, sharingCard(sources).path);
  assert.ok(home.html.includes(sources.collection.description));
  assert.match(home.html, /class="title-initial">A/);
  const card = sharingCard(sources, topic);
  assert.match(card.path, /^assets\/sharing\/example-[a-f0-9]{20}\.jpg$/);
  assert.ok(card.html.includes('Authored &lt;title&gt;'));
  assert.match(card.html, /no-artwork/);
  assert.equal(card.alt, topic.title);
  assert.deepEqual([card.width, card.height], [1200, 630]);
  assert.notEqual(card.path, sharingCard(sources, { ...topic, title: 'Changed title' }).path);
  assert.notEqual(home.path, sharingCard({ ...sources, sharingCSS: 'changed layout' }).path);
  assert.notEqual(home.path, sharingCard({ ...sources, fonts: 'changed fonts' }).path);
});

test('portrait cards preserve existing artwork and species without cropping or duplicate prose', () => {
  const artwork = '<img src="data:image/png;base64,example" alt="">';
  const card = sharingCard(sources, { ...topic, illustrations: { homepage: artwork, hero: artwork, species: { latin: 'Vulpes vulpes', common: 'Red fox' } } });
  assert.ok(card.html.includes(artwork));
  assert.ok(card.html.includes('Vulpes vulpes · Red fox'));
  assert.doesNotMatch(card.html, /no-artwork/);
  assert.equal((card.html.match(/Authored &lt;title&gt;/g) ?? []).length, 2, 'Document title and single visible heading');
  assert.notEqual(card.path, sharingCard(sources, topic).path);
});
