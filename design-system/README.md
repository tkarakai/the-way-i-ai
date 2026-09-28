# The Way I AI · Design system

The shared presentation layer for a collection of source-owned topics. The **Folio** design pairs warm paper, dark ink, copper accents, Newsreader headings and prose, and DM Sans navigation. The homepage is an editorial collection with the selected **F · Murmuration** background at **20% intensity**, configured in `topics/topics.json` with `ambientBackground: "F"` and `ambientIntensity: 0.2`. The original topographic **A** treatment remains available exclusively in the preview gallery. All six studies live in [`previews/backgrounds.html`](../previews/backgrounds.html), built with `npm run preview:backgrounds`. On the site, topic pages have an optional collection sidebar and a section outline to the left of the article on desktop, becoming a disclosure above the article on narrow layouts. The outline precedes the article in DOM order too, so keyboard navigation matches the layout. The collection's display title pairs plum with teal through `--title-ink` and `--title-accent`, with lighter variants for dark mode. Font and code-renderer licenses are in `licenses/` and are embedded in the generated files.

## Homepage entrance

The logo/slogan section enters first; the collection follows after 600ms. Both use a one-time fade, a 90% → 100% zoom, and a downward arrival from above, inspired by the [Makerkit demo](https://next-supabase-saas-kit-turbo-demo-vercel-web.vercel.app/). Durations are 800ms and 1000ms respectively, with `ease` timing. Travel is shorter than the reference to fit Folio's compact layout, and shorter again on narrow screens. The masthead stays stationary; Murmuration continues independently at 20%.

The entrance is CSS-only, including offline/no-JavaScript pages. It reserves the final layout space, leaves no persistent transform, and does not replay on theme changes or resize. Reduced-motion and print show both sections immediately. Keyboard focus reveals the focused section immediately; with JavaScript, it finishes both entrances so focus cannot cause a replay. The standalone background gallery omits this page-load choreography.

## Responsibilities

- `theme.css`: shared tokens, typography, layouts, responsive behavior, dark mode, and print styles.
- `reader.ts`: collection/section search, navigation, code copying, theme controls, explorer selection, animated focus mode, and scroll-responsive header.
- `theme.ts`: pre-paint System resolution, temporary manual overrides, two-hour inactivity expiry, persistence, live system changes, and cross-tab updates.
- `murmuration.ts`: the shared particle renderer used by the homepage and preview study F, with identical geometry, timing, and palettes.
- `ambient.ts`: homepage-only canvas lifecycle; capped pixel density and 30 fps, a still frame for reduced motion, and suspension in background tabs, cached pages, and print.
- `search.ts`: creates the embedded collection-wide index from rendered prose and original code; result URLs remain relative.
- `layout.ts`: collection and reader layouts; receives all collection and topic copy from source metadata.
- `wordmark.ts`: validates the saved wave geometry and generates its scalable, static CSS projection.
- `explorers.ts`: a generic SVG-and-panels renderer. It resolves Markdown section/excerpt references and highlights named SVG nodes.

Topic-specific copy, diagram labels, SVG geometry, and explorer configuration belong in `topics/<id>/`, not here. Collection copy and topic order live in `topics/topics.json`; newlines in the opening statement create authored display lines, and the optional `introductionAccent` identifies the phrase rendered in the collection accent color. A new topic needs no changes to this directory unless it introduces a genuinely new reusable presentation component.

## Build contract

`scripts/build.ts` reads the registry, each topic's `topic.json`, Markdown, and assets. It renders Markdown with Marked, pre-renders code examples with Pierre, and embeds fonts, styles, behavior, and diagrams in standalone HTML. The code examples use declarative shadow DOM with a JavaScript fallback for older browsers. All narrative text is available without JavaScript.

Local Markdown images become data URLs. SVG sources used inline must be standalone, script-free, and free of external render dependencies. Assets can use the shared CSS variables, with fallback values for opening the SVG on its own.

See the root README for [build and verification commands](../README.md#editing-and-adding-topics) and [publication bundle usage](../README.md#github-pages). `npm run check` rejects stale output, invalid source references, broken links, duplicate IDs, and external render dependencies. Browser acceptance coverage is defined in [`tests/reader.spec.ts`](../tests/reader.spec.ts).

The masthead places search directly after the home wordmark, with no redundant “The collection” link. Theme and GitHub controls remain at the right. On desktop topic pages, the logo and search shift left as the collection sidebar collapses; header padding and the sidebar grid share the same motion token. Mobile keeps a stable header inset while navigation disclosures stack above the article. The only repository navigation link is the GitHub icon at the masthead's far right. The adjacent icon-only theme button immediately switches to the opposite resolved theme; there is no popup. Its icon and accessible name describe the destination: a moon to switch to Dark, a sun to switch to Light. System is the default and follows live device changes. Controls have accessible names and native keyboard behavior. Avoid promotional taglines or extra sidebar/footer links.

On topic pages, the collection sidebar is a native disclosure, collapsed until the reader changes it and then restored from local storage on later navigations. Desktop grid columns animate its expansion/collapse; reduced-motion preferences disable transitions. On desktop, the open collection sidebar, section outline, and centered reading column have pointer- and keyboard-operable resize handles; the compact mobile layout retains fixed widths. The header’s icon-only focus control animates both navigation columns and the masthead away, then moves into the viewport corner so navigation can be restored; the sequence reverses when leaving focus mode. Escape also leaves focus mode. Theme choice, focus mode, collection disclosure state, all desktop column widths, and per-topic reading positions persist in local storage; unavailable storage falls back to in-memory defaults without blocking reading. There is no reading-progress indicator. Scrolling beyond 120px compacts the header; returning within 16px of the top restores it. The separate thresholds prevent layout-height changes from repeatedly retriggering the transition. Full text and native disclosures remain available without JavaScript.

A manual theme override expires after **two hours without scrolling, typing/keyboard input, or navigation**. One local-storage record (`the-way-i-ai-theme`) keeps the choice and last-activity timestamp together across pages and tabs. Activity writes are throttled to once per second and flushed on leaving; navigation and theme selection save immediately. Check expiry before recording a new navigation or interaction, so returning after a long absence cannot renew a stale override. Recheck on visibility/focus, device changes, and cached-page restores to handle sleeping devices and throttled timers. Pointer movement, ordinary button clicks, and tab focus alone do not renew it. Legacy untimed preferences default to System. Blocked storage retains selection and expiry in memory.

The shared `.wordmark` renders the same live lettering and decorative wave in the collection title and every page's home link. Set `--wordmark-size` to resize it; all spacing, optical letter adjustments, and background coordinates follow that size. The home link has an accessible name and the decorative duplicate text is hidden from assistive technology.

The “On this page” search filters the outline by matching heading or section content and highlights every visible occurrence in both the outline and document. Collection-wide search highlights matches in its result list and carries the query into the destination page’s local search through the `q` URL parameter.

The generator derives each topic’s dates from Git author timestamps for currently tracked files in its source bundle, excluding `index.html`. Creation uses the earliest timestamp across each file’s rename-following history; last-updated uses the latest commit returned by Git for the current file paths. It emits standard article date metadata and visible dates where history exists; archives or new untracked topics without Git history simply omit the date block. Follow the root README’s [checkout requirements](../README.md#editing-and-adding-topics) when reproducing committed output.

The optional `titleBackground` and `titleBackgroundPosition` paths resolve relative to `topics/`. The latter is the version 1 JSON exported by the standalone wave editor, currently `topics/assets/title-wave-position.json`. Its four corners use the main title's font size as one `em`, measured from the title layout box's top-left. The generator converts that geometry to a CSS perspective transform, so both large and miniature versions match exactly without JavaScript or resize handlers. The image is embedded once per HTML file and shared by all wordmark instances through CSS. `topics/assets/logo-bg.png` contains transparent teal strokes, with the neutral matte removed so the actual page background shows through in both themes. The original export is retained as `logo-bg-source.png`; `node scripts/prepare-title-wave.ts` regenerates the transparent version without changing its dimensions or saved corner coordinates (requires Playwright Chromium). Dark-mode ink inversion remains in `theme.css`; no opaque backing or stacking-context-dependent blend is needed. The image and positioning JSON are included in the publication bundle.

## Reuse

Copy this directory, `scripts/`, `tsconfig.json`, the build dependencies, and a source collection into another repository. Update `topics/topics.json` for collection identity and copy. Customize the shared CSS tokens for the visual style. Topic folders remain independently editable bundles of Markdown, metadata, and assets.

The complete topic authoring guide, including explorer bindings and Markdown excerpt markers, is in [AGENTS.md](../AGENTS.md).

Keep semantic headings, visible focus, native links/buttons, bounded reading widths, reduced-motion support, and keyboard-operable interactions. Verify desktop and narrow layouts in both themes after changing presentation. Print styles reveal explorer panels and suppress navigation controls.

## Language and collection title rules

Follow [AGENTS.md’s language, collection title, and card rules](../AGENTS.md#language-and-collection-title-rules) and [publishing and link-authoring contract](../AGENTS.md#building-and-publishing). The root README explains [hosted and local reading](../README.md#reading-locally).
