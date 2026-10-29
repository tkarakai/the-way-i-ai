import test from 'node:test';
import assert from 'node:assert/strict';
import { publishableMarkdown, topicMarkdown, securityTxt } from './agents.ts';
import type { Collection, RenderedTopic } from '../design-system/types.ts';

const collection: Collection = {title:'Notes',displayTitle:'Notes',description:'Ideas',eyebrow:'',subtitle:'',introduction:[],topics:['example'],siteUrl:'https://example.com/blog/',author:{name:'writer',url:'https://github.com/writer'},repositoryUrl:'https://github.com/writer/notes'};
test('agent Markdown makes actual links absolute while preserving inline and fenced code byte for byte', () => {
  const code = '`[Link](other.md)`\n\n```md\n[Link](other.md)\n<!-- excerpt:literal -->\n```';
  const text = `<!-- excerpt:idea -->\n[Link](other.md) and [Ref][r].\n\n![Image](image.png)\n\n[r]: other.md\n\n${code}\n<!-- /excerpt:idea -->`;
  const result = publishableMarkdown(text, 'https://example.com/blog/topics/example/README.md', new Map([['https://example.com/blog/topics/example/image.png','https://example.com/blog/assets/image.webp']]));
  assert.match(result, /\[Link\]\(<https:\/\/example.com\/blog\/topics\/example\/other.md>\)/);
  assert.match(result, /\[Ref\]\(<https:\/\/example.com\/blog\/topics\/example\/other.md>\)/);
  assert.match(result, /!\[Image\]\(<https:\/\/example.com\/blog\/assets\/image.webp>\)/);
  assert.ok(result.includes(code));
  assert.ok(!result.includes('excerpt:idea'));
});

test('multipart Markdown includes all documents, strips YAML with Windows newlines, and uses source identity', () => {
  const doc = (file: string, markdown: string) => ({file,id:file,title:file,markdown,html:'',headings:[],excerpts:new Map<string,string>(),sha256:''});
  const topic: RenderedTopic = {id:'example',number:'01',title:'Example',category:'Practice',description:'Description',thesis:'Thesis',documents:[{file:'README.md'},{file:'WORKFLOW.md'}],coverSVG:'',diagramSVG:'',rendered:[doc('README.md','---\r\ncategory: Practice\r\n---\r\n\r\n# Example\r\n\r\n## Intro\r\n\r\nComplete main text.\r\n'),doc('WORKFLOW.md','# Workflow\n\nComplete companion text.\n')]};
  const result=topicMarkdown(collection,topic,new Map());
  assert.ok(!result.includes('category: Practice'));
  assert.equal((result.match(/^# Example$/gm) ?? []).length,1);
  assert.match(result, /Complete main text/); assert.match(result, /# Workflow\n\nComplete companion text/);
});

test('security discovery directs contact and policy to the repository Security page', () => {
  const text=securityTxt(collection,{version:'test',built:'2026-10-29T00:00:00Z'});
  assert.match(text,/Contact: https:\/\/github.com\/writer\/notes\/security\n/);
  assert.match(text,/Policy: https:\/\/github.com\/writer\/notes\/security\n/);
  assert.doesNotMatch(text,/advisories\/new/);
  assert.match(text,/Canonical: https:\/\/example.com\/blog\/\.well-known\/security.txt/);
});
