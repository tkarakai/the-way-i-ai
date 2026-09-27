# The Way I AI · Design system

The shared presentation layer for a collection of source-owned topics. Warm paper, dark ink, forest green, Newsreader headings, and DM Sans text define the editorial style. Font and code-renderer licenses are in `licenses/` and are embedded in the generated files.

## Responsibilities

- `theme.css`: shared tokens, typography, layouts, responsive behavior, dark mode, and print styles.
- `reader.ts`: generic section search, navigation, progress, code copying, theme switching, and explorer selection.
- `layout.ts`: collection and reader layouts; receives all collection and topic copy from source metadata.
- `explorers.ts`: a generic SVG-and-panels renderer. It resolves Markdown section/excerpt references and highlights named SVG nodes.

Topic-specific copy, diagram labels, SVG geometry, and explorer configuration belong in `topics/<id>/`, not here. Collection copy and topic order live in `topics/topics.json`. A new topic needs no changes to this directory unless it introduces a genuinely new reusable presentation component.

## Build contract

`scripts/build.ts` reads the registry, each topic's `topic.json`, Markdown, and assets. It renders Markdown with Marked, pre-renders code examples with Pierre, and embeds fonts, styles, behavior, and diagrams in standalone HTML. The code examples use declarative shadow DOM with a JavaScript fallback for older browsers. All narrative text is available without JavaScript.

Local Markdown images become data URLs. SVG sources used inline must be standalone, script-free, and free of external render dependencies. Assets can use the shared CSS variables, with fallback values for opening the SVG on its own.

`npm run build` updates the checked-in HTML. `npm run check` rejects stale output, invalid source references, broken links, duplicate IDs, and external render dependencies. `npm test` checks the generator's source/output contract. `npm run build:site` creates an ignored `_site/` bundle for publication using the same generator.

## Reuse

Copy this directory, `scripts/`, `tsconfig.json`, the build dependencies, and a source collection into another repository. Update `topics/topics.json` for collection identity and copy. Customize the shared CSS tokens for the visual style. Topic folders remain independently editable bundles of Markdown, metadata, and assets.

The complete topic authoring guide, including explorer bindings and Markdown excerpt markers, is in [AGENTS.md](../AGENTS.md).

Keep semantic headings, visible focus, native links/buttons, bounded reading widths, reduced-motion support, and keyboard-operable interactions. Verify desktop and narrow layouts in both themes after changing presentation. Print styles reveal explorer panels and suppress navigation controls.

## Language and collection title rules

Follow [AGENTS.md’s language, collection title, and card rules](../AGENTS.md#language-and-collection-title-rules) and [publishing and link-authoring contract](../AGENTS.md#building-and-publishing). The root README explains [hosted and local reading](../README.md#reading-locally).
