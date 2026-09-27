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

Author site tooling, tests, and browser behavior in TypeScript only; never use Python for maintenance commands or helpers. The topic’s existing Bash worktree tools remain Bash. Node.js 24 runs the tooling directly; `npm run typecheck` checks all authored TypeScript strictly. The build compiles `reader.ts` to embedded plain JavaScript, so readers need no compiler or network. Shared metadata and rendered-document types live in `design-system/types.ts`.

The collection name, when shown on two lines, must be “The Way I” / “AI”, without a trailing period. Never separate “I” from “The Way”. The second line is right-aligned to the first line, using an intrinsically sized heading. The newline in `topics/topics.json`’s `displayTitle` is authoritative; the generic layout renders each line as an unbreakable span and sizes it responsively. Other visible brand occurrences stay on one line. Check desktop and 320/390px layouts for alignment, extra lines, and horizontal overflow after title or typography edits.

Topic cards are native links covering the full card, named by their headings, with no nested interactive elements. Rendered pages contain no raw Markdown links. Use relative HTML navigation with explicit `index.html` filenames so both GitHub Pages and local `file://` navigation work; documentation's reading links instead point to the live Pages site.
