# Maintaining The Way I AI

This is the primary guide for agents maintaining the collection: its ideas, source documents, supporting assets, HTML presentation, and generator. `CLAUDE.md` points here; keep instructions in this file rather than duplicating them.

## What this repository is

A collection of related ideas about working with AI, published through a small static-site generator. Each topic is an independently understandable source bundle. Markdown and authored assets are authoritative; HTML is reproducible presentation output.

The same generated HTML works as downloaded standalone files and as a GitHub Pages site. Do not introduce runtime services or external rendering dependencies.

## Source ownership

| Source | Owns |
| --- | --- |
| `topics/topics.json` | Collection copy, canonical publication base (`siteUrl`), author identity (`author.name` and `author.url`), and canonical topic order; IDs correspond to folders. The homepage displays this order in reverse. In `introduction`, `[first|second|third]` renders rotating phrases in a secondary highlight colour, in order and looping (the first phrase is the static fallback; screen readers get the full list once). |
| `topics/assets/` | Authored collection visuals, including the optional title background. |
| `topics/<id>/README.md` | YAML front matter owns topic metadata, optional document order, cover, and explorer bindings. Its single `#` heading owns the topic title. The body owns the argument and named excerpts. |
| Other topic Markdown | Companion documents or supporting notes. Listed documents are rendered in full, in reading order. |
| `topics/<id>/assets/` | Authored diagrams, images, data, and other topic-specific visual content. |
| Topic-local scripts and examples | Supporting tools that belong to the idea. |
| `pages/about.md`, `pages/privacy.md`, `pages/licensing.md`, `pages/404.md` | Site pages, rendered in both designs. Each has one `#` title, an opening paragraph (reused as its description), and `##` chapters that form its outline; no front matter or images. Absolute `siteUrl` links become relative. The footer links the A–Z index, then About, Privacy and Licensing in that order (labels come from the file names). |
| `design-system/` | Shared visual language, generic components, layout, and browser behavior. |
| `scripts/` | Building, checking, and packaging the collection. |
| `index.html`, `topics/*/index.html`, `general-index/index.html`, `about/`, `privacy/`, `licensing/`, `404.html` | Generated output. Never edit directly. GitHub Pages serves the root `404.html` for any missing path, so only that page uses root-relative links; it is `noindex` and stays out of the sitemap. |
| `robots.txt` | Authored crawl rules and the published sitemap reference. Copied into the publication bundle. |
| `sitemap.xml` | Generated published-page inventory. Never edit directly. |
| `feed.xml` | Generated RSS 2.0 summaries feed. Never edit directly. |
| Root `favicon*` and `apple-touch-icon.png` | Reproducible copies of approved files in `design-system/assets/favicon/`. Never edit the root copies directly. |
| `_site/` | Ignored, generated publication bundle. Never author here. |

Diagrams communicate content through their labels and relationships. Keep their source with the topic, not inside a shared template. The design system may define generic UI text such as “Contents” or “Copy”; it must not contain topic-specific prose, labels, or illustrations, or branch on topic IDs.

## Maintaining existing topics

1. Read the main README's front matter, all listed Markdown documents, and relevant assets before changing a topic.
2. Preserve the author's meaning, qualifications, examples, and context. Do not silently summarize the HTML edition or introduce new claims only in a diagram.
3. Make substantive edits in Markdown or topic-local assets. Change shared styling and interaction behavior in `design-system/`.
4. If a visual excerpt already exists in Markdown, reference it; do not maintain a second prose copy in JSON or JavaScript.
5. Rebuild and check. Inspect changed visual content in a browser at desktop and narrow widths, in light and dark modes. Verify relevant interactions and content completeness.
6. Commit generated HTML alongside its changed sources when asked to commit. Keep the build deterministic.

The existing worktree shell tools now live in `topics/worktrees/`. Installation examples must use that location.

## Adding a topic

Create `topics/<descriptive-kebab-case-id>/README.md`. Every topic uses the same Markdown-and-front-matter format; there are no special presentation modes or separate `topic.json` files:

```md
---
category: A relevant category
description: >-
  A concise description for the collection card, page header, and search metadata.
thesis: The central idea in one sentence.
---

# A useful new idea

## Introduction

Establish the subject, the problem, and why the idea matters.

## A substantive chapter

The full argument belongs here.

### A subsection

Supporting explanation, evidence, or examples.
```

Required front-matter fields are nonempty `category`, `description`, and `thesis` strings. Keep `description` to 155 characters or fewer (the build enforces this): collection lists show it in two lines, and longer copy would be cut off. Say less rather than dropping the author’s meaning. Optional fields are `cover`, `explorer`, `documents`, `created`, and `updated`. Unknown fields fail validation. Do not put `title`, `presentation`, document labels, heading offsets, or duplicate metadata in another file. A blockquote is ordinary content, never a special description source.

