# Maintaining The Way I AI

This is the primary guide for agents maintaining the collection: its ideas, source documents, supporting assets, HTML presentation, and generator. `CLAUDE.md` points here; keep instructions in this file rather than duplicating them.

## What this repository is

A collection of related ideas about working with AI, published through a small static-site generator. Each topic is an independently understandable source bundle. Markdown and authored assets are authoritative; HTML is reproducible presentation output.

The same generated HTML works as downloaded standalone files and as a GitHub Pages site. Do not introduce runtime services or external rendering dependencies.

## Source ownership

| Source | Owns |
| --- | --- |
| `topics/topics.json` | Collection copy and topic order; IDs correspond to folders. |
| `topics/assets/` | Authored collection visuals, including the optional title background. |
| `topics/<id>/README.md` and other Markdown | The full argument, explanations, examples, and named excerpts. |
| `topics/<id>/topic.json` | Topic metadata, document order, and optional visual explorer bindings. |
| `topics/<id>/assets/` | Authored diagrams, images, data, and other topic-specific visual content. |
| Topic-local scripts and examples | Supporting tools that belong to the idea. |
| `design-system/` | Shared visual language, generic components, layout, and browser behavior. |
| `scripts/` | Building, checking, and packaging the collection. |
| `index.html`, `topics/*/index.html` | Generated output. Never edit directly. |
| `_site/` | Ignored, generated publication bundle. Never author here. |

Diagrams communicate content through their labels and relationships. Keep their source with the topic, not inside a shared template. The design system may define generic UI text such as “Contents” or “Copy”; it must not contain topic-specific prose, labels, or illustrations, or branch on topic IDs.

## Maintaining existing topics

1. Read the topic's Markdown, `topic.json`, and relevant assets before changing it.
2. Preserve the author's meaning, qualifications, examples, and context. Do not silently summarize the HTML edition or introduce new claims only in a diagram.
3. Make substantive edits in Markdown or topic-local assets. Change shared styling and interaction behavior in `design-system/`.
4. If a visual excerpt already exists in Markdown, reference it; do not maintain a second prose copy in JSON or JavaScript.
5. Rebuild and check. Inspect changed visual content in a browser at desktop and narrow widths, in light and dark modes. Verify relevant interactions and content completeness.
6. Commit generated HTML alongside its changed sources when asked to commit. Keep the build deterministic.

The existing worktree shell tools now live in `topics/worktrees/`. Installation examples must use that location.

## Adding a topic

Create `topics/<descriptive-kebab-case-id>/` with a `README.md` beginning with one `#` title. Use `##` for chapters and `###` for subsections when authoring new documents.

Add a `topic.json` alongside it:

```json
{
  "title": "A useful new idea",
  "category": "A relevant category",
  "description": "A short introduction for the contents page and topic header.",
  "thesis": "The central idea in one sentence.",
  "documents": [
    { "file": "README.md", "label": "The idea", "headingOffset": 0 }
  ]
}
```

Add the folder ID to the `topics` array in `topics/topics.json`, in the desired order. Numbers are derived from order; do not hardcode them in topic metadata. Multiple documents can be listed in reading order. `headingOffset: 1` supports existing documents whose chapters use `#`; new documents should use ordinary nested headings with offset `0`.

A plain Markdown topic is enough to build. Do not edit the generator or shared templates to register it. Add optional `cover` and `explorer` sources only when they help explain the idea. Update the root README's human-readable topic list.

Then run:

```sh
npm ci              # First checkout, or after the lockfile changes
npm run typecheck   # Strict TypeScript checking
npm run build       # Regenerate root and topic HTML files
npm run check       # Detect stale output, broken links and invalid references
npm test            # Generator, search, and theme contract checks
npx playwright install chromium # First checkout: browser test engine
npm run test:browser # Offline, responsive, keyboard, and interaction checks
```

