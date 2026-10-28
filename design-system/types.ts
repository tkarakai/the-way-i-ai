/** Source metadata shared by the generator and generic presentation layer. */
export interface Collection {
  title: string;
  displayTitle: string;
  titleBackground?: string;
  titleBackgroundPosition?: string;
  repositoryUrl?: string;
  siteUrl: string;
  author: { name: string; url: string };
  description: string;
  eyebrow: string;
  subtitle: string;
  introduction: string[];
  introductionAccent?: string;
  ambientBackground?: 'F';
  ambientIntensity?: number;
  topics: string[];
}
export interface SourceDocument { file: string }
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
  category: string;
  description: string;
  thesis: string;
  created?: string;
  updated?: string;
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
  title: string;
  id: string;
  number: string;
  /** `thumbnail` is a small data URL of the portrait for navigation to this topic from other pages. */
  illustrations?: { homepage: string; hero: string; species?: Species; thumbnail?: string };
  coverSVG: string;
  diagramSVG: string;
  rendered: RenderedDocument[];
}
/** A wildlife manifest species, split into an optional common name and binomial. */
export interface Species { common?: string; latin: string }
/** A site page from `pages/`, such as About or the 404 page: a title, a derived description and authored chapters. */
export interface RenderedPage { id: string; title: string; description: string; html: string; headings: Heading[] }
/** A site page link: `id` is its folder, so `about` links to `about/index.html`. */
export interface PageLink { id: string; title: string; description: string }
/** A site page from `pages/`, such as About or the 404 page: its title, a description derived from its first paragraph, and authored chapters. */
export interface RenderedPage { id: string; title: string; description: string; html: string; headings: Heading[] }
/** A footer link to a site page; `id` is its folder, so `about` links to `about/index.html`. */
export interface PageLink { id: string; title: string; description: string }
export interface SearchEntry { title: string; topic: string; href: string; text: string }
export interface ShellOptions {
  /** Page title; omitted on the home page, whose title is the collection name alone. */
  title?: string; description: string; body: string; css: string; js: string;
  themeJS: string; search: SearchEntry[];
  fonts: string; collection: Collection; topics: RenderedTopic[]; prefix?: string; page?: string;
  wordmarkBackground?: boolean; created?: string; updated?: string;
  headMetadata?: string;
  /** Site pages linked from every footer. */
  sitePages?: PageLink[];
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