The main README must begin with YAML front matter. After that, its first content must be its one nonempty `#` title. Every companion document also starts with exactly one nonempty `#` title, but topic metadata belongs only in the main README. Use `##` for chapters and `###` for subsections; do not skip heading levels. Numbering and wording belong to the author: never add, strip, shorten, or rename headings merely to improve the sidebar. Ordered instructions and phased workflows are content, not generated chapter numbering.

A single-document topic needs nothing else. For multiple documents, add a list of unique local Markdown paths to the main README's front matter, beginning with `README.md`:

```yaml
documents:
  - README.md
  - WORKFLOW.md
```

Omitting `documents` means only `README.md` is rendered. Do not list archival notes unless they should be part of the complete reader. Each listed document is rendered in full; meaningful companion document titles provide boundaries and TOC grouping, without repeating the main topic title or adding generic labels such as “The concept.”

Append the folder ID to the `topics` array in `topics/topics.json` for a new topic. This canonical order determines topic numbers, collection-side navigation, and next-topic links. The homepage presents the reverse order, newest-added first, without renumbering. Do not hardcode topic numbers in metadata.

Do not edit the generator or templates to register a topic. Add optional authored visuals only when they help explain the idea, and update the root README's human-readable topic list.

Then run:

```sh
npm ci              # First checkout, or after the lockfile changes
npm run typecheck   # Strict TypeScript checking
npm run build       # Regenerate root and topic HTML files
npm run check       # Detect stale output, broken links and invalid references
npx playwright install chromium # First checkout: sharing-card renderer and browser tests
npm test            # Generator, publication, search, and theme contract checks
npm run test:browser # Offline, responsive, keyboard, and interaction checks
```

Open `index.html` and the new topic's `index.html` directly in a browser. Check the title, full text, navigation, code examples, keyboard interaction, narrow layout, and offline behavior.

## Editorial structure and shared presentation

- **One title, one description.** The main README's `#` title is used on the page, collection card, search results, and navigation. Its title appears once in the reader; the front-matter description appears once beneath it. Do not repeat a subtitle as a chapter heading.
- **An actual opening.** Give the introduction its own `##` heading and establish enough context for the reader to understand the argument. Preserve the author's voice; do not add personal framing, generic filler, or a rewrite merely for visual polish.
- **No manuscript furniture.** Remove revision/version notices, working-draft labels, duplicated date lines, and editorial status footers from a published article when preparing it for publication. Preserve substantive uncertainty, illustrative-example qualifications, historical context, and limitations. A proposal must not become a claimed proven result.
- **Dates have one home.** Optional `created` and `updated` dates live in the main README's front matter as valid `YYYY-MM-DD` strings. Preserve the original creation date; update `updated` for substantive content changes, not rebuilds or cosmetic changes. `updated` requires `created` and cannot precede it. Missing dates remain omitted; never invent them. Do not repeat these dates in prose. Same-day creation/update dates appear only once. Historical dates that are part of the argument remain content. Never derive rendered dates from Git history or the build clock: squash merges and different checkout histories must not change generated HTML. Pages show dates as how long ago, to the month (“8 months ago”); that is computed in the browser from the generated exact date, which appears on hover, focus or tap and is what screen readers and no-JavaScript readers get.
- **The TOC is derived, not separately written.** Authored `##` headings become clickable chapter groups and `###` headings become visible nested links. Preserve exact text and numbering. Single-document topics have no document-label wrapper. Multipart topics group by actual document titles. Chapters are evenly spaced whether or not they have subsections; do not change their text to fit the sidebar.
- **Shared visual hierarchy.** In Folio, topic titles are plum, chapters teal, and subsections copper; in Field Atlas, titles are ink, chapters deep green, and subsections sienna. Both have accessible light/dark variants. Chapter dividers are full-width one-pixel rules that fade from left to right; subsection marks are shorter. The first body heading has a compact gap below the metadata and no divider. Keep these rules in `design-system/`, never in topic-specific markup or styles.
- **Shared, progressive motion.** The topic title, description, and dates reveal together using the homepage's fade/zoom/downward arrival. All chapters and subsections visible in the initial viewport reveal together on one shared timeline, delayed 500ms after the topic header starts. Later chapters and subsections reveal independently on scroll, once per page visit. Motion must not hide content for direct links, keyboard focus, search/browser find, printing, reduced-motion users, restored reading positions, or browsers without JavaScript/IntersectionObserver. Do not add per-topic motion scripts.

Build validation must fail before replacing output for missing/ambiguous source references, invalid front matter, duplicate/missing top-level titles, skipped heading levels, missing assets, or broken links. Maintain tests for single-document and multipart topics, authored heading fidelity, full content, offline behavior, accessibility, themes, motion fallbacks, and narrow layouts.