Open `index.html` and the new topic's `index.html` directly in a browser. Check the title, full text, navigation, code examples, keyboard interaction, narrow layout, and offline behavior.

## Authoring visual sources

Use plain Markdown plus ordinary asset files rather than embedding an application framework in the documents. A topic remains readable and editable on GitHub without running the generator.

- **Images:** put the file in `assets/` and reference it with standard Markdown, for example `![A description](assets/diagram.svg)`. Local images are embedded in the HTML at build time. Download remote images first; do not introduce runtime network dependencies.
- **Diagrams:** author standalone SVG in `assets/`. Include a `viewBox`, accessible title/description, stable node IDs, and local styles with fallback colors. Shared CSS variables can theme the inline version. Keep scripts and external references out of SVG files.
- **Structured data:** use JSON or CSV in `assets/` when the data itself is the source. The current generator supports images and the explorer component; additional visual forms need a generic renderer before use. Do not imply arbitrary assets automatically become interactive.
- **Cover:** set `"cover": "assets/cover.svg"` in `topic.json`. It is optional.
- **Explorer:** configure `explorer` in `topic.json`. This uses a generic SVG-and-panels component; it is not topic-specific JavaScript. See the existing topics for full examples.

An explorer has `title`, `instruction`, `diagram`, `caption`, `controls` (`"labels"` or `"numbered"`), and a nonempty `panels` array. Each panel has a stable `id`, a `source` reference, and optional SVG node IDs in `highlight`. A section reference is:

```json
{
  "id": "create",
  "source": { "document": "WORKFLOW.md", "heading": "1. Create a worktree" },
  "highlight": ["workflow-create"]
}
```

The renderer takes the section text from Markdown and links back to it. Headings must match exactly once; if you rename one, update the binding. Missing or ambiguous references fail the build rather than silently dropping content.

For a concise excerpt from within a larger section, wrap visible prose in invisible Markdown comments:

```md
<!-- excerpt:core-idea -->
This paragraph remains part of the full document and is also used in the explorer.
<!-- /excerpt:core-idea -->
```

Inside a blockquote, prefix the comments with `>`, just like the surrounding lines. Use excerpt markers around complete paragraphs or blocks, not half an inline phrase. Do not nest excerpts or reuse names within a document.

Reference that excerpt and specify its context link:

```json
{
  "id": "core",
  "label": "The core idea",
  "source": { "document": "README.md", "excerpt": "core-idea" },
  "context": { "document": "README.md", "heading": "The underlying idea" },
  "highlight": ["core-node"]
}
```

The excerpt is not hidden content. It remains visible in the Markdown document and the full HTML reader; the explorer reuses it. Short display labels, diagram geometry, and bindings live in topic metadata/assets. Substantive prose lives in Markdown.

## Building and publishing

`package.json` defines the build/check commands and development dependencies: Markdown parsing, code rendering, and font sources. `package-lock.json` pins the dependency tree for reproducible builds. Neither is needed to read the generated pages.

`npm run build:site` creates a clean `_site/` bundle for GitHub Pages. This uses the same generator and presentation as the checked-in standalone files. Keep all navigation relative so it works under a repository subpath and through `file://`.

Use `npm run preview` to build and serve the current branch locally. After edits, rebuild with `npm run build:site` and refresh. PR builds upload a complete downloadable preview artifact, linked from the Actions run summary. Preview builds must not deploy the main Pages site.

The Pages workflow checks the source/output contract, builds the publication bundle, and deploys on the default branch or manual dispatch. The custom domain is https://thewayiai.com/. Documentation should lead readers to this rendered site, with a prominent link at the very top of the root README. Use absolute https://thewayiai.com/ URLs for interactive-edition links in Markdown, since GitHub's file viewer displays HTML source. Keep navigation inside HTML relative with explicit `index.html` filenames so the downloaded folder also works through `file://`. Do not include raw Markdown links in rendered pages. Local builds do not publish the current branch.

