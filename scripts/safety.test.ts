import test from 'node:test';
import assert from 'node:assert/strict';
import { Marked } from 'marked';
import { assertSafeMarkdown, assertSafeSVG } from './safety.ts';

const markdown = (source: string) => new Marked({ walkTokens: token => assertSafeMarkdown(token, 'example.md') }).parse(source);
test('Markdown rejects active HTML and disguised script URLs, preserving comments and literal code', () => {
  for (const source of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<iframe src="https://example.com"></iframe>', '<!-- safe --><script>alert(1)</script><!-- safe -->', '[x](javascript:alert%281%29)', '[x](jav&#x61;script:alert%281%29)', '[x](java&#9;script:alert%281%29)', '[x](data:text/html,hello)', '[x](//remote.example/x)']) assert.throws(() => markdown(source), /raw HTML|unsupported/, source);
  assert.doesNotThrow(() => markdown('<!-- excerpt:idea -->\nSafe **prose** [here](https://example.com/).\n<!-- /excerpt:idea -->\n\n```html\n<script>alert(1)</script>\n```\n\n`<img src=x onerror=alert(1)>`'));
});

test('SVG validation parses attributes and namespaces and denies scripts, animation, external resources and entities', () => {
  const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`;
  assert.doesNotThrow(() => assertSafeSVG(svg('<defs><linearGradient id="ink"><stop stop-color="red"/></linearGradient></defs><style>.line{fill:url(#ink)}</style><path id="line" class="line" d="M0 0L10 10"/>'), 'example.svg'));
  for (const body of ['<script>alert(1)</script>', '<foreignObject><p>HTML</p></foreignObject>', '<rect onload="alert(1)"/>', '<use href="javascript:alert(1)"/>', '<use href="&#106;avascript:alert(1)"/>', '<use href="//example.com/image.svg"/>', '<use href=unquoted/>', '<set attributeName="href" to="javascript:alert(1)"/>', '<style>@import "https://example.com/a.css";</style>', '<style>.x{fill:url(https://example.com/x)}</style>', '<style>.x{fill:u\\72l(https://example.com/x)}</style>', '<html:script xmlns:html="http://www.w3.org/1999/xhtml"/>']) assert.throws(() => assertSafeSVG(svg(body), 'example.svg'), /self-contained and script-free/, body);
  assert.throws(() => assertSafeSVG('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>'+svg('<text>&x;</text>'), 'example.svg'));
});
