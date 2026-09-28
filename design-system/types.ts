/** Source metadata shared by the generator and generic presentation layer. */
export interface Collection {
  title: string;
  displayTitle: string;
  titleBackground?: string;
  titleBackgroundPosition?: string;
  repositoryUrl?: string;
  description: string;
  eyebrow: string;
  subtitle: string;
  introduction: string[];
  topics: string[];
}
export interface SourceDocument { file: string; label: string; headingOffset?: number }
export interface HeadingReference { document: string; heading: string }
export type SourceReference = HeadingReference | { document: string; excerpt: string };
export interface ExplorerPanel {
  id: string;
  label?: string;
  source: SourceReference;
  context?: HeadingReference;
  highlight?: string[];
}
export interface Topic {
  title: string;
  category: string;
  description: string;
  thesis: string;
  documents: SourceDocument[];
  cover?: string;
  explorer?: {
    title: string;
    instruction: string;
    diagram: string;
    caption: string;
    controls: 'labels' | 'numbered';
    panels: ExplorerPanel[];
  };
}
export interface Heading { id: string; text: string; level: number; excerpt: string }
export interface RenderedDocument extends SourceDocument {
  id: string;
  title: string;
  markdown: string;
  html: string;
  headings: Heading[];
  excerpts: Map<string, string>;
  sha256: string;
}
export interface RenderedTopic extends Topic {
  id: string;
  number: string;
  coverSVG: string;
  diagramSVG: string;
  rendered: RenderedDocument[];
  minutes: number;
}
export interface SearchEntry { title: string; topic: string; href: string; text: string }
export interface ShellOptions {
  title: string; description: string; body: string; css: string; js: string;
  themeJS: string; search: SearchEntry[];
  fonts: string; collection: Collection; prefix?: string; page?: string;
  wordmarkBackground?: boolean;
}
export interface WavePosition {
  version: 1;
  source: string;
  mapping: 'projective';
  units: 'em of the main title font size';
  origin: 'top-left of the two-line title layout box';
  cornerOrder: ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
  corners: Record<'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft', { x: number; y: number }>;
}
