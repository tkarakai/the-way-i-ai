import type { RenderedTopic, RenderedDocument, SourceReference, HeadingReference } from './types.ts';
import { escape } from './layout.ts';

// Topic-specific content belongs to topic.json, Markdown, and SVG sources.
// This renderer only binds those sources to shared presentation components.
export function explorerFor(topic: RenderedTopic, documents: RenderedDocument[]) {
  const config = topic.explorer;
  if (!config) return '';
  const seen = new Set();
  const panels = config.panels.map((panel, index) => {
    if (!/^[a-z][a-z0-9-]*$/.test(panel.id) || seen.has(panel.id)) throw new Error(`${topic.id}: invalid or duplicate panel id ${panel.id}`);
    seen.add(panel.id);
    const findDocument = (reference: SourceReference) => {
      const doc = documents.find(doc => doc.file === reference.document);
      if (!doc) throw new Error(`${topic.id}: explorer references missing document ${reference.document}`);
      return doc;
    };
    const findHeading = (reference: HeadingReference) => {
      const matches = findDocument(reference).headings.filter(heading => heading.text === reference.heading);
      if (matches.length !== 1) throw new Error(`${topic.id}: explorer heading must match exactly once: ${reference.heading}`);
      return matches[0];
    };
    let html, title, target;
    if ('excerpt' in panel.source) {
      html = findDocument(panel.source).excerpts.get(panel.source.excerpt);
      if (!html) throw new Error(`${topic.id}: missing Markdown excerpt ${panel.source.excerpt}`);
      if (!panel.label || !panel.context) throw new Error(`${topic.id}: named excerpts need a label and context heading`);
      title = panel.label;
      target = findHeading(panel.context);
    } else {
      target = findHeading(panel.source);
      html = target.excerpt;
      title = panel.label || target.text;
      if (panel.context) target = findHeading(panel.context);
    }
    const prefix = `explorer-${panel.id}-`;
    html = html.replace(/(id|data-copy)="([^"]+)"/g, `$1="${prefix}$2"`).replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`);
    return { ...panel, title, html, target: target.id, index };
  });
  if (!panels.length) throw new Error(`${topic.id}: an explorer must have at least one panel`);
  if (!['labels', 'numbered'].includes(config.controls)) throw new Error(`${topic.id}: explorer controls must be labels or numbered`);
  let diagram = topic.diagramSVG;
  const highlights = new Map<string, string[]>();
  for (const panel of panels) for (const nodeId of panel.highlight || []) {
    if (!diagram.includes(`id="${nodeId}"`)) throw new Error(`${topic.id}: missing SVG node ${nodeId}`);
    highlights.set(nodeId, [...(highlights.get(nodeId) || []), panel.id]);
  }
  for (const [nodeId, keys] of highlights) diagram = diagram.replace(`id="${nodeId}"`, `id="${nodeId}" data-node="${keys.join(' ')}"`);
  return `<section class="explorer" data-explorer aria-labelledby="explorer-title"><div class="explorer-head"><h2 id="explorer-title">${escape(config.title)}</h2><p>${escape(config.instruction)}</p></div><div class="explorer-grid"><div class="explorer-figure"><figure>${diagram}<figcaption>${escape(config.caption)}</figcaption></figure></div><div class="explorer-detail"><div class="explorer-controls js-only" role="group" aria-label="Explore this topic">${panels.map(panel => `<button data-select="${panel.id}" aria-controls="explorer-panel-${panel.id}" aria-pressed="${panel.index === 0}" aria-label="${escape(panel.title)}">${escape(config.controls === 'numbered' ? panel.index + 1 : panel.title)}</button>`).join('')}</div>${panels.map(panel => `<section class="explorer-panel" id="explorer-panel-${panel.id}" data-panel="${panel.id}" tabindex="-1"><h3>${escape(panel.title)}</h3><div class="excerpt">${panel.html}</div><a class="text-link" href="#${panel.target}">Read in context →</a></section>`).join('')}</div></div></section>`;
}