## Authoring visual sources

Use plain Markdown plus ordinary asset files rather than embedding an application framework in the documents. A topic remains readable and editable on GitHub without running the generator.

- **Images:** put the file in `assets/` and reference it with standard Markdown, for example `![A description](assets/diagram.svg)`. Local images are embedded in the HTML at build time. Download remote images first; do not introduce runtime network dependencies.
- **Diagrams:** author standalone SVG in `assets/`. Include a `viewBox`, accessible title/description, stable node IDs, and local styles with fallback colors. Shared CSS variables can theme the inline version. Keep scripts and external references out of SVG files.
- **Structured data:** use JSON or CSV in `assets/` when the data itself is the source. The current generator supports images and the explorer component; additional visual forms need a generic renderer before use. Do not imply arbitrary assets automatically become interactive.
- **AI illustrations:** use `topics/<id>/assets/illustrations/manifest.json` for optional homepage, article-top, and exact document/chapter placements. See [the illustration delivery guide](design-system/illustration-style/README.md) and its generation prompt for filenames, ZIP structure, alt text, and validation. Version 3 wildlife packages need only a species and five ordered images: one uncropped 16:9 portrait reused on the homepage/article, plus four decorative 4:1 panoramas automatically spread before chapter boundaries, with empty alt text and no semantic chapter bindings. Older version 1/2 artwork remains supported. This is an artwork placement manifest, not a second source of topic metadata or prose. Missing manifests/images render nothing; homepage illustration blocks stay empty. Existing topic SVG covers/diagrams have been removed in preparation for these assets. Preserve the wordmark and approved generation references.
- **Cover (generic SVG support):** set `cover: assets/cover.svg` in the main README's front matter. It is optional and supplies the collection-card illustration. Keep it legible at thumbnail sizes and accessible, themed, and offline.
- **Explorer:** configure `explorer` in that same YAML front matter. This uses a generic SVG-and-panels component; it is not topic-specific JavaScript. See the existing topics for complete YAML examples. The reference objects below use JSON notation for clarity; write their equivalent mappings under `explorer.panels` in YAML.

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

`npm run build:site` creates a clean `_site/` bundle for GitHub Pages, including automatically rendered social sharing JPEGs. Install Playwright Chromium first (`npx playwright install chromium`); publication-bundle tests also need it. The approved card layout lives in `design-system/sharing.css`, and `scripts/sharing.ts` derives its copy, artwork, and wordmark from existing sources. Sharing images live only in `_site/assets/sharing/`; their source-addressed URLs are included in generated HTML. Do not author cards in `_site/` or maintain separate article copy. This uses the same generator and presentation as the checked-in standalone files. Keep all navigation relative so it works under a repository subpath and through `file://`.

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

The collection name, when shown on two lines, must be “the way I” / “AI”, without a trailing period. Never separate “I” from “the way”. Render “the” at half the main title's font size. Align the second line's right edge with the first line's right edge. Both diagonal stems must continue across the lines: the “A”'s left stem aligns with the “y”'s right stem, and its right stem aligns with the “y”'s left stem. A small optical width/angle adjustment to the “A” achieves this; keep both “I”s vertical and allow them to join. Scale letter spacing and optical offsets with the font size to preserve this alignment. The newline in `topics/topics.json`’s `displayTitle` is authoritative; the generic layout renders each line as an unbreakable span, styles the first word of the first line as a smaller prefix, wraps the last line's initial for optical alignment, and sizes it responsively. Check desktop and 320/390px layouts for alignment, extra lines, and horizontal overflow after title or typography edits.

