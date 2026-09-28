# The Way I AI · Design system

The shared presentation layer for a collection of source-owned topics. The **Folio** design pairs warm paper, dark ink, copper accents, Newsreader headings and prose, and DM Sans navigation. The homepage is an editorial reading list; topic pages have an optional collection sidebar and a section outline. The collection's display title pairs plum with teal through `--title-ink` and `--title-accent`, with lighter variants for dark mode. Font and code-renderer licenses are in `licenses/` and are embedded in the generated files.

## Responsibilities

- `theme.css`: shared tokens, typography, layouts, responsive behavior, dark mode, and print styles.
- `reader.ts`: collection/section search, navigation, code copying, theme controls, explorer selection, focus mode, and scroll-responsive header.
- `theme.ts`: pre-paint Light / Dark / System resolution, persistence, live system changes, and cross-tab updates.
- `search.ts`: creates the embedded collection-wide index from rendered prose and original code; result URLs remain relative.
- `layout.ts`: collection and reader layouts; receives all collection and topic copy from source metadata.
- `wordmark.ts`: validates the saved wave geometry and generates its scalable, static CSS projection.
- `explorers.ts`: a generic SVG-and-panels renderer. It resolves Markdown section/excerpt references and highlights named SVG nodes.

Topic-specific copy, diagram labels, SVG geometry, and explorer configuration belong in `topics/<id>/`, not here. Collection copy and topic order live in `topics/topics.json`. A new topic needs no changes to this directory unless it introduces a genuinely new reusable presentation component.

## Build contract

`scripts/build.ts` reads the registry, each topic's `topic.json`, Markdown, and assets. It renders Markdown with Marked, pre-renders code examples with Pierre, and embeds fonts, styles, behavior, and diagrams in standalone HTML. The code examples use declarative shadow DOM with a JavaScript fallback for older browsers. All narrative text is available without JavaScript.

Local Markdown images become data URLs. SVG sources used inline must be standalone, script-free, and free of external render dependencies. Assets can use the shared CSS variables, with fallback values for opening the SVG on its own.

See the root README for [build and verification commands](../README.md#editing-and-adding-topics) and [publication bundle usage](../README.md#github-pages). `npm run check` rejects stale output, invalid source references, broken links, duplicate IDs, and external render dependencies. Browser acceptance coverage is defined in [`tests/reader.spec.ts`](../tests/reader.spec.ts).

The only repository navigation link is the GitHub icon at the masthead's far right. The adjacent icon-only theme picker offers Light, Dark, and System, defaulting to System. Controls have accessible names and native keyboard behavior. Avoid promotional taglines or extra sidebar/footer links.

On topic pages, the collection sidebar is a native disclosure, collapsed by default on every navigation. Desktop grid columns animate its expansion/collapse; reduced-motion preferences disable transitions. There is no reading-progress indicator. Scrolling beyond 120px compacts the header; returning within 16px of the top restores it. The separate thresholds prevent layout-height changes from repeatedly retriggering the transition. Full text and native disclosures remain available without JavaScript.

The shared `.wordmark` renders the same live lettering and decorative wave in the collection title and every page's home link. Set `--wordmark-size` to resize it; all spacing, optical letter adjustments, and background coordinates follow that size. The home link has an accessible name and the decorative duplicate text is hidden from assistive technology.

The optional `titleBackground` and `titleBackgroundPosition` paths resolve relative to `topics/`. The latter is the version 1 JSON exported by the standalone wave editor, currently `topics/assets/title-wave-position.json`. Its four corners use the main title's font size as one `em`, measured from the title layout box's top-left. The generator converts that geometry to a CSS perspective transform, so both large and miniature versions match exactly without JavaScript or resize handlers. The original image is embedded once per HTML file and shared by all wordmark instances through CSS. Light/dark blending remains in `theme.css`, and both source assets are included in the publication bundle.

## Reuse

Copy this directory, `scripts/`, `tsconfig.json`, the build dependencies, and a source collection into another repository. Update `topics/topics.json` for collection identity and copy. Customize the shared CSS tokens for the visual style. Topic folders remain independently editable bundles of Markdown, metadata, and assets.

The complete topic authoring guide, including explorer bindings and Markdown excerpt markers, is in [AGENTS.md](../AGENTS.md).

Keep semantic headings, visible focus, native links/buttons, bounded reading widths, reduced-motion support, and keyboard-operable interactions. Verify desktop and narrow layouts in both themes after changing presentation. Print styles reveal explorer panels and suppress navigation controls.

## Language and collection title rules

Follow [AGENTS.md’s language, collection title, and card rules](../AGENTS.md#language-and-collection-title-rules) and [publishing and link-authoring contract](../AGENTS.md#building-and-publishing). The root README explains [hosted and local reading](../README.md#reading-locally).