## Worktree tool constraints

- Shell scripts are sourced so `cd` affects the caller. Preserve bash/zsh compatibility and the sourced/direct-execution return pattern.
- Worktrees live under `~/.worktrees/<project-name>/`; branch and directory names match.
- The per-project `.counter` supplies three-digit prefixes; custom names are sanitized and truncated to 50 characters.
- The new script resolves the done script relative to itself. Keep the pair together.
- Cleanup summarizes uncommitted/unpushed work, ignored files, and matching processes. Process termination and deletion have separate confirmations.
- Avoid bash 4+ features; these scripts are used from macOS shells.

## Language and collection title rules

Author site tooling, tests, and browser behavior in TypeScript only; never use Python for maintenance commands or helpers. The topic’s existing Bash worktree tools remain Bash. Node.js 24 runs the tooling directly; `npm run typecheck` checks all authored TypeScript strictly. The build compiles `reader.ts` to embedded plain JavaScript, so readers need no compiler or network. Shared metadata and rendered-document types live in `design-system/types.ts`.

The collection name, when shown on two lines, must be “the way I” / “AI”, without a trailing period. Never separate “I” from “the way”. Render “the” at half the main title's font size. Align the second line's right edge with the first line's right edge. Both diagonal stems must continue across the lines: the “A”'s left stem aligns with the “y”'s right stem, and its right stem aligns with the “y”'s left stem. A small optical width/angle adjustment to the “A” achieves this; keep both “I”s vertical and allow them to join. Scale letter spacing and optical offsets with the font size to preserve this alignment. The newline in `topics/topics.json`’s `displayTitle` is authoritative; the generic layout renders each line as an unbreakable span, styles the first word of the first line as a smaller prefix, wraps the last line's initial for optical alignment, and sizes it responsively. The same two-line wordmark appears in the masthead; other visible brand occurrences stay on one line. Check desktop and 320/390px layouts for alignment, extra lines, and horizontal overflow after title or typography edits.

The `.wordmark` component is shared by the large collection title and the miniature home link in every page's masthead. Resize it through `--wordmark-size`; do not recreate the lettering or reintroduce the asterisk. Other brand mentions, such as the footer, remain on one line.

The optional `titleBackground` in `topics/topics.json` references a local image relative to `topics/`. Keep its source in `topics/assets/`; the generator embeds one copy per HTML file, shared by that page's wordmarks. The optional `titleBackgroundPosition` references the wave editor's JSON export, currently `assets/title-wave-position.json`. Preserve its exact corner coordinates in title-relative em units. The generator produces a static CSS projection, so the wave and letters scale together without JavaScript or separate mobile offsets. Preserve offline rendering and verify both themes at large and miniature sizes.

The production presentation is Folio: an editorial reading list, serif prose, and quiet navigation. Keep the approved wordmark unchanged. There is one repository link in the site chrome, a GitHub icon at the masthead's far right; no promotional taglines or extra sidebar/footer repository links. The icon-only theme button switches immediately to the opposite resolved theme, with an accessible action name and the destination icon (moon for Dark, sun for Light); do not use a popup. System is the default and follows live device changes. Manual choices expire after two hours without scrolling, typing, or navigation. Persist activity across pages/tabs, expire stale choices before first paint, and check elapsed time when a sleeping or cached page resumes. Topic collection sidebars start collapsed until changed, then remember their state in browser storage; they animate when expanded/collapsed, honoring reduced motion. Preserve the outline order, masthead placement, and synchronized sidebar motion documented in the [design-system guide](design-system/README.md). Do not reintroduce reading progress. Topic headers compact while scrolling and restore at the top; keep hysteresis between thresholds to avoid scroll/layout oscillation.

Each collection topic card is one native link covering the entire card, with its heading as the accessible name. Preserve keyboard activation, visible focus, and open-in-new-tab behavior; do not nest links or simulate a link with click handlers.