Use the shared `.wordmark` component; do not recreate the lettering or reintroduce the asterisk. See the [design-system guide](design-system/README.md#build-contract) for wordmark placement and sizing. Other brand mentions, such as the footer, remain on one line.

The optional `titleBackground` in `topics/topics.json` references a local image relative to `topics/`. Keep its source in `topics/assets/`; the generator embeds one copy per HTML file, shared by that page's wordmarks. The optional `titleBackgroundPosition` references the wave editor's JSON export, currently `assets/title-wave-position.json`. Preserve its exact corner coordinates in title-relative em units. The generator produces a static CSS projection, so the wave and letters scale together without JavaScript or separate mobile offsets. Preserve offline rendering and verify both themes at large and miniature sizes.

### Two designs: Field Atlas (default) and Folio

Every generated page carries both designs. **Field Atlas** is the default: each topic's wildlife portrait is mounted like a plate in a naturalist's book, the manifest `species` becomes the Latin and common name, and the title, description, category and dates appear on a label card. Visible wording stays plain for readers whose first language is not English: “Topic 4” and “No. 4” (ordinary numbers from canonical order), “All topics”, “Browse the topics”, “Category”, “Previous/Next topic”, and “A–Z index”. Do not reintroduce book jargon such as “plate”, “leaf through”, or “habitat” in visible text. **Folio** is the previous editorial design, preserved unchanged. A segmented Atlas/Folio switch at the masthead's right swaps the presentation in place, keeps the reader's position, and persists the choice in `the-way-i-ai-design` local storage; a head script applies it before first paint. Without JavaScript, readers get Field Atlas with full content and native topic navigation.

The masthead has the same geometry in both designs (Folio's heights, compaction on scroll, insets, gaps, and control sizes), and the switch uses the same embedded Plex Mono in both, so its buttons never move under the pointer. The atlas only adds the “All topics” button on the left of every page except the home page, which already presents every topic; on phone-width topic pages it is hidden and the bottom bar handles navigation.

- Both designs share one DOM, the same content, the same wordmark lettering and wave, and the same embedded images. Never duplicate images per design; the home spread clones the cards' own images at runtime.
- Folio styles live in `design-system/theme.css`. Field Atlas styles live in `design-system/atlas.css`, scoped to `:root[data-design='atlas']`. Design-specific markup uses `.atlas-only` or `.folio-only`; never branch on topic IDs.
- Field Atlas parts: a title section with the wordmark beside an unframed introduction, a faint background stamp ring turning behind them and the translucent masthead, a paged “Browse the topics” spread (newest first; arrows, filmstrip, ← → keys, swipe), a category-filtered topic list, an “All topics” drawer (a native `<details>`), a mounted portrait with a label card, a running head with the current chapter, margin notes, previous/next topic cards (`[` and `]`), a phone bottom bar (shared with Folio), and the generated A–Z index (`general-index/index.html`). Internal class names such as `plate-*` are implementation details, not reader-facing words.
- The atlas keeps a fixed reading measure, so Folio's resizable columns and collection sidebar are hidden there. Focus mode works in both designs; it also hides the design switch. Murmuration runs only in Folio.
- Motion guides the reader in both designs: disclosures animate their height, the search dialog and topic drawer animate in and out, filtered rows and explorer panels fade in, and theme and design changes cross-fade for 200ms through View Transitions, except that switching designs on the home page replays its arrival entrance, as after a reload. Focus mode animates the outline column and the text measure together. Toasts, search results, and outline filtering fade in. On the home page the wordmark arrives on its own (“the way” rises, the shared I drops in with a bounce, the last line rises as it lands, then the wave), and after 20 seconds of reader inactivity it performs one rare trick from a shuffled set of 12 (see the design-system README) at most every one to two minutes, in shuffled order, never while out of view or with reduced motion. Its parts stay inline text so the approved lettering never moves; nothing animates continuously. The full stop after rotating phrases chases each new phrase. Reduced motion makes every change immediate.
- The keyboard has one model in both designs, listed by “?” in four groups: Move (J/K focus the next item on any page; ← → on the Atlas spread), Open (Enter on the selected, focused link), Go (G-prefixed jumps, [ and ], search) and Change (F, C, S, T, D, Esc). Shortcuts move real focus rather than a simulated selection, so Tab, Enter and screen readers follow. Add new keys to that model and its dialog, not as one-off handlers, and keep them inactive while typing or with a dialog open. A key that needs navigation hidden by focus mode leaves focus mode first.
- Links to other topics (the topic drawer and previous/next links in both designs) show build-time 360px JPEG thumbnails of the portraits (`scripts/thumbnail.ts`), so a page never embeds another topic's full-size artwork. Do not add reading-time estimates or reading progress to either design.
- Only the wordmark's ink colours may differ between designs. Its letterforms, sizes, alignment rules, and wave stay identical.

The Folio presentation is an editorial reading list, serif prose, and quiet navigation. Keep the approved wordmark unchanged. There is one repository link in the site chrome, a GitHub icon at the masthead's far right, after the design switch, share and theme buttons; no promotional taglines or extra sidebar/footer repository links. The icon-only theme button switches immediately to the opposite resolved theme, with an accessible action name and the destination icon (moon for Dark, sun for Light); do not use a popup. System is the default and follows live device changes. Manual choices expire after two hours without scrolling, typing, or navigation. Persist activity across pages/tabs, expire stale choices before first paint, and check elapsed time when a sleeping or cached page resumes. Topic collection sidebars start collapsed until changed, then remember their state in browser storage; they animate when expanded/collapsed, honoring reduced motion. Preserve the outline order, masthead placement, and synchronized sidebar motion documented in the [design-system guide](design-system/README.md). Do not reintroduce reading progress. Topic headers compact while scrolling and restore at the top; keep hysteresis between thresholds to avoid scroll/layout oscillation.

Each collection topic card is one native link covering the entire card, with its heading as the accessible name. Preserve keyboard activation, visible focus, and open-in-new-tab behavior; do not nest links or simulate a link with click handlers.
