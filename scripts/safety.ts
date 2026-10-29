import type { Token } from 'marked';
import { DOMParser } from '@xmldom/xmldom';
import { decodeHTMLAttribute } from 'entities';

/** Author prose as Markdown; active HTML is never a content format. */
export function assertSafeMarkdown(token: Token, file: string): void {
  if (token.type === 'html' && !/^\s*(?:<!--(?:(?!-->)[\s\S])*-->\s*)+$/.test(token.raw)) {
    throw new Error(`${file}: raw HTML is not allowed in Markdown; use Markdown syntax instead: ${token.raw.trim().slice(0, 80)}`);
  }
  if (token.type === 'link' || token.type === 'image') {
    const href = decodeHTMLAttribute(token.href).trim();
    // Browsers strip control characters before interpreting a scheme. Reject them,
    // backslashes and protocol-relative addresses rather than guessing intent.
    if (/[\u0000-\u0020\u007f\\]/.test(href) || href.startsWith('//')
      || (/^[^/?#]*:/.test(href) && !/^(?:https?:\/\/|mailto:)/i.test(href))) {
      throw new Error(`${file}: unsupported ${token.type} address: ${token.href.slice(0, 80)}`);
    }
  }
}

const elements = new Set('svg g path circle ellipse line polyline polygon rect text tspan textPath title desc defs style linearGradient radialGradient stop clipPath mask pattern marker symbol use filter feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence'.split(' '));

/** Parse XML before inlining it. Only inert SVG drawing elements and local references survive. */
export function assertSafeSVG(source: string, file: string): void {
  const fail = () => { throw new Error(`${file}: SVG must be self-contained and script-free`); };
  const css = (value: string) => {
    if (/[\\@]|expression\s*\(|(?:javascript|vbscript)\s*:|(?:behavior|-moz-binding)\s*:/i.test(value)
      || /url\(\s*(?!['"]?#[\w:.-]+['"]?\s*\))/i.test(value)) fail();
  };
  // Refuse declarations before parsing, so entities and external subsets never resolve.
  if (/<!DOCTYPE|<!ENTITY|<\?/i.test(source)) fail();
  const document = new DOMParser({ onError: fail }).parseFromString(source, 'image/svg+xml');
  if (document.documentElement?.localName !== 'svg') fail();
  for (const tag of Array.from(document.getElementsByTagName('*'))) {
    if (!elements.has(tag.localName ?? '') || tag.prefix || (tag.namespaceURI && tag.namespaceURI !== 'http://www.w3.org/2000/svg')) fail();
    for (const attribute of Array.from(tag.attributes)) {
      if (/^on/i.test(attribute.localName ?? '') || attribute.localName === 'base') fail();
      if (attribute.localName === 'href' || attribute.localName === 'src') {
        if (!/^#[\w:.-]+$/.test(attribute.value)) fail();
      }
      if (attribute.localName === 'style' || /url\(/i.test(attribute.value)) css(attribute.value);
    }
    if (tag.localName === 'style') css(tag.textContent ?? '');
  }
}
